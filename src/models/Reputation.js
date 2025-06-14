const { Schema, model } = require('mongoose');

const reputationSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  goodRep: { type: Number, default: 0 },
  badRep: { type: Number, default: 0 },
  totalReputation: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

// Prevent duplicate rep per user per guild
reputationSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = model('Reputation', reputationSchema);
