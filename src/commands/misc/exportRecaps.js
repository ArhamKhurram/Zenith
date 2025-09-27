const { ApplicationCommandOptionType } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    deleted: false,
    name: 'export-recaps',
    description: 'Export all messages from recap channel to JSON (Developer only)',
    options: [
        {
            name: 'channel',
            description: 'The recap channel to export from',
            type: ApplicationCommandOptionType.Channel,
            required: true
        },
        {
            name: 'limit',
            description: 'Max messages to export (default: 500)',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 10,
            max_value: 2000
        }
    ],
    permissionsRequired: [],
    botPermissions: [],

    callback: async (client, interaction) => {
        // Check if user is the developer
        const DEVELOPER_ID = process.env.DEVELOPER_ID;
        
        if (interaction.user.id !== DEVELOPER_ID) {
            return await interaction.reply({
                content: '❌ This command is restricted to the bot developer only.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.options.getChannel('channel');
            const limit = interaction.options.getInteger('limit') || 500;

            console.log(`📊 Exporting messages from #${channel.name}...`);

            await interaction.editReply({
                content: `📊 **Exporting recap messages...**\n` +
                        `📝 Channel: ${channel}\n` +
                        `🔢 Limit: ${limit} messages\n` +
                        `⏳ Fetching messages...`
            });

            // Fetch messages from the channel
            let allMessages = [];
            let lastMessageId = null;
            let fetchedCount = 0;

            while (fetchedCount < limit) {
                const options = {
                    limit: Math.min(100, limit - fetchedCount)
                };
                
                if (lastMessageId) {
                    options.before = lastMessageId;
                }

                const messages = await channel.messages.fetch(options);
                
                if (messages.size === 0) break;

                const messageArray = Array.from(messages.values());
                allMessages.push(...messageArray);
                fetchedCount += messageArray.length;
                lastMessageId = messageArray[messageArray.length - 1].id;

                // Update progress
                await interaction.editReply({
                    content: `📊 **Exporting recap messages...**\n` +
                            `📝 Channel: ${channel}\n` +
                            `🔢 Fetched: ${fetchedCount}/${limit} messages\n` +
                            `⏳ Processing...`
                });
            }

            console.log(`📝 Fetched ${allMessages.length} messages from #${channel.name}`);

            // Process messages into JSON format
            const processedMessages = allMessages.map(msg => ({
                id: msg.id,
                content: msg.content,
                author: {
                    id: msg.author.id,
                    username: msg.author.username,
                    displayName: msg.author.displayName || msg.author.username,
                    isBot: msg.author.bot
                },
                timestamp: msg.createdAt.toISOString(),
                timestampReadable: msg.createdAt.toLocaleString(),
                channel: {
                    id: msg.channel.id,
                    name: msg.channel.name
                },
                server: {
                    id: msg.guild.id,
                    name: msg.guild.name
                },
                attachments: msg.attachments.map(att => ({
                    id: att.id,
                    name: att.name,
                    url: att.url,
                    contentType: att.contentType
                })),
                embeds: msg.embeds.length,
                reactions: msg.reactions.cache.map(reaction => ({
                    emoji: reaction.emoji.name,
                    count: reaction.count
                })),
                replyTo: msg.reference ? {
                    messageId: msg.reference.messageId,
                    channelId: msg.reference.channelId
                } : null,
                wordCount: msg.content.split(' ').length,
                characterCount: msg.content.length
            }));

            // Sort by timestamp (oldest first)
            processedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Create export data
            const exportData = {
                metadata: {
                    exportedAt: new Date().toISOString(),
                    exportedBy: {
                        id: interaction.user.id,
                        username: interaction.user.username
                    },
                    channel: {
                        id: channel.id,
                        name: channel.name
                    },
                    server: {
                        id: interaction.guild.id,
                        name: interaction.guild.name
                    },
                    messageCount: processedMessages.length,
                    dateRange: {
                        oldest: processedMessages[0]?.timestamp,
                        newest: processedMessages[processedMessages.length - 1]?.timestamp
                    }
                },
                messages: processedMessages
            };

            // Save to JSON file
            const fileName = `recap-export-${channel.name}-${Date.now()}.json`;
            const filePath = path.join(process.cwd(), 'exports', fileName);
            
            // Create exports directory if it doesn't exist
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            
            // Write the JSON file
            await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8');

            console.log(`✅ Exported ${processedMessages.length} messages to ${fileName}`);

            // Create summary statistics
            const userStats = {};
            const wordStats = [];
            let totalWords = 0;

            processedMessages.forEach(msg => {
                if (!msg.author.isBot) {
                    userStats[msg.author.username] = (userStats[msg.author.username] || 0) + 1;
                    totalWords += msg.wordCount;
                    wordStats.push(msg.wordCount);
                }
            });

            const topUsers = Object.entries(userStats)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5);

            const avgWords = totalWords / processedMessages.filter(m => !m.author.isBot).length;

            await interaction.editReply({
                content: `✅ **Export Complete!**\n\n` +
                        `📁 **File:** \`${fileName}\`\n` +
                        `📊 **Messages exported:** ${processedMessages.length}\n` +
                        `📝 **Human messages:** ${processedMessages.filter(m => !m.author.isBot).length}\n` +
                        `🤖 **Bot messages:** ${processedMessages.filter(m => m.author.isBot).length}\n` +
                        `📈 **Average words per message:** ${avgWords.toFixed(1)}\n` +
                        `📅 **Date range:** ${new Date(exportData.metadata.dateRange.oldest).toLocaleDateString()} - ${new Date(exportData.metadata.dateRange.newest).toLocaleDateString()}\n\n` +
                        `**👥 Top Contributors:**\n` +
                        topUsers.map(([user, count]) => `• **${user}:** ${count} messages`).join('\n') +
                        `\n\n🎯 **Ready for prompt engineering!**`
            });

        } catch (error) {
            console.error('❌ Error exporting recap messages:', error);
            await interaction.editReply({
                content: `❌ **Export failed:** ${error.message}`
            });
        }
    }
};