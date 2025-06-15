const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require('discord.js');
const PushoverConfig = require('../../models/PushoverConfig');
const axios = require('axios');

module.exports = {
  deleted: false,
  name: 'alertuser',
  description: 'Send a private Pushover alert to a specific user.',
  options: [
    {
      name: 'user',
      description: 'User to alert.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'message',
      description: 'Message to send.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  permissionsRequired: [],
  botPermissions: [PermissionFlagsBits.SendMessages],

  callback: async (client, interaction) => {
    const user = interaction.options.getUser('user');
    const message = interaction.options.getString('message');

    const config = await PushoverConfig.findOne({ guildId: interaction.guild.id });
    if (!config || !config.users.has(user.id)) {
      return interaction.reply({ content: '❌ User has not linked their Pushover key.', ephemeral: true });
    }

    const key = config.users.get(user.id);

    try {
      await axios.post('https://api.pushover.net/1/messages.json', new URLSearchParams({
        token: config.apiKey,
        user: key,
        message,
        priority: 1,
      }));

      await interaction.reply(`✅ Alert sent to ${user.username}.`);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
