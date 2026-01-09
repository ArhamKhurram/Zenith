const { ApplicationCommandOptionType } = require('discord.js');
const priceMonitor = require('../../utils/priceMonitor');

module.exports = {
  deleted: false,
  name: 'price-add-alert',
  description: 'Add a token price alert (Jupiter prices). Bot will pushover you and DM on trigger.',
  options: [
    { name: 'token', description: 'Token address/identifier', type: ApplicationCommandOptionType.String, required: true },
    { name: 'target', description: 'Target price in USD', type: ApplicationCommandOptionType.Number, required: true },
    { name: 'operator', description: 'Trigger when price is above or below the target', type: ApplicationCommandOptionType.String, required: false, choices: [
      { name: 'above', value: 'above' },
      { name: 'below', value: 'below' }
    ] },
    { name: 'name', description: 'Display name to show in alerts (optional)', type: ApplicationCommandOptionType.String, required: false },
  ],

  callback: async (client, interaction) => {
    try {
      const token = interaction.options.getString('token');
      const target = interaction.options.getNumber('target');
      const operator = interaction.options.getString('operator') || 'above';
      const name = interaction.options.getString('name') || interaction.user.username;

      // Only Solana supported for now — validate via monitor's detection
      try {
        const detected = typeof priceMonitor._detectChain === 'function' ? priceMonitor._detectChain(token) : 'solana';
        if (detected !== 'solana') {
          return interaction.reply({ content: '❌ Only Solana token tracking is supported for now. Use a Solana token address.', ephemeral: true });
        }
      } catch (e) {
        return interaction.reply({ content: '❌ Invalid token address.', ephemeral: true });
      }

      const alert = priceMonitor.addAlert({
        user_name: name,
        token_address: token,
        target_price: target,
        operator,
        user_id: interaction.user.id,
        guild_id: interaction.guildId,
      });
      return interaction.reply({ content: `✅ Alert added (id: ${alert.id})`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ Failed to add alert: ${err.message}`, ephemeral: true });
    }
  },
};
