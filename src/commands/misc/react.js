const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  deleted: false,
  testOnly: false,
  name: 'reactspam',
  description: 'Bot will react/unreact to every new message by a specific user for a given time.',
  options: [
    {
      name: 'user_id',
      description: 'The ID of the user to track',
      required: true,
      type: ApplicationCommandOptionType.String,
    },
    {
      name: 'emoji',
      description: 'Emoji to use for spamming',
      required: true,
      type: ApplicationCommandOptionType.String,
    },
    {
      name: 'duration',
      description: 'How long to keep tracking (in minutes)',
      required: false,
      type: ApplicationCommandOptionType.Integer,
    }
  ],
  permissionsRequired: [],
  botPermissions: [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.ReadMessageHistory,
  ],

  callback: async (client, interaction) => {
    const userId = interaction.options.getString('user_id');
    const emoji = interaction.options.getString('emoji');
    const durationMinutes = interaction.options.getInteger('duration') ?? 60;
    const interval = 1; // ms between react/unreact
    const endTime = Date.now() + durationMinutes * 60_000;

    const targetUser = await client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      return interaction.reply({
        content: '❌ Invalid user ID.',
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: `🌀 Will react to messages from **${targetUser.tag}** for ${durationMinutes} minute(s) with ${emoji}.`,
      ephemeral: true,
    });

    let currentTrackedMessage = null;
    let spamLoopRunning = false;
    let spamLoopCancelled = false;

    const startSpamLoop = async (message) => {
      spamLoopCancelled = false;
      spamLoopRunning = true;

      while (!spamLoopCancelled && Date.now() < endTime) {
        try {
          await message.react(emoji);
          await new Promise((r) => setTimeout(r, interval));
          await message.reactions.resolve(emoji)?.users.remove(client.user.id);
          await new Promise((r) => setTimeout(r, interval));
        } catch (err) {
          console.error('Reaction loop error:', err);
          break;
        }
      }

      spamLoopRunning = false;
    };

    const messageListener = async (msg) => {
      if (msg.author.id !== userId || msg.author.bot) return;
      if (!msg.guild || msg.guild.id !== interaction.guildId) return;

      // Stop previous loop if it’s still running
      if (spamLoopRunning) {
        spamLoopCancelled = true;
        while (spamLoopRunning) await new Promise(r => setTimeout(r, 5)); // wait until fully stopped
      }

      currentTrackedMessage = msg;
      startSpamLoop(msg);
    };

    client.on('messageCreate', messageListener);

    // Cleanup
    setTimeout(() => {
      spamLoopCancelled = true;
      client.off('messageCreate', messageListener);
      console.log(`⏱️ Stopped tracking user ${userId} after ${durationMinutes} minute(s).`);
    }, durationMinutes * 60_000);
  },
};
