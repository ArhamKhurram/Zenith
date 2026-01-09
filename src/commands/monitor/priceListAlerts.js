const priceMonitor = require('../../utils/priceMonitor');

module.exports = {
  deleted: false,
  name: 'price-list-alerts',
  description: 'List active token alerts (id and name only).',

  callback: async (client, interaction) => {
    try {
      const list = priceMonitor.listAlerts();
      if (!list || list.length === 0) return interaction.reply({ content: 'No active alerts.', ephemeral: true });
      const lines = list.map(a => `${a.id} — ${a.user_name}`).join('\n');
      return interaction.reply({ content: `**Active Alerts (${list.length})**\n${lines}`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ Failed to list alerts: ${err.message}`, ephemeral: true });
    }
  },
};
