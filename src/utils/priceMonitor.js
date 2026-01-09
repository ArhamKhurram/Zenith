const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Multi-chain token price monitor using Birdeye multi_price endpoint.
 * Stores alerts in-memory with optional persistence to fnf-monitor-alerts.json
 */
class PriceMonitor {
  constructor() {
    this.alerts = []; // { id, user_name, token_address, target_price, discord_webhook_url }
    // Birdeye is a public endpoint; API key header is optional. Only use BIRDEYE_API_KEY if set.
    this.apiKey = process.env.BIRDEYE_API_KEY || null;
    this.pollIntervalMs = 10000; // 10s
    this.timer = null;
    this.lastCheck = null;
    this.apiStatus = { ok: true, lastError: null };
    this.callTimestamps = [];
    this.persistPath = path.join(__dirname, '..', '..', 'fnf-monitor-alerts.json');
    this.maxPerRequest = 100;
    this._loadFromDisk().catch(() => {});
  }

  async _loadFromDisk() {
    try {
      const raw = await fs.readFile(this.persistPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.alerts = parsed;
    } catch (e) {
      // ignore if missing
    }
  }

  async _saveToDisk() {
    try {
      await fs.writeFile(this.persistPath, JSON.stringify(this.alerts, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to persist monitor alerts:', e && e.message);
    }
  }

  _validateAddress(address) {
    if (!address || typeof address !== 'string') return false;
    const s = address.trim();
    // Accept common formats: Ethereum-style 0x... (40 hex), Solana base58-ish, or generic non-whitespace token identifiers
    const eth = /^0x[0-9a-fA-F]{40}$/;
    const base58 = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
    const generic = /^[\w\-:\.@]{8,128}$/;
    return eth.test(s) || base58.test(s) || generic.test(s);
  }

  _detectChain(address) {
    if (!address || typeof address !== 'string') return 'solana';
    const s = address.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(s)) return 'ethereum';
    if (/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(s)) return 'solana';
    // fallback default
    return 'solana';
  }

  _validateWebhook(url) {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('https://discord.com/api/webhooks/') || url.startsWith('https://canary.discord.com/api/webhooks/') || url.startsWith('https://ptb.discord.com/api/webhooks/');
  }

  addAlert({ user_name, token_address, target_price, discord_webhook_url }) {
    if (!user_name || !token_address || !target_price || !discord_webhook_url) throw new Error('Missing fields');
    if (!this._validateAddress(token_address)) throw new Error('Invalid token address');
    if (!this._validateWebhook(discord_webhook_url)) throw new Error('Invalid webhook URL');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const alert = { id, user_name: String(user_name), token_address: String(token_address), target_price: Number(target_price), discord_webhook_url: String(discord_webhook_url) };
    this.alerts.push(alert);
    this._saveToDisk().catch(() => {});
    return alert;
  }

  removeAlert(id) {
    const before = this.alerts.length;
    this.alerts = this.alerts.filter(a => a.id !== id);
    if (this.alerts.length !== before) this._saveToDisk().catch(() => {});
    return before !== this.alerts.length;
  }

  listAlerts() {
    return this.alerts.slice();
  }

  start() {
    if (this.timer) return false;
    this.timer = setInterval(() => this._tick().catch(err => console.error('priceMonitor tick error:', err)), this.pollIntervalMs);
    // run immediately
    this._tick().catch(err => console.error('priceMonitor initial tick error:', err));
    return true;
  }

  stop() {
    if (!this.timer) return false;
    clearInterval(this.timer);
    this.timer = null;
    return true;
  }

  status() {
    return {
      running: !!this.timer,
      alerts: this.alerts.length,
      lastCheck: this.lastCheck,
      apiStatus: this.apiStatus,
      callsLastMinute: this.callTimestamps.filter(ts => Date.now() - ts < 60000).length,
    };
  }

  async _fetchPrices(addresses, chain = 'solana') {
    if (!Array.isArray(addresses) || addresses.length === 0) return {};
    // Rate limiting: record and ensure we don't exceed ~60/min
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter(ts => now - ts < 60000);
    if (this.callTimestamps.length >= 55) {
      throw new Error('Rate limit would be exceeded, skipping fetch');
    }

    const endpoint = `https://public-api.birdeye.so/defi/multi_price?list_address=${addresses.join(',')}`;
    const headers = {};
    if (this.apiKey) headers['X-API-KEY'] = this.apiKey;
    // Birdeye requires chain header to disambiguate results
    headers['x-chain'] = chain;
    const resp = await axios.get(endpoint, { headers, timeout: 15000 });
    this.callTimestamps.push(now);
    return resp.data && resp.data.data ? resp.data.data : {};
  }

  async _tick() {
    if (!this.alerts || this.alerts.length === 0) {
      this.lastCheck = new Date().toISOString();
      return;
    }

    // extract unique addresses and group by detected chain
    const uniqueAll = [...new Set(this.alerts.map(a => a.token_address))];
    const grouped = {};
    for (const addr of uniqueAll) {
      const chain = this._detectChain(addr);
      grouped[chain] = grouped[chain] || [];
      grouped[chain].push(addr);
    }

    try {
      // fetch per-chain (each up to maxPerRequest)
      const combinedData = {};
      for (const chain of Object.keys(grouped)) {
        const addrs = grouped[chain].slice(0, this.maxPerRequest);
        if (addrs.length === 0) continue;
        const data = await this._fetchPrices(addrs, chain);
        Object.assign(combinedData, data || {});
      }
      const data = combinedData;
      this.lastCheck = new Date().toISOString();
      this.apiStatus = { ok: true, lastError: null };

      // Map token -> price
      const priceMap = {};
      for (const addr of Object.keys(data)) {
        const entry = data[addr];
        const price = entry && (entry.value || entry.price || entry.usd || entry.value_usd) ? (entry.value || entry.price || entry.usd || entry.value_usd) : null;
        priceMap[addr] = Number(price || 0);
      }

      // Iterate alerts copy so we can remove triggered ones
      const alertsCopy = this.alerts.slice();
      for (const alert of alertsCopy) {
        const curPrice = priceMap[alert.token_address] || 0;
        if (curPrice >= alert.target_price) {
          // trigger
          try {
            await this._sendWebhook(alert, curPrice);
          } catch (e) {
            console.warn('Failed to send webhook for alert', alert.id, e && e.message);
          }
          this.removeAlert(alert.id);
        }
      }
    } catch (err) {
      this.apiStatus = { ok: false, lastError: err && err.message };
      this.lastCheck = new Date().toISOString();
      console.error('priceMonitor fetch error:', err && err.message);
    }
  }

  async _sendWebhook(alert, currentPrice) {
    const payload = {
      embeds: [
        {
          title: `Price Alert: ${alert.token_address}`,
          description: `Target reached for **${alert.user_name}**`,
          color: 16753920,
          fields: [
            { name: 'Token', value: alert.token_address, inline: false },
            { name: 'Target Price', value: String(alert.target_price), inline: true },
            { name: 'Current Price', value: String(currentPrice), inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      username: 'Price Monitor',
    };

    await axios.post(alert.discord_webhook_url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
  }
}

module.exports = new PriceMonitor();
