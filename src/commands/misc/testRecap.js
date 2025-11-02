const { ApplicationCommandOptionType } = require('discord.js');
const LoggedMessage = require('../../models/LoggedMessage');
const { generateRecap } = require('../../utils/geminiRecap');
const axios = require('axios');

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

            // Prepare payload for external recap API
            const API_URL = process.env.RECAP_API_URL || process.env.GEMINI_API_URL;
            if (!API_URL) throw new Error('Recap API URL not configured (process.env.RECAP_API_URL or GEMINI_API_URL)');

            const payload = {
                serverId,
                minutes,
                messages: recentMessages.map(m => ({
                    id: m.messageId || m._id,
                    author: m.authorTag || m.author || m.user,
                    content: m.content || '',
                    timestamp: (m.createdAt || m.timestamp || m.time) ? new Date(m.createdAt || m.timestamp || m.time).toISOString() : null,
                    channel: m.channelId || m.channel || null
                }))
            };

            // Send request via axios
            const headers = {
                'Content-Type': 'application/json'
            };
            if (process.env.RECAP_API_KEY) {
                headers['Authorization'] = `Bearer ${process.env.RECAP_API_KEY}`;
            }

            let recapText;
            try {
                const resp = await axios.post(API_URL, payload, {
                    headers,
                    timeout: 60_000 // 60s
                });

                // Prefer different possible response shapes
                if (resp && resp.data) {
                    if (typeof resp.data === 'string') {
                        recapText = resp.data;
                    } else if (resp.data.recap) {
                        recapText = resp.data.recap;
                    } else if (resp.data.text) {
                        recapText = resp.data.text;
                    } else {
                        recapText = JSON.stringify(resp.data, null, 2);
                    }
                } else {
                    recapText = '*AI recap temporarily unavailable*';
                }
            } catch (apiError) {
                console.error('❌ Recap API request failed:', apiError.message || apiError);
                recapText = '*AI recap temporarily unavailable*';
            }

            // Ensure recapText is a string and not too long for Discord messages
            let safeRecap = typeof recapText === 'string' ? recapText : JSON.stringify(recapText, null, 2);
            const MAX_LEN = 1800;
            let truncated = false;
            if (safeRecap.length > MAX_LEN) {
                safeRecap = safeRecap.slice(0, MAX_LEN) + '\n\n...(truncated)';
                truncated = true;
            }

            // Send the test recap
            await interaction.editReply({
                content: `✅ **Test Recap Generated!**\n\n${safeRecap}\n\n` +
                         `📊 **Test Results:**\n` +
                         `• Messages processed: **${recentMessages.length}**\n` +
                         `• Time range: **${minutes} minutes**\n` +
                         `• Recap length: **${String(recapText).length}** characters\n` +
                         `• Status: ${String(recapText).includes('*AI recap temporarily unavailable*') ? '⚠️ Fallback used' : '✅ AI generated'}${truncated ? ' (truncated)' : ''}`
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