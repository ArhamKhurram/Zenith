const fs = require('fs').promises;
const path = require('path');
const FnfKey = require('../models/FnfKey');

const LEGACY_PATH = path.join(__dirname, '..', '..', 'fnf-keys.json');

async function migrateFromFileIfNeeded() {
  try {
    const count = await FnfKey.countDocuments();
    if (count > 0) return; // already have entries
  } catch (e) {
    // ignore (no DB)
  }

  try {
    const raw = await fs.readFile(LEGACY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const normalized = parsed.map((entry) => {
      if (typeof entry === 'string') return { name: null, key: entry };
      if (entry && typeof entry === 'object') return { name: entry.name || null, key: entry.key || entry.user || entry.token || null };
      return null;
    }).filter(e => e && e.key);

    for (const e of normalized) {
      try {
        await FnfKey.updateOne({ key: e.key }, { $setOnInsert: { name: e.name, key: e.key } }, { upsert: true });
      } catch (_) {
        // ignore individual errors
      }
    }
  } catch (err) {
    // file missing or invalid - skip
  }
}

async function listAll() {
  await migrateFromFileIfNeeded();
  return await FnfKey.find().sort({ createdAt: 1 }).lean();
}

async function add(entry) {
  await migrateFromFileIfNeeded();
  return await FnfKey.create(entry);
}

async function removeByKey(key) {
  return await FnfKey.deleteOne({ key });
}

module.exports = {
  migrateFromFileIfNeeded,
  listAll,
  add,
  removeByKey,
  model: FnfKey,
};
