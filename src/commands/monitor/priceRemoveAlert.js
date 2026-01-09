const { ApplicationCommandOptionType } = require('discord.js');
const priceMonitor = require('../../utils/priceMonitor');

module.exports = {
  deleted: false,
  name: 'price-remove-alert',
  description: 'Remove a previously created alert by id.',
  options: [
    { name: 'id', description: 'Alert id to remove', type: ApplicationCommandOptionType.String, required: true },
  ],

  callback: async (client, interaction) => {
    try {
      const id = interaction.options.getString('id');
      const ok = priceMonitor.removeAlert(id);
      if (ok) return interaction.reply({ content: `✅ Removed alert ${id}`, ephemeral: true });
      return interaction.reply({ content: `❌ Alert ${id} not found`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `❌ Failed to remove alert: ${err.message}`, ephemeral: true });
    }
  },
};
