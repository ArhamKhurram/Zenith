const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const LoggedMessage = require('../../models/LoggedMessage');

// Default target channel ID provided by user
const DEFAULT_TARGET_CHANNEL_ID = '1380555810391720027';

module.exports = {
    deleted: false,
    name: 'forward-logs',
    description: 'Send recent logged messages into a channel as embeds (Dev only)',
    options: [
        {
            name: 'minutes',
            description: 'How many minutes back to include (default: 60)',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 1,
            max_value: 1440
        },
        {
            name: 'limit',
            description: 'Max messages to forward (default: 500)',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 1,
            max_value: 5000
        },
        {
            name: 'channel',
            description: 'Target channel to send embeds to (defaults to configured channel id)',
            type: ApplicationCommandOptionType.Channel,
            required: false
        }
    ],
    permissionsRequired: [],
    botPermissions: [],

    callback: async (client, interaction) => {
        const DEVELOPER_ID = process.env.DEVELOPER_ID;
        if (interaction.user.id !== DEVELOPER_ID) {
            return await interaction.reply({ content: '❌ Developer only', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const minutes = interaction.options.getInteger('minutes') || 60;
            const limit = interaction.options.getInteger('limit') || 500;
            const channelOption = interaction.options.getChannel('channel');

            // Resolve target channel
            let targetChannel = null;
            if (channelOption) {
                targetChannel = channelOption;
            } else {
                try {
                    targetChannel = await client.channels.fetch(DEFAULT_TARGET_CHANNEL_ID);
                } catch (err) {
                    console.error('Error fetching default target channel:', err.message);
                }
            }

            if (!targetChannel) {
                return await interaction.editReply({ content: '❌ Could not resolve target channel. Provide a channel option or ensure the default channel ID is accessible by the bot.' });
            }

            // Query logged messages
            const timeAgo = new Date(Date.now() - minutes * 60 * 1000);
            const messages = await LoggedMessage.find({ createdAt: { $gte: timeAgo } }).sort({ createdAt: 1 }).limit(limit).lean();

            if (!messages || messages.length === 0) {
                return await interaction.editReply({ content: `❌ No logged messages found in the last ${minutes} minutes.` });
            }

            // Prepare embeds in batches - try to include 10 messages per embed safely
            const batchSize = 10;
            const embeds = [];

            for (let i = 0; i < messages.length; i += batchSize) {
                const slice = messages.slice(i, i + batchSize);
                const description = slice.map(msg => {
                    const time = new Date(msg.createdAt || msg.loggedAt || msg.originalTimestamp).toLocaleTimeString();
                    const channelName = msg.channelName || (msg.channel && msg.channel.name) || 'unknown';
                    const username = msg.username || (msg.author && msg.author.username) || 'unknown';
                    const content = msg.content ? msg.content.replace(/`/g, "'") : '[no content]';
                    return `**[${channelName}] ${username} • ${time}**\n${content}`;
                }).join('\n\n');

                const embed = new EmbedBuilder()
                    .setTitle(`Logged Messages (${i + 1}-${Math.min(i + batchSize, messages.length)})`)
                    .setDescription(description.substring(0, 4096))
                    .setTimestamp();

                embeds.push(embed);
            }

            // Send embeds sequentially to avoid rate limits
            let sentCount = 0;
            for (const e of embeds) {
                await targetChannel.send({ embeds: [e] });
                sentCount += Math.min(batchSize, messages.length - sentCount);
            }

            await interaction.editReply({ content: `✅ Forwarded ${messages.length} messages to ${targetChannel.toString()} (${embeds.length} embeds)` });

        } catch (error) {
            console.error('Error in forward-logs command:', error);
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
    }
};