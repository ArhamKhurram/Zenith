// // Single clean implementation for Rick auto-translate
// let translateFn = null;
// try {
//   const t = require('@vitalets/google-translate-api');
//   if (typeof t === 'function') translateFn = t;
//   else if (t && typeof t.default === 'function') translateFn = t.default;
//   else if (t && typeof t.translate === 'function') translateFn = t.translate.bind(t);
//   else translateFn = null;
// } catch (_) {
//   translateFn = null;
// }

// const DEBUG = (process.env.DEBUG_RICK === 'true' || process.env.DEBUG_RICK === '1');
// const debug = (...args) => { if (DEBUG) console.log(...args); };

// // Simple in-memory cache
// const translateCache = new Map();

// const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// const _sanitize = (t) => {
//   if (!t) return '';
//   let s = String(t).replace(/[\u200B\uFEFF]/g, '');
//   s = s.replace(/[\*\_\`\~]/g, '');
//   s = s.replace(/^[^0-9A-Za-z\u4e00-\u9fff]+|[^0-9A-Za-z\u4e00-\u9fff]+$/g, '');
//   return s.replace(/\s+/g, ' ').trim();
// };

// // Prefer Google Translate v2 REST API if an API key is available, else fall back to module
// const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_TRANSLATE_KEY;

// const callGoogleTranslateV2 = (apiKey, text) => {
//   return new Promise((resolve, reject) => {
//     try {
//       const https = require('https');
//       const body = JSON.stringify({ q: text, target: 'en', format: 'text' });
//       const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
//       const u = new URL(url);
//       const opts = {
//         hostname: u.hostname,
//         path: u.pathname + u.search,
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Content-Length': Buffer.byteLength(body),
//         },
//       };

//       const req = https.request(opts, (res) => {
//         let data = '';
//         res.on('data', (chunk) => (data += chunk));
//         res.on('end', () => {
//           try {
//             if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
//             const parsed = JSON.parse(data);
//             const translated = parsed?.data?.translations && parsed.data.translations[0] && parsed.data.translations[0].translatedText;
//             if (translated) return resolve(translated);
//             return reject(new Error('No translation in response'));
//           } catch (err) {
//             return reject(err);
//           }
//         });
//       });

//       req.on('error', (err) => reject(err));
//       req.write(body);
//       req.end();
//     } catch (err) {
//       reject(err);
//     }
//   });
// };

// const _callTranslate = async (text, retry = 0) => {
//   if (!text) return '';

//   // Cache hit
//   if (translateCache.has(text)) {
//     debug('Cache hit for:', text);
//     return translateCache.get(text);
//   }

//   try {
//     debug('Translating:', text);

//     let output = '';

//     if (GOOGLE_API_KEY) {
//       try {
//         output = await callGoogleTranslateV2(GOOGLE_API_KEY, text);
//         debug('Google API translate result:', output);
//       } catch (e) {
//         debug('Google API translate error:', e && e.message ? e.message : e);
//         output = '';
//       }
//     }

//     // Fallback to installed module if Google API didn't produce output
//     if (!output && translateFn) {
//       const res = await translateFn(text, { to: 'en' });
//       debug('module translate raw response:', res);
//       if (!res) output = '';
//       else if (typeof res === 'string') output = res;
//       else if (res.text) output = res.text;
//       else {
//         const flatten = (obj) => {
//           if (!obj) return null;
//           if (typeof obj === 'string') return obj;
//           if (Array.isArray(obj)) for (const i of obj) {
//             const v = flatten(i); if (v) return v;
//           }
//           else if (typeof obj === 'object') for (const k of Object.keys(obj)) {
//             const v = flatten(obj[k]); if (v) return v;
//           }
//           return null;
//         };
//         output = flatten(res) || '';
//       }
//     }

//     // Cache and rate-limit
//     translateCache.set(text, output);
//     await sleep(1000);
//     return output;
//   } catch (e) {
//     const msg = e?.message || String(e);
//     debug('Translation error:', msg);
//     if (msg.includes('Too Many Requests') && retry < 3) {
//       const wait = 2000 * (retry + 1);
//       debug(`Rate-limited, waiting ${wait}ms and retrying (${retry + 1}/3)...`);
//       await sleep(wait);
//       return _callTranslate(text, retry + 1);
//     }
//     return '';
//   }
// };

// module.exports = async (client, message) => {
//   const rickId = '1081815963990761542';
//   // Hard-coded allowed guild IDs - add any guild IDs you want this to work in
//   const allowedGuildIds = new Set([
//     '914516203609931816',
//     '1411252468058427425'
//   ]);

//   if (message.author.bot && message.author.id !== rickId) return;
//   if (!(message.author.id === rickId && message.guild && allowedGuildIds.has(message.guild.id))) return;

//   // Only process when Rick posts (embeds optional)
//   try {
//     await message.react('✅');
//     await message.react('❌');
//   } catch (err) {
//     debug('Failed to react to Rick embed:', err);
//   }

