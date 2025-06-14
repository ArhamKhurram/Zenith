const { EmbedBuilder } = require('discord.js');
const Reputation = require('../../models/Reputation');

module.exports = {
  deleted: false,
  name: 'repleaderboard',
  description: 'See the top users with the highest reputation.',

  callback: async (client, interaction) => {
    try {
      const topUsers = await Reputation.find({ guildId: interaction.guild.id })
        .sort({ totalReputation: -1 })
        .limit(10);

      if (topUsers.length === 0) {
        return interaction.reply('No reputation data available yet.');
      }

      const leaderboard = topUsers
        .map((rep, index) => {
          const user = interaction.guild.members.cache.get(rep.userId);
          return `**#${index + 1}** - ${user ? user.user.tag : `<@${rep.userId}>`} → ${rep.totalReputation} rep`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🏆 Reputation Leaderboard')
        .setDescription(leaderboard)
        .setColor(0xFFD700)
        .setFooter({ text: 'Top 10 based on total reputation' });

      await interaction.reply({ embeds: [embed] });

    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      await interaction.reply({
        content: '⚠️ Failed to fetch leaderboard.',
        ephemeral: false,
      });
    }
  },
};
