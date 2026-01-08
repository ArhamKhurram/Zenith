const { ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
  deleted: false,
  name: 'fnf-join',
  description: 'Register your Pushover user key for FNF alerts (must run in allowed server).',
  options: [
    {
      name: 'key',
      description: 'Your Pushover user key (from your Pushover account).',
      required: true,
      type: ApplicationCommandOptionType.String,
    },
    {
      name: 'name',
      description: 'Optional display name to store (e.g. your Discord nickname).',
      required: false,
      type: ApplicationCommandOptionType.String,
    },
  ],
  permissionsRequired: [],
  botPermissions: [PermissionFlagsBits.SendMessages],

  callback: async (client, interaction) => {
    try {
      const ALLOWED_GUILD = '1411252468058427425';
      if (!interaction.guild || interaction.guild.id !== ALLOWED_GUILD) {
        return interaction.reply({ content: '❌ This command can only be run in the FNF server.', ephemeral: true });
      }

      const userKey = (interaction.options.getString('key') || '').trim();
      const displayName = (interaction.options.getString('name') || '').trim() || interaction.user.username;

      if (!userKey) return interaction.reply({ content: '❌ Invalid key provided.', ephemeral: true });

      const keysPath = path.join(__dirname, '../../../fnf-keys.json');
      let existing = [];
      try {
        const raw = await fs.readFile(keysPath, 'utf8');
        existing = JSON.parse(raw) || [];
        if (!Array.isArray(existing)) existing = [];
      } catch (e) {
        existing = [];
      }

      // Normalize to objects
      const normalized = existing.map(e => (typeof e === 'string' ? { name: null, key: e } : (e && typeof e === 'object' ? { name: e.name || null, key: e.key || e.user || e.token || null } : { name: null, key: null }))).filter(e => e.key);

      // Prevent duplicates
      if (normalized.some(e => e.key === userKey)) {
        return interaction.reply({ content: 'ℹ️ Your key is already registered for FNF alerts.', ephemeral: true });
      }

      normalized.push({ name: displayName, key: userKey });

      await fs.writeFile(keysPath, JSON.stringify(normalized, null, 2), 'utf8');

      return interaction.reply({ content: `✅ Registered ${displayName} for FNF alerts.`, ephemeral: true });
    } catch (err) {
      console.error('fnf-join error:', err);
      return interaction.reply({ content: '❌ Failed to register your key. Try again later.', ephemeral: true });
    }
  },
};