//     try {
//     const content = message.content || '';
//     // Keep markdown link labels: [label](url) -> label
//     let cleaned = String(content)
//       .replace(/\[([^\]]+)\]\((?:https?:\/\/\S+)\)/gi, '$1')
//       // remove bold markers **...** so they don't hide text
//       .replace(/\*\*(.*?)\*\*/g, '$1')
//       // strip remaining raw URLs
//       .replace(/https?:\/\/\S+/gi, '')
//       // remove bracketed stats like [6.6M/10.1K%] (only if contains digits or %)
//       .replace(/\[[^\]]*[0-9%][^\]]*\]/g, '')
//       .replace(/\(.*?\)/g, '')
//       .replace(/<a?:\w+:\d+>/g, '')
//       .replace(/[↑↓⬆︎⬇︎]/g, '')
//       .trim();

//     // Keep ASCII, slash, hyphen, dot, space and CJK; replace other chars with space
//     cleaned = cleaned.replace(/[^0-9A-Za-z\/\-\.\s\u4e00-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();

//     // Prefer extracting left name from original content so markdown link labels are preserved
//     const partsOriginal = (content || '').split(' - ');
//     const leftOriginal = partsOriginal.length >= 2 ? partsOriginal.slice(0, -1).join(' - ').trim() : content;
//     const rightOriginal = partsOriginal.length >= 2 ? partsOriginal.slice(-1)[0].trim() : '';

//     // If leftOriginal contains a markdown link label [label](url), prefer that label
//     let leftFromOriginal = leftOriginal;
//     const mdLabel = leftOriginal.match(/\[([^\]]+)\]\((?:https?:\/\/\S+)\)/i);
//     if (mdLabel && mdLabel[1]) leftFromOriginal = mdLabel[1];

//     // sanitize leftFromOriginal (remove urls, stats, emoji, bold markers)
//     leftFromOriginal = String(leftFromOriginal)
//       .replace(/https?:\/\/\S+/gi, '')
//       .replace(/\[[^\]]*[0-9%][^\]]*\]/g, '')
//       .replace(/<a?:\w+:\d+>/g, '')
//       .replace(/\*\*(.*?)\*\*/g, '$1')
//       .trim();

//     const parts = cleaned.split(' - ');
//     const leftRaw = leftFromOriginal || (parts.length >= 2 ? parts.slice(0, -1).join(' - ').trim() : cleaned);
//     const rightRaw = parts.length >= 2 ? parts.slice(-1)[0].trim() : '';

//     // rightName: text before slash; we ignore the symbol after the slash
//     const rightName = rightRaw.includes('/') ? rightRaw.split('/')[0].trim() : rightRaw;

//     const left = _sanitize(leftRaw);
//     const right = _sanitize(rightName);

//     // RAW DEBUG OUTPUT (developer): show exactly what the parser reads
//     try {
//       debug('--- Rick RAW PARSE ---');
//       debug('original content:', content);
//       debug('cleaned content :', cleaned);
//       debug('leftRaw         :', leftRaw);
//       debug('rightRaw        :', rightRaw);
//       debug('rightName       :', rightName);
//       debug('embed raw       :', message.embeds && message.embeds.length ? message.embeds[0].toJSON() : null);
//       debug('--- end raw ---');
//     } catch (e) {
//       /* ignore debug errors */
//     }

//     const leftHasEng = /[A-Za-z]/.test(left);
//     const leftHasChi = /[\u4e00-\u9fff]/.test(left);
//     const rightHasEng = /[A-Za-z]/.test(right);
//     const rightHasChi = /[\u4e00-\u9fff]/.test(right);

//     const translateIfChinese = async (s) => {
//       if (!s) return '';
//       if (!/[\u4e00-\u9fff]/.test(s)) return s; // already not Chinese
//       const t = await _callTranslate(s);
//       return t || s;
//     };

//     let finalName = '';
//     let finalTicker = '';

//     // Condition 1: English left + Chinese right
//     if (leftHasEng && rightHasChi) {
//       finalName = left;
//       finalTicker = await translateIfChinese(right) || 'unknown';
//     }
//     // Condition 2: Chinese left + English right
//     else if (leftHasChi && rightHasEng) {
//       finalName = right;
//       finalTicker = await translateIfChinese(left) || 'unknown';
//     }
//     // Condition 3: both Chinese
//     else if (leftHasChi && rightHasChi) {
//       finalName = await translateIfChinese(left) || 'unknown';
//       finalTicker = await translateIfChinese(right) || 'unknown';
//     }
//     // fallback: prefer English if present, else translate left then right
//     else {
//       finalName = leftHasEng ? left : (rightHasEng ? right : (await translateIfChinese(left) || await translateIfChinese(right) || 'unknown'));
//       finalTicker = await translateIfChinese(right) || await translateIfChinese(left) || 'unknown';
//     }

//     finalName = finalName && finalName.trim() ? finalName.trim() : 'unknown';
//     finalTicker = finalTicker && finalTicker.trim() ? finalTicker.trim() : 'unknown';

//   // Reply in-channel to the Rick message with a simple embed (title = name, description = ticker)
//   const embed = {
//     title: finalName,
//     description: `Ticker: ${finalTicker}`,
//     color: 0x00AE86,
//   };

//   try {
//     if (message && typeof message.reply === 'function') {
//       await message.reply({ embeds: [embed] });
//     } else if (message && message.channel && typeof message.channel.send === 'function') {
//       await message.channel.send({ embeds: [embed] });
//     } else {
//       // fallback to console when no channel available
//       console.log('EMBED:', embed);
//     }
//   } catch (e) {
//     debug('Failed to send reply:', e);
//   }

//   } catch (err) {
//     debug('Failed to parse/translate Rick message:', err);
//   }
// };
