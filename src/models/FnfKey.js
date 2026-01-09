const { Schema, model } = require('mongoose');

const fnfKeySchema = new Schema({
  name: { type: String, default: null },
  key: { type: String, required: true, unique: true },
  addedBy: { type: String, default: null },
  guildId: { type: String, default: null },
}, { timestamps: true });

fnfKeySchema.index({ key: 1 }, { unique: true });

module.exports = model('FnfKey', fnfKeySchema);
