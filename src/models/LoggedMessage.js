const { Schema, model } = require('mongoose');

const loggedMessageSchema = new Schema({
    // Server information
    serverId: {
        type: String,
        required: true,
        index: true
    },
    serverName: {
        type: String,
        required: true
    },
    
    // Channel information
    channelId: {
        type: String,
        required: true,
        index: true
    },
    channelName: {
        type: String,
        required: true
    },
    
    // User information
    userId: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    displayName: {
        type: String,
        required: true
    },
    
    // Message content
    content: {
        type: String,
        required: true,
        maxlength: 2000
    },
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    
    // Timestamps
    originalTimestamp: {
        type: Date,
        required: true
    },
    loggedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Recap tracking
    includedInRecap: {
        type: Boolean,
        default: false,
        index: true
    },
    recapId: {
        type: String,
        index: true
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
loggedMessageSchema.index({ serverId: 1, loggedAt: -1 });
loggedMessageSchema.index({ serverId: 1, includedInRecap: 1, loggedAt: -1 });
loggedMessageSchema.index({ loggedAt: -1, includedInRecap: 1 });

// Static methods for recap functionality
loggedMessageSchema.statics.getRecentMessages = function(serverId, minutes = 10) {
    const timeAgo = new Date(Date.now() - (minutes * 60 * 1000));
    return this.find({
        serverId,
        loggedAt: { $gte: timeAgo },
        includedInRecap: false
    }).sort({ loggedAt: 1 });
};

loggedMessageSchema.statics.markAsProcessed = function(messageIds, recapId) {
    return this.updateMany(
        { messageId: { $in: messageIds } },
        { 
            includedInRecap: true,
            recapId: recapId
        }
    );
};

loggedMessageSchema.statics.getServerStats = function(serverId) {
    return this.aggregate([
        { $match: { serverId } },
        {
            $group: {
                _id: null,
                totalMessages: { $sum: 1 },
                processedMessages: {
                    $sum: { $cond: ['$includedInRecap', 1, 0] }
                },
                oldestMessage: { $min: '$loggedAt' },
                newestMessage: { $max: '$loggedAt' }
            }
        }
    ]);
};

module.exports = model('LoggedMessage', loggedMessageSchema);