const { ApplicationCommandOptionType } = require('discord.js');
const axios = require('axios');
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

      // Fetch token metadata from Jupiter to get ticker and name for display
      let tokenTicker = null;
      let tokenName = null;
      try {
        const headers = {};
        if (priceMonitor && priceMonitor.apiKey) headers['x-api-key'] = priceMonitor.apiKey;
        const resp = await axios.get(`https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(token)}`, { headers, timeout: 10000 });
        const body = resp.data || {};
        const tokens = body.tokens || body.data || body;
        let first = null;
        if (Array.isArray(tokens) && tokens.length) first = tokens[0];
        else if (tokens && typeof tokens === 'object') {
          const keys = Object.keys(tokens);
          if (keys.length) first = tokens[keys[0]];
        }
        if (first) {
          tokenTicker = first.symbol || first.ticker || first.tokenSymbol || null;
          tokenName = first.name || first.tokenName || null;
        }
      } catch (e) {
        // ignore metadata fetch errors — still allow alert creation
      }

      const alert = priceMonitor.addAlert({
        user_name: name,
        token_address: token,
        token_ticker: tokenTicker,
        token_name: tokenName,
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
