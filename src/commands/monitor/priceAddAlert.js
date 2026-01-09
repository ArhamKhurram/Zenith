const { ApplicationCommandOptionType } = require('discord.js');
const priceMonitor = require('../../utils/priceMonitor');

module.exports = {
  deleted: false,
  name: 'price-add-alert',
  description: 'Add a token price alert (multi-chain, uses Birdeye prices).',
  options: [
    { name: 'token', description: 'Token address/identifier', type: ApplicationCommandOptionType.String, required: true },
    { name: 'target', description: 'Target price in USD', type: ApplicationCommandOptionType.Number, required: true },
    { name: 'webhook', description: 'Your Discord webhook URL to receive alert', type: ApplicationCommandOptionType.String, required: true },
    { name: 'name', description: 'Display name to show in alerts (optional)', type: ApplicationCommandOptionType.String, required: false },
  ],

  callback: async (client, interaction) => {
    try {
      const token = interaction.options.getString('token');
      const target = interaction.options.getNumber('target');
      const webhook = interaction.options.getString('webhook');
      const name = interaction.options.getString('name') || interaction.user.username;

      const alert = priceMonitor.addAlert({ user_name: name, token_address: token, target_price: target, discord_webhook_url: webhook });
      return interaction.reply({ content: `✅ Alert added (id: ${alert.id})`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ Failed to add alert: ${err.message}`, ephemeral: true });
    }
  },
};
