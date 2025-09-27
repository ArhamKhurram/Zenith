const { ApplicationCommandOptionType } = require('discord.js');
const loggingSystem = require('../../utils/loggingState');

module.exports = {
    deleted: false,
    name: 'logging',
    description: 'Control message logging system (Developer only)',
    options: [
        {
            name: 'action',
            description: 'Start or stop logging',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: 'Start logging', value: 'start' },
                { name: 'Stop logging', value: 'stop' },
                { name: 'Status', value: 'status' }
            ]
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

        const action = interaction.options.getString('action');

        switch (action) {
            case 'start':
                loggingSystem.setLoggingState(true);
                console.log(`\n🟢 MESSAGE LOGGING STARTED`);
                console.log(`Started by: ${interaction.user.username}`);
                console.log(`Server: ${interaction.guild.name}`);
                console.log(`Time: ${new Date().toISOString()}`);
                console.log(`💾 Messages will be saved directly to DATABASE (no memory storage)`);
                console.log(`=====================================\n`);
                
                await interaction.reply({
                    content: '🟢 **Message logging started!**\n📊 Messages will be logged to console and saved directly to database.\n💾 **No memory storage** - efficient for long-term logging.',
                    ephemeral: true
                });
                break;

            case 'stop':
                loggingSystem.setLoggingState(false);
                console.log(`\n🔴 MESSAGE LOGGING STOPPED`);
                console.log(`Stopped by: ${interaction.user.username}`);
                console.log(`Time: ${new Date().toISOString()}`);
                console.log(`=====================================\n`);
                
                await interaction.reply({
                    content: '🔴 **Message logging stopped!**\nLogging has been disabled.',
                    ephemeral: true
                });
                break;

            case 'status':
                const isLogging = loggingSystem.getLoggingState();
                await interaction.reply({
                    content: `📊 **Logging Status:**\n` +
                            `Status: ${isLogging ? '🟢 Active' : '🔴 Inactive'}\n` +
                            `Storage: 💾 Database only (no memory storage)\n` +
                            `Performance: ✅ Memory efficient`,
                    ephemeral: true
                });
                break;
        }
    }
};