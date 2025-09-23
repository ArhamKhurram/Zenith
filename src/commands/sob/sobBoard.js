const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Sob = require('../../models/Sobs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sob_leaderboard')
        .setDescription('Display the sob leaderboard')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of leaderboard to display')
                .setRequired(false)
                .addChoices(
                    { name: 'Receivers (who got the most sobs)', value: 'receivers' },
                    { name: 'Givers (who gives the most sobs)', value: 'givers' }
                ))
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of users to show (default: 50, max: 100)')
                .setRequired(false)
                .setMinValue(5)
                .setMaxValue(100)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const type = interaction.options.getString('type') || 'receivers';
            const limit = interaction.options.getInteger('limit') || 50;
            const guildId = interaction.guild.id;

            let leaderboard;
            let title;
            let description;

            if (type === 'receivers') {
                leaderboard = await Sob.getTopSobReceivers(guildId, limit);
                title = '😭 Sob Leaderboard - Top Sob Recipients';
                description = `Top ${limit} by sobs received`;
            } else {
                leaderboard = await Sob.getTopSobGivers(guildId, limit);
                title = '😭 Sob Leaderboard - Top Sob Givers';
                description = `Top ${limit} by sobs given`;
            }

            if (leaderboard.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(title)
                    .setDescription('No sob data found for this server yet!')
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            // Format the leaderboard
            const leaderboardText = leaderboard.map((entry, index) => {
                const rank = index + 1;
                const username = entry.username || 'Unknown User';
                const count = type === 'receivers' ? entry.sobCount : entry.sobsGiven;
                const sobEmoji = '😭';
                
                // Add special formatting for top 3
                let prefix = '';
                if (rank === 1) prefix = '🥇 ';
                else if (rank === 2) prefix = '🥈 ';
                else if (rank === 3) prefix = '🥉 ';
                
                return `${prefix}**${rank}.** ${username} — **${count}** ${sobEmoji}`;
            }).join('\n');

            // Split into multiple embeds if too long
            const maxLength = 4096;
            const embeds = [];

            if (leaderboardText.length <= maxLength) {
                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(title)
                    .setDescription(`${description}\n\n${leaderboardText}`)
                    .setFooter({ 
                        text: `Total entries: ${leaderboard.length} | Use /sob_stats to see your personal stats`,
                        iconURL: interaction.client.user.displayAvatarURL()
                    })
                    .setTimestamp();

                embeds.push(embed);
            } else {
                // Split into chunks
                const lines = leaderboardText.split('\n');
                let currentChunk = '';
                let chunkIndex = 1;

                for (const line of lines) {
                    if ((currentChunk + line + '\n').length > maxLength - 200) {
                        const embed = new EmbedBuilder()
                            .setColor('#3498db')
                            .setTitle(`${title} (Part ${chunkIndex})`)
                            .setDescription(`${description}\n\n${currentChunk}`)
                            .setTimestamp();

                        if (chunkIndex === 1) {
                            embed.setFooter({ 
                                text: `Total entries: ${leaderboard.length} | Continued in next embed...`,
                                iconURL: interaction.client.user.displayAvatarURL()
                            });
                        }

                        embeds.push(embed);
                        currentChunk = line + '\n';
                        chunkIndex++;
                    } else {
                        currentChunk += line + '\n';
                    }
                }

                // Add remaining chunk
                if (currentChunk.trim()) {
                    const embed = new EmbedBuilder()
                        .setColor('#3498db')
                        .setTitle(`${title} (Part ${chunkIndex})`)
                        .setDescription(`${description}\n\n${currentChunk}`)
                        .setFooter({ 
                            text: `Total entries: ${leaderboard.length} | Use /sob_stats to see your personal stats`,
                            iconURL: interaction.client.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    embeds.push(embed);
                }
            }

            await interaction.editReply({ embeds });

        } catch (error) {
            console.error('Error in sob leaderboard command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching the sob leaderboard. Please try again later.')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};