const PushoverConfig = require('../../models/PushoverConfig');
const { devs } = require('../../../config.json'); // Make sure you have this set

module.exports = {
  deleted: false,
  name: 'configurepushover',
  description: 'Configure this server’s Pushover keys.',
  options: [
    {
      name: 'api',
      description: 'Pushover API token.',
      type: 3,
      required: true,
    },
    {
      name: 'group',
      description: 'Group key to alert the server.',
      type: 3,
      required: true,
    },
    {
      name: 'degen_group',
      description: 'Optional Degen group key.',
      type: 3,
      required: false,
    },
  ],


  callback: async (client, interaction) => {
    if (interaction.user.id !== devs[0]) {
      return interaction.reply({
        content: '❌ Only the bot developer can use this command.',
        ephemeral: true,
      });
    }

    const { guild } = interaction;
    const apiKey = interaction.options.getString('api');
    const groupKey = interaction.options.getString('group');
    const degenGroupKey = interaction.options.getString('degen_group');

    await PushoverConfig.findOneAndUpdate(
      { guildId: guild.id },
      { apiKey, groupKey, degenGroupKey, enabled: true },
      { upsert: true }
    );

    await interaction.reply('✅ Server Pushover config saved.');
  },
};
