const axios = require('axios');
const PushoverConfig = require('../models/PushoverConfig');

const alert = async (guildId, message, options = {}, type = 'alert') => {
  try {
    const config = await PushoverConfig.findOne({ guildId });
    if (!config || !config.enabled) throw new Error('Pushover not configured or disabled.');

    const params = new URLSearchParams();
    const targetKey = type === 'degen-alert' ? config.degenGroupKey : config.groupKey;
    if (!targetKey) throw new Error(`Missing ${type} group key.`);

    params.append('token', config.apiKey);
    params.append('user', targetKey);
    params.append('message', message);
    if (options.title) params.append('title', options.title);
    if (options.url) params.append('url', options.url);
    params.append('priority', 1);

    await axios.post('https://api.pushover.net/1/messages.json', params);
    return true;
  } catch (err) {
    console.error(`Pushover send error:`, err.message || err);
    throw err;
  }
};

module.exports = alert;
