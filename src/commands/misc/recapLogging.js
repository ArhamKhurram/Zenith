const { ApplicationCommandOptionType } = require('discord.js');
const { addRecapChannel, removeRecapChannel, getRecapChannels } = require('../../utils/recapLogger');

module.exports = {
    deleted: false,
    name: 'recap-logging',
    description: 'Manage recap channel logging (Developer only)',
    options: [
        {
            name: 'action',
            description: 'What to do with recap logging',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: 'Add Channel', value: 'add' },
                { name: 'Remove Channel', value: 'remove' },
                { name: 'List Channels', value: 'list' }
            ]
        },
        {
            name: 'channel',
            description: 'The recap channel to add/remove',
            type: ApplicationCommandOptionType.Channel,
            required: false
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
        const channel = interaction.options.getChannel('channel');

        try {
            switch (action) {
                case 'add':
                    if (!channel) {
                        return await interaction.reply({
                            content: '❌ Please specify a channel to add.',
                            ephemeral: true
                        });
                    }
                    
                    addRecapChannel(channel.id);
                    await interaction.reply({
                        content: `✅ **Recap logging enabled for ${channel}**\n\n` +
                                `📝 All messages in this channel will now be automatically logged to JSON files.\n` +
                                `📁 Files will be saved in: \`exports/live-recaps/\``,
                        ephemeral: true
                    });
                    break;

                case 'remove':
                    if (!channel) {
                        return await interaction.reply({
                            content: '❌ Please specify a channel to remove.',
                            ephemeral: true
                        });
                    }
                    
                    removeRecapChannel(channel.id);
                    await interaction.reply({
                        content: `🗑️ **Recap logging disabled for ${channel}**\n\n` +
                                `Messages in this channel will no longer be logged.`,
                        ephemeral: true
                    });
                    break;

                case 'list':
                    const monitoredChannels = getRecapChannels();
                    
                    if (monitoredChannels.length === 0) {
                        await interaction.reply({
                            content: '📝 **No recap channels being monitored**\n\n' +
                                    'Use `/recap-logging action:add channel:#your-recap-channel` to start monitoring.',
                            ephemeral: true
                        });
                    } else {
                        let channelList = '';
                        for (const channelId of monitoredChannels) {
                            try {
                                const ch = await client.channels.fetch(channelId);
                                channelList += `• ${ch} (${ch.name})\n`;
                            } catch {
                                channelList += `• <#${channelId}> (Unknown channel)\n`;
                            }
                        }
                        
                        await interaction.reply({
                            content: `📝 **Monitored Recap Channels (${monitoredChannels.length})**\n\n${channelList}\n` +
                                    `📁 Messages are saved to: \`exports/live-recaps/\``,
                            ephemeral: true
                        });
                    }
                    break;
            }
        } catch (error) {
            console.error('❌ Error in recap-logging command:', error);
            await interaction.reply({
                content: `❌ **Error:** ${error.message}`,
                ephemeral: true
            });
        }
    }
};