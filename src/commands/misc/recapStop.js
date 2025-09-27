const { PermissionFlagsBits } = require('discord.js');
const { recapConfigs } = require('./recapStart');

module.exports = {
    deleted: false,
    name: 'recap-stop',
    description: 'Stop automatic recaps for this server',
    options: [],
    permissionsRequired: [PermissionFlagsBits.ManageChannels],
    botPermissions: [],

    callback: async (client, interaction) => {
        const serverId = interaction.guild.id;

        // Check if recap is running
        if (!recapConfigs.has(serverId)) {
            return await interaction.reply({
                content: '❌ No active recap found for this server.',
                ephemeral: true
            });
        }

        try {
            const config = recapConfigs.get(serverId);
            
            // Clear the interval
            if (config.intervalId) {
                clearInterval(config.intervalId);
            }

            // Remove from configs
            recapConfigs.delete(serverId);

            console.log(`🛑 Recap stopped for ${interaction.guild.name}`);
            console.log(`👤 Stopped by: ${interaction.user.username}`);
            console.log(`⏰ Was running in: #${config.channelName}`);

            await interaction.reply({
                content: `✅ **Recap stopped!**\n` +
                        `🛑 Automatic recaps have been disabled for this server.\n` +
                        `📊 Was sending recaps to: <#${config.channelId}>`,
                ephemeral: false
            });

        } catch (error) {
            console.error('Error stopping recap:', error);
            await interaction.reply({
                content: `❌ **Error stopping recap:** ${error.message}`,
                ephemeral: true
            });
        }
    }
};