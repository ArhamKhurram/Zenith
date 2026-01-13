const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');

// Server recap configurations (in-memory for now)
let recapConfigs = new Map();

module.exports = {
    deleted: false,
    name: 'recap-start',
    description: 'Start automatic recaps for this server',
    options: [
        {
            name: 'channel',
            description: 'Channel to send recaps in',
            type: ApplicationCommandOptionType.Channel,
            required: true
        },
        {
            name: 'interval',
            description: 'Hours between recaps (default: 1)',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 1,
            max_value: 24
        }
    ],
    //permissionsRequired: [PermissionFlagsBits.ManageChannels],
    botPermissions: [PermissionFlagsBits.SendMessages],

    callback: async (client, interaction) => {
        const channel = interaction.options.getChannel('channel');
        const interval = interaction.options.getInteger('interval') || 1;
        const serverId = interaction.guild.id;

        // Check if channel is a text channel
        if (channel.type !== 0) {
            return await interaction.reply({
                content: '❌ Please select a text channel for recaps.',
                ephemeral: true
            });
        }

        // Check if recap is already running
        if (recapConfigs.has(serverId)) {
            return await interaction.reply({
                content: '❌ Recaps are already running in this server. Use `/recap-stop` first.',
                ephemeral: true
            });
        }

        try {
            // Set up recap configuration
            const config = {
                serverId,
                serverName: interaction.guild.name,
                channelId: channel.id,
                channelName: channel.name,
                interval: interval * 60 * 60 * 1000, // Convert hours to milliseconds
                startedBy: interaction.user.id,
                startedAt: new Date()
            };

            recapConfigs.set(serverId, config);

            // Start the recap interval
            const intervalId = setInterval(async () => {
                try {
                    await processRecap(client, config);
                } catch (error) {
                    console.error(`❌ Error in recap for ${config.serverName}:`, error);
                }
            }, config.interval);

            // Store interval ID for cleanup
            config.intervalId = intervalId;

            console.log(`🔄 Recap started for ${interaction.guild.name}`);
            console.log(`📍 Channel: #${channel.name}`);
            console.log(`⏰ Interval: ${interval} hours`);
            console.log(`👤 Started by: ${interaction.user.username}`);

            await interaction.reply({
                content: `✅ **Recap started!**\n` +
                        `📍 Channel: ${channel}\n` +
                        `⏰ Interval: **${interval} hours**\n` +
                        `🤖 I'll send automatic recaps of server activity every ${interval} hours.`,
                ephemeral: false
            });

        } catch (error) {
            console.error('Error starting recap:', error);
            await interaction.reply({
                content: `❌ **Error starting recap:** ${error.message}`,
                ephemeral: true
            });
        }
    }
};

// Function to process recap (will be called by interval)
async function processRecap(client, config) {
    const LoggedMessage = require('../../models/LoggedMessage');
    const { generateRecap } = require('../../utils/geminiRecap');

    try {
        console.log(`🔄 Processing recap for ${config.serverName}...`);

        // Get recent messages from database
        const recentMessages = await LoggedMessage.getRecentMessages(
            config.serverId,
            config.interval / (60 * 1000) // Convert back to minutes
        );

        if (recentMessages.length === 0) {
            console.log(`⚪ No new messages for recap in ${config.serverName}`);
            return;
        }

        console.log(`📝 Found ${recentMessages.length} new messages for recap`);

        // Generate recap using Gemini
        const recapText = await generateRecap(recentMessages);
        
        // Get the channel and send recap
        const channel = client.channels.cache.get(config.channelId);
        if (channel) {
            await channel.send({
                content: recapText
            });

            // Mark messages as processed
            const messageIds = recentMessages.map(msg => msg.messageId);
            const recapId = `recap_${Date.now()}_${config.serverId}`;
            await LoggedMessage.markAsProcessed(messageIds, recapId);

            console.log(`✅ Recap sent to #${config.channelName} in ${config.serverName}`);
        } else {
            console.error(`❌ Recap channel not found for ${config.serverName}`);
        }

    } catch (error) {
        console.error(`❌ Error processing recap for ${config.serverName}:`, error);
    }
}

// Export recap configs for use in stop command
module.exports.recapConfigs = recapConfigs;