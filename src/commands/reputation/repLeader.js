module.exports = {
  deleted: true,
  name: 'repleaderboard',
  description: 'The reputation system has been removed.',
  options: [],
  callback: async (client, interaction) => {
    return interaction.reply({ content: '⚠️ The reputation system has been removed.', ephemeral: true });
  },
};
