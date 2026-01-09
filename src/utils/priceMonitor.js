const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const PushoverConfig = require('../models/PushoverConfig');

/**
 * Multi-chain token price monitor using Jupiter price API (api.jup.ag).
 * Stores alerts in-memory with optional persistence to fnf-monitor-alerts.json
 */
class PriceMonitor {
  constructor() {
    this.alerts = []; // { id, user_name, token_address, target_price, operator, user_id, guild_id }
    // Jupiter public API key (optional). Set JUPITER_API_KEY if you want to supply a key.
    this.apiKey = process.env.JUPITER_API_KEY || null;
    this.pollIntervalMs = 10000; // 10s
    this.timer = null;
    this.lastCheck = null;
    this.apiStatus = { ok: true, lastError: null };
    this.callTimestamps = [];
    this.persistPath = path.join(__dirname, '..', '..', 'fnf-monitor-alerts.json');
    this.maxPerRequest = 100;
    this._loadFromDisk().catch(() => {});
  }

  // Inject the discord client so monitor can post messages via the bot (channel/DM)
  setClient(client) {
    this.client = client;
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

  // Chain detection remains for future use; currently Jupiter handles multi-token price queries.
  _detectChain(address) {
    if (!address || typeof address !== 'string') return 'solana';
    const s = address.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(s)) return 'ethereum';
    if (/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(s)) return 'solana';
    return 'solana';
  }

  addAlert({ user_name, token_address, target_price, operator = 'above', user_id = null, guild_id = null }) {
    if (!user_name || !token_address || !target_price || !user_id || !guild_id) throw new Error('Missing fields');
    if (!this._validateAddress(token_address)) throw new Error('Invalid token address');

    const allowedOps = ['above', 'below'];
    if (!allowedOps.includes(operator)) operator = 'above';

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const alert = {
      id,
      user_name: String(user_name),
      token_address: String(token_address),
      target_price: Number(target_price),
      operator,
      user_id: String(user_id),
      guild_id: String(guild_id),
    };
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

  async _fetchPrices(addresses) {
    if (!Array.isArray(addresses) || addresses.length === 0) return {};
    // Rate limiting: record and ensure we don't exceed ~60/min
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter(ts => now - ts < 60000);
    if (this.callTimestamps.length >= 55) {
      throw new Error('Rate limit would be exceeded, skipping fetch');
    }

    // Jupiter API: supports multiple ids comma-separated
    const ids = addresses.join(',');
    const endpoint = `https://api.jup.ag/price/v3?ids=${encodeURIComponent(ids)}`;
    const headers = {};
    if (this.apiKey) headers['x-api-key'] = this.apiKey;

    const resp = await axios.get(endpoint, { headers, timeout: 15000 });
    this.callTimestamps.push(now);

    // Normalize response into mapping addr -> numeric price
    const result = {};
    const body = resp.data || {};
    // Jupiter may return an object mapping ids to price objects, or a `data` field
    const source = (body && typeof body === 'object') ? (body.data || body) : {};
    for (const k of Object.keys(source)) {
      const entry = source[k] || {};
      const price = entry.price ?? entry.priceUsd ?? entry.price_usd ?? entry.usd ?? entry.value ?? null;
      result[k] = Number(price || 0);
    }
    return result;
  }

  async _tick() {
    if (!this.alerts || this.alerts.length === 0) {
      this.lastCheck = new Date().toISOString();
      return;
    }

    // extract unique addresses (up to maxPerRequest) and fetch in one batched call
    const unique = [...new Set(this.alerts.map(a => a.token_address))].slice(0, this.maxPerRequest);
    try {
      const data = await this._fetchPrices(unique);
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
        let triggered = false;
        if (alert.operator === 'above') triggered = curPrice >= alert.target_price;
        if (alert.operator === 'below') triggered = curPrice <= alert.target_price;

        if (triggered) {
          try {
            // Try to send Pushover to the user's linked key for this guild
            try {
              const cfg = await PushoverConfig.findOne({ guildId: alert.guild_id });
              if (cfg && cfg.users && cfg.users.has(alert.user_id)) {
                const userKey = cfg.users.get(alert.user_id);
                const params = new URLSearchParams();
                params.append('token', cfg.apiKey);
                params.append('user', userKey);
                params.append('message', `Price alert for ${alert.token_address}: target ${alert.operator} ${alert.target_price} reached (current ${curPrice}).`);
                params.append('title', `Price Alert: ${alert.token_address}`);
                params.append('priority', 1);
                await axios.post('https://api.pushover.net/1/messages.json', params, { timeout: 10000 });
              }
            } catch (e) {
              console.warn('Pushover send failed for alert', alert.id, e && e.message);
            }

            // Also DM the user via the bot (best-effort)
            try {
              if (this.client && alert.user_id) {
                const user = await this.client.users.fetch(alert.user_id).catch(() => null);
                if (user && typeof user.send === 'function') {
                  const embed = {
                    title: `Price Alert: ${alert.token_address}`,
                    description: `Target ${alert.operator} ${alert.target_price} reached. Current: ${curPrice}`,
                    color: 16753920,
                    fields: [
                      { name: 'Token', value: alert.token_address, inline: false },
                      { name: 'Target', value: String(alert.target_price), inline: true },
                      { name: 'Current', value: String(curPrice), inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                  };
                  await user.send({ embeds: [embed] }).catch(() => null);
                }
              }
            } catch (e) {
              console.warn('DM send failed for alert', alert.id, e && e.message);
            }
          } catch (e) {
            console.warn('Failed to process alert', alert.id, e && e.message);
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
}

module.exports = new PriceMonitor();
