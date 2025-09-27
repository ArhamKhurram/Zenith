const fs = require('fs').promises;
const path = require('path');

// Store for recap channel IDs and their logging status
const recapChannels = new Map();

async function startRecapLogging(client) {
    console.log('🎯 Starting recap channel logging system...');
    
    // Load recap channels from config (you can add channel IDs here)
    const RECAP_CHANNELS = process.env.RECAP_CHANNELS ? 
        process.env.RECAP_CHANNELS.split(',') : [];
    
    RECAP_CHANNELS.forEach(channelId => {
        recapChannels.set(channelId.trim(), true);
        console.log(`📝 Monitoring recap channel: ${channelId}`);
    });
}

async function logRecapMessage(message) {
    try {
        // Check if this channel is being monitored for recaps
        if (!recapChannels.has(message.channel.id)) {
            return; // Not a recap channel
        }

        console.log(`📝 Logging recap message from #${message.channel.name}`);

        const messageData = {
            id: message.id,
            content: message.content,
            author: {
                id: message.author.id,
                username: message.author.username,
                displayName: message.author.displayName || message.author.username,
                isBot: message.author.bot
            },
            timestamp: message.createdAt.toISOString(),
            timestampReadable: message.createdAt.toLocaleString(),
            channel: {
                id: message.channel.id,
                name: message.channel.name
            },
            server: {
                id: message.guild.id,
                name: message.guild.name
            },
            attachments: message.attachments.map(att => ({
                id: att.id,
                name: att.name,
                url: att.url,
                contentType: att.contentType
            })),
            embeds: message.embeds.length,
            replyTo: message.reference ? {
                messageId: message.reference.messageId,
                channelId: message.reference.channelId
            } : null,
            wordCount: message.content.split(' ').length,
            characterCount: message.content.length
        };

        // Create filename based on date and channel
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const fileName = `recap-live-${message.channel.name}-${date}.json`;
        const filePath = path.join(process.cwd(), 'exports', 'live-recaps', fileName);
        
        // Create directory if it doesn't exist
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
        // Read existing data or create new array
        let existingData = [];
        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            existingData = JSON.parse(fileContent);
        } catch (error) {
            // File doesn't exist yet, start with empty array
        }

        // Add new message
        existingData.push(messageData);

        // Write back to file
        await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), 'utf8');

        console.log(`✅ Logged recap message to ${fileName} (${existingData.length} total messages)`);

    } catch (error) {
        console.error('❌ Error logging recap message:', error);
    }
}

function addRecapChannel(channelId) {
    recapChannels.set(channelId, true);
    console.log(`📝 Added recap channel monitoring: ${channelId}`);
}

function removeRecapChannel(channelId) {
    recapChannels.delete(channelId);
    console.log(`🗑️ Removed recap channel monitoring: ${channelId}`);
}

function getRecapChannels() {
    return Array.from(recapChannels.keys());
}

module.exports = {
    startRecapLogging,
    logRecapMessage,
    addRecapChannel,
    removeRecapChannel,
    getRecapChannels
};