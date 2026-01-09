const { ApplicationCommandOptionType } = require('discord.js');
const priceMonitor = require('../../utils/priceMonitor');

module.exports = {
  deleted: false,
  name: 'price-monitor',
  description: 'Control the price monitor: start | stop | status',
  options: [
    { name: 'action', description: 'start|stop|status', type: ApplicationCommandOptionType.String, required: true },
  ],

  callback: async (client, interaction) => {
    try {
      const action = (interaction.options.getString('action') || '').toLowerCase();
      if (action === 'start') {
        const ok = priceMonitor.start();
        return interaction.reply({ content: ok ? '✅ Monitor started' : 'ℹ️ Monitor already running', ephemeral: true });
      }
      if (action === 'stop') {
        const ok = priceMonitor.stop();
        return interaction.reply({ content: ok ? '✅ Monitor stopped' : 'ℹ️ Monitor was not running', ephemeral: true });
      }
      if (action === 'status') {
        const s = priceMonitor.status();
        return interaction.reply({ content: `Running: ${s.running}\nAlerts: ${s.alerts}\nLast Check: ${s.lastCheck || 'never'}\nAPI OK: ${s.apiStatus.ok}\nCalls last minute: ${s.callsLastMinute}`, ephemeral: true });
      }
      return interaction.reply({ content: '❌ Unknown action. Use start|stop|status', ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
    }
  },
};
