(async () => {
  // Minimal mock for the Rick message
  const handler = require('./src/events/messageCreate/isRick.js');
  const fakeMsg = {
    author: { id: '1081815963990761542', bot: true },
    guild: { id: '914516203609931816' },
    content: "🍀 **[air coin](https://four.meme/token/0x338...) [6M/9.5K%] - 空气币/WBNB** [⬆︎](https://discord.com/)",
    embeds: [],
    react: async () => {},
    reply: async (payload) => {
      if (payload && payload.embeds) console.log('mock reply embed ->', JSON.stringify(payload.embeds[0], null, 2));
      else console.log('mock reply ->', payload);
    },
    channel: { send: async (payload) => { if (payload && payload.embeds) console.log('mock channel.send ->', JSON.stringify(payload.embeds[0], null, 2)); else console.log('mock channel.send ->', payload); } },
  };

  try {
    await handler(null, fakeMsg);
    console.log('handler finished');
  } catch (e) {
    console.error('handler error', e);
  }
})();
