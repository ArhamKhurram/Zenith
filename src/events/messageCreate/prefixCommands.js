module.exports = async (client, message) => {
  try {
    // Only consider text messages from users
    if (message.author.bot) return;
    if (!message.content || typeof message.content !== 'string') return;

    const PREFIX = 'z!';
    if (!message.content.startsWith(PREFIX)) return;

    const withoutPrefix = message.content.slice(PREFIX.length).trim();
    if (!withoutPrefix) return;

    const parts = withoutPrefix.split(/\s+/);
    const cmd = parts.shift().toLowerCase();

    // support: z!fnf and z!fnf-push
    if (cmd !== 'fnf' && cmd !== 'fnf-push') return;

    // Build a minimal mock interaction that reuses the slash command logic
    const remaining = withoutPrefix.slice(cmd.length).trim();

    const mockInteraction = {
      guild: message.guild,
      user: message.author,
      channel: message.channel,
      options: {
        getString: (name) => {
          if (name === 'message') return remaining || null;
          if (name === 'title') return null;
          if (name === 'url') return null;
          return null;
        },
      },
      reply: async (payload) => {
        // emulate interaction.reply by sending to channel
        if (!message.channel || typeof message.channel.send !== 'function') return null;
        const content = typeof payload === 'string' ? payload : (payload.content || JSON.stringify(payload));
        const sent = await message.channel.send(content);
        mockInteraction._replyMsg = sent;
        return sent;
      },
      editReply: async (payload) => {
        try {
          if (mockInteraction._replyMsg && typeof mockInteraction._replyMsg.edit === 'function') {
            return await mockInteraction._replyMsg.edit(typeof payload === 'string' ? payload : (payload.content || JSON.stringify(payload)));
          }
          // fallback: send a new message
          return await message.channel.send(typeof payload === 'string' ? payload : (payload.content || JSON.stringify(payload)));
        } catch (e) {
          // ignore
          return null;
        }
      }
    };

    // require the existing command module and call its callback
    try {
      const fnfCmd = require('../../commands/pushover/fnfPush.js');
      if (fnfCmd && typeof fnfCmd.callback === 'function') {
        await fnfCmd.callback(client, mockInteraction);
      }
    } catch (err) {
      console.error('Prefix fnf handler error:', err);
      try { await message.channel.send('❌ Error running fnf command (prefix).'); } catch (_) {}
    }
  } catch (err) {
    console.error('prefixCommands handler error:', err);
  }
};
