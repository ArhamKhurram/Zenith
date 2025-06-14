// /rep command (shows reputation of a user)
const {
  ApplicationCommandOptionType,
} = require('discord.js');
const Reputation = require('../../models/Reputation');

module.exports = {
  deleted: false,
  name: 'rep',
  description: 'Check someone’s reputation.',
  options: [
    {
      name: 'user',
      description: 'User to check rep for.',
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],

  callback: async (client, interaction) => {
    const user = interaction.options.getUser('user') || interaction.user;

    try {
      const rep = await Reputation.findOne({
        userId: user.id,
        guildId: interaction.guild.id,
      });

      if (!rep) {
        return interaction.reply({
          content: `ℹ️ ${user.username} has no reputation yet.`,
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: `📊 **Reputation for ${user.username}**:
👍 Good Rep: ${rep.goodRep}
👎 Bad Rep: ${rep.badRep}
⭐ Total: ${rep.totalReputation}`,
      });

    } catch (err) {
      console.error('Error fetching rep:', err);
      await interaction.reply({
        content: '⚠️ Failed to fetch reputation data.',
        ephemeral: true,
      });
    }
  },
};
