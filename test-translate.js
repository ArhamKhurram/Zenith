const mod = require('@vitalets/google-translate-api');
console.log('module keys:', Object.keys(mod));
const fn = (typeof mod === 'function') ? mod : (mod && typeof mod.translate === 'function' ? mod.translate.bind(mod) : (mod && typeof mod.default === 'function' ? mod.default : null));
(async () => {
  if (!fn) return console.error('No translate function found on module');
  try {
    const res = await fn('空气币', { to: 'en' });
    console.log('RAW RESPONSE:', res);
    if (typeof res === 'string') console.log('EXTRACTED TEXT:', res);
    else if (res && res.text) console.log('EXTRACTED TEXT:', res.text);
    else {
      if (Array.isArray(res)) console.log('EXTRACTED TEXT (array first):', res[0]);
      else console.log('NO TEXT FOUND IN RESPONSE');
    }
  } catch (e) {
    console.error('TRANSLATE ERROR:', e && e.message ? e.message : e);
  }
})();
