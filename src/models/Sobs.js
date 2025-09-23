const { Schema, model } = require('mongoose');

const sobSchema = new Schema({
    // The user who gave the sob reaction
    reactorId: {
        type: String,
        required: true,
        index: true
    },
    reactorUsername: {
        type: String,
        required: true
    },
    
    // The user who received the sob reaction (author of the message)
    targetUserId: {
        type: String,
        required: true,
        index: true
    },
    targetUsername: {
        type: String,
        required: true
    },
    
    // Message information
    messageId: {
        type: String,
        required: true
        // Removed unique: true - multiple people can sob the same message
    },
    channelId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    
    // Content context (optional, for leaderboard display)
    messageContent: {
        type: String,
        maxlength: 500 // Truncate long messages
    },
    
    // Timestamp
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
sobSchema.index({ guildId: 1, targetUserId: 1 }); // For user leaderboards per guild
sobSchema.index({ guildId: 1, reactorId: 1 }); // For tracking who gives the most sobs
sobSchema.index({ guildId: 1, createdAt: -1 }); // For recent sobs
sobSchema.index({ messageId: 1, reactorId: 1 }, { unique: true }); // Prevent same user sobbing same message twice

// Static methods for leaderboard queries
sobSchema.statics.getTopSobReceivers = function(guildId, limit = 50) {
    return this.aggregate([
        { $match: { guildId } },
        { 
            $group: { 
                _id: '$targetUserId',
                username: { $first: '$targetUsername' },
                sobCount: { $sum: 1 },
                lastSob: { $max: '$createdAt' }
            }
        },
        { $sort: { sobCount: -1, lastSob: -1 } },
        { $limit: limit }
    ]);
};

sobSchema.statics.getTopSobGivers = function(guildId, limit = 50) {
    return this.aggregate([
        { $match: { guildId } },
        { 
            $group: { 
                _id: '$reactorId',
                username: { $first: '$reactorUsername' },
                sobsGiven: { $sum: 1 },
                lastGiven: { $max: '$createdAt' }
            }
        },
        { $sort: { sobsGiven: -1, lastGiven: -1 } },
        { $limit: limit }
    ]);
};

sobSchema.statics.getUserSobStats = function(guildId, userId) {
    return Promise.all([
        // Sobs received
        this.countDocuments({ guildId, targetUserId: userId }),
        // Sobs given
        this.countDocuments({ guildId, reactorId: userId }),
        // Recent sobs received
        this.find({ guildId, targetUserId: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('reactorUsername messageContent createdAt')
    ]).then(([received, given, recent]) => ({
        received,
        given,
        recent
    }));
};

module.exports = model('Sob', sobSchema);