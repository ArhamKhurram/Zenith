const { PermissionFlagsBits } = require('discord.js');
const fnfStore = require('../../utils/fnfStore');

module.exports = {
  deleted: false,
  name: 'fnf-list',
  description: 'List names registered for FNF alerts (names only).',
  options: [],
  permissionsRequired: [],
  botPermissions: [PermissionFlagsBits.SendMessages],

  callback: async (client, interaction) => {
    try {
      const ALLOWED_GUILD = '1411252468058427425';
      if (!interaction.guild || interaction.guild.id !== ALLOWED_GUILD) {
        return interaction.reply({ content: '❌ This command can only be used in the FNF server.', ephemeral: true });
      }

      const entries = await fnfStore.listAll();
      if (!entries || entries.length === 0) return interaction.reply({ content: 'No FNF entries found.', ephemeral: true });
      const names = entries.map((e) => (e.name && String(e.name).trim() ? String(e.name).trim() : 'Unnamed'));
      const listText = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
      const content = `**FNF Members (${names.length})**\n${listText}`;
      return interaction.reply({ content, ephemeral: true });
    } catch (err) {
      console.error('fnf-list error:', err);
      return interaction.reply({ content: '❌ Failed to read FNF list.', ephemeral: true });
    }
  },
};
