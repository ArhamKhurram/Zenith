const { Schema, model } = require('mongoose');

const pushoverConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  apiKey: { type: String, required: true },
  groupKey: { type: String },
  degenGroupKey: { type: String },
  alertRole: { type: String },
  degenAlertRole: { type: String },
  enabled: { type: Boolean, default: true },
  users: {
    type: Map,
    of: String, // userId: userKey
    default: {},
  },
}, { timestamps: true });

module.exports = model('PushoverConfig', pushoverConfigSchema);
