const { ApplicationCommandOptionType } = require('discord.js');
const LoggedMessage = require('../../models/LoggedMessage');
const { generateRecap } = require('../../utils/geminiRecap');

module.exports = {
    deleted: false,
    name: 'test-recap',
    description: 'Test recap generation with recent messages (Developer only)',
    options: [
        {
            name: 'minutes',
            description: 'How many minutes back to test (default: 30)',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 1,
            max_value: 1440 // 24 hours
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
            const minutes = interaction.options.getInteger('minutes') || 30;
            const serverId = interaction.guild.id;

            console.log(`🧪 Testing recap generation for ${interaction.guild.name}...`);
            console.log(`📊 Looking for messages from last ${minutes} minutes`);

            // Get recent messages from database
            const recentMessages = await LoggedMessage.getRecentMessages(serverId, minutes);

            if (recentMessages.length === 0) {
                return await interaction.editReply({
                    content: `❌ **No messages found**\n` +
                            `No logged messages found in the last ${minutes} minutes for this server.\n` +
                            `Make sure logging is enabled with \`/logging action:start\``
                });
            }

            console.log(`📝 Found ${recentMessages.length} messages for test recap`);

            await interaction.editReply({
                content: `🧪 **Testing recap generation...**\n` +
                        `📊 Processing **${recentMessages.length}** messages from last **${minutes}** minutes\n` +
                        `⏳ Generating AI recap...`
            });

            // Generate recap using Gemini
            const recapText = await generateRecap(recentMessages);
            
            // Send the test recap
            await interaction.editReply({
                content: `✅ **Test Recap Generated!**\n\n${recapText}\n\n` +
                        `📊 **Test Results:**\n` +
                        `• Messages processed: **${recentMessages.length}**\n` +
                        `• Time range: **${minutes} minutes**\n` +
                        `• Recap length: **${recapText.length}** characters\n` +
                        `• Status: ${recapText.includes('*AI recap temporarily unavailable*') ? '⚠️ Fallback used' : '✅ AI generated'}`
            });

            console.log(`✅ Test recap completed for ${interaction.guild.name}`);

        } catch (error) {
            console.error('❌ Error in test-recap command:', error);
            await interaction.editReply({
                content: `❌ **Test failed:** ${error.message}`
            });
        }
    }
};