module.exports = {
  deleted: true,
  name: 'giverep',
  description: 'The reputation system has been removed.',
  options: [],
  callback: async (client, interaction) => {
    return interaction.reply({ content: '⚠️ The reputation system has been removed.', ephemeral: true });
  },
};
