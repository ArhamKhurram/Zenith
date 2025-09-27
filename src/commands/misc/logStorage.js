const { ApplicationCommandOptionType } = require('discord.js');
const LoggedMessage = require('../../models/LoggedMessage');

module.exports = {
    deleted: false,
    name: 'log-storage',
    description: 'Manage logged message storage in database (Developer only)',
    options: [
        {
            name: 'action',
            description: 'Storage action to perform',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: 'View stats', value: 'stats' },
                { name: 'Clear DB logs', value: 'clear-db' },
                { name: 'Cleanup old logs', value: 'cleanup' }
            ]
        },
        {
            name: 'server',
            description: 'Specific server ID (leave empty for current server)',
            type: ApplicationCommandOptionType.String,
            required: false
        },
        {
            name: 'days',
            description: 'For cleanup: keep logs from last X days (default: 7)',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 1,
            max_value: 30
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

        const action = interaction.options.getString('action');
        const serverId = interaction.options.getString('server') || interaction.guild.id;
        const days = interaction.options.getInteger('days') || 7;

        try {
            switch (action) {
                case 'stats':
                    await showStorageStats(interaction, serverId);
                    break;
                case 'clear-db':
                    await clearDatabaseLogs(interaction, serverId);
                    break;
                case 'cleanup':
                    await cleanupOldLogs(interaction, serverId, days);
                    break;
            }
        } catch (error) {
            console.error('Error in log-storage command:', error);
            await interaction.editReply({
                content: `❌ **Error:** ${error.message}`
            });
        }
    }
};

async function showStorageStats(interaction, serverId) {
    const filter = serverId === 'all' ? {} : { serverId };
    const dbCount = await LoggedMessage.countDocuments(filter);
    const processedCount = await LoggedMessage.countDocuments({ ...filter, includedInRecap: true });
    const unprocessedCount = await LoggedMessage.countDocuments({ ...filter, includedInRecap: false });

    // Get oldest and newest messages
    const oldestMessage = await LoggedMessage.findOne(filter).sort({ loggedAt: 1 });
    const newestMessage = await LoggedMessage.findOne(filter).sort({ loggedAt: -1 });

    const serverName = serverId === 'all' ? 'All servers' : interaction.guild.name;

    await interaction.editReply({
        content: `📊 **Storage Statistics - ${serverName}**\n\n` +
                `**Database:**\n` +
                `Total messages: **${dbCount}**\n` +
                `Processed (in recaps): **${processedCount}**\n` +
                `Unprocessed: **${unprocessedCount}**\n\n` +
                `**Timeline:**\n` +
                `Oldest: ${oldestMessage ? `<t:${Math.floor(oldestMessage.loggedAt.getTime()/1000)}:R>` : 'None'}\n` +
                `Newest: ${newestMessage ? `<t:${Math.floor(newestMessage.loggedAt.getTime()/1000)}:R>` : 'None'}\n\n` +
                `� **Storage:** Database only (memory efficient)`
    });
}

async function clearDatabaseLogs(interaction, serverId) {
    const filter = serverId === 'all' ? {} : { serverId };
    const result = await LoggedMessage.deleteMany(filter);
    
    console.log(`🗑️ Cleared ${result.deletedCount} messages from database`);
    
    await interaction.editReply({
        content: `🗑️ **Database cleared!**\n` +
                `Removed **${result.deletedCount}** messages from database.\n` +
                `Server: ${serverId === 'all' ? 'All servers' : interaction.guild.name}`
    });
}

async function cleanupOldLogs(interaction, serverId, days) {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    const filter = serverId === 'all' 
        ? { loggedAt: { $lt: cutoffDate } }
        : { serverId, loggedAt: { $lt: cutoffDate } };
    
    const result = await LoggedMessage.deleteMany(filter);
    
    console.log(`🧹 Cleaned up ${result.deletedCount} old messages (older than ${days} days)`);
    
    await interaction.editReply({
        content: `🧹 **Cleanup completed!**\n` +
                `Removed **${result.deletedCount}** messages older than **${days} days**\n` +
                `Server: ${serverId === 'all' ? 'All servers' : interaction.guild.name}\n` +
                `Cutoff date: <t:${Math.floor(cutoffDate.getTime()/1000)}:F>`
    });
}