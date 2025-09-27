const loggingSystem = require('../../utils/loggingState');
const LoggedMessage = require('../../models/LoggedMessage');
const { logRecapMessage } = require('../../utils/recapLogger');

module.exports = async (client, message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Ignore empty messages
    if (!message.content || message.content.trim().length === 0) return;
    
    // Check if logging is enabled
    if (!loggingSystem.getLoggingState()) return;

    try {
        const messageData = {
            serverId: message.guild.id,
            serverName: message.guild.name,
            channelId: message.channel.id,
            channelName: message.channel.name,
            userId: message.author.id,
            username: message.author.username,
            displayName: message.author.displayName || message.author.username,
            content: message.content.substring(0, 500), // Limit to prevent spam
            timestamp: message.createdAt.toISOString(),
            messageId: message.id
        };

        // Log to console only (no memory storage)
        loggingSystem.logMessage(messageData);

        // Save directly to database for recap system
        try {
            const loggedMessage = new LoggedMessage({
                serverId: messageData.serverId,
                serverName: messageData.serverName,
                channelId: messageData.channelId,
                channelName: messageData.channelName,
                userId: messageData.userId,
                username: messageData.username,
                displayName: messageData.displayName,
                content: messageData.content,
                messageId: messageData.messageId,
                originalTimestamp: message.createdAt
            });

            await loggedMessage.save();
        } catch (dbError) {
            // Don't spam console with DB errors, just continue with console logging
            if (dbError.code !== 11000) { // Ignore duplicate key errors
                console.error('DB save error:', dbError.message);
            }
        }

        // Also log to recap files if this is a monitored recap channel
        await logRecapMessage(message);

    } catch (error) {
        console.error('Error in message logging:', error);
    }
};