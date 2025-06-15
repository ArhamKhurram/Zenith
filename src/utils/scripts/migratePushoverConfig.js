require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const mongoose = require('mongoose');
const PushoverConfig = require('../../models/PushoverConfig'); // update path as needed

const oldData = require('./oldConfig.json'); // save your data into this file

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const servers = oldData.server_configs;

    for (const [guildId, config] of Object.entries(servers)) {
      const doc = {
        guildId,
        apiKey: config.api_key,
        groupKey: config.group_key,
        degenGroupKey: config.degen_group_key || null,
        enabled: config.enabled ?? true,
        alertRole: config.alert_role || null,
        degenAlertRole: config.degen_alert_role || null,
        users: config.users || {},
      };

      await PushoverConfig.findOneAndUpdate(
        { guildId },
        doc,
        { upsert: true }
      );

      console.log(`📦 Imported config for guild ${guildId}`);
    }

    console.log('✅ Migration complete.');
    process.exit();

  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
};

runMigration();
