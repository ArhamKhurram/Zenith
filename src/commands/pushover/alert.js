const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require('discord.js');
const sendAlert = require('../../utils/sendAlert');
const PushoverConfig = require('../../models/PushoverConfig');

module.exports = {
  deleted: false,
  name: 'alert',
  description: 'Send a Pushover alert to the server’s configured group.',
  options: [
    {
      name: 'message',
      description: 'Message to send via Pushover.',
      required: true,
      type: ApplicationCommandOptionType.String,
    },
    {
      name: 'title',
      description: 'Optional title for the alert.',
      type: ApplicationCommandOptionType.String,
    },
    {
      name: 'url',
      description: 'Optional URL to include.',
      type: ApplicationCommandOptionType.String,
    },
  ],
  permissionsRequired: [],
  botPermissions: [PermissionFlagsBits.SendMessages],

  callback: async (client, interaction) => {
    const message = interaction.options.getString('message');
    const title = interaction.options.getString('title');
    const url = interaction.options.getString('url');

    const config = await PushoverConfig.findOne({ guildId: interaction.guild.id });
    if (!config) {
      return interaction.reply({ content: '❌ Pushover is not configured for this server.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (config.alertRole && !member.roles.cache.has(config.alertRole)) {
      return interaction.reply({ content: '❌ You do not have the alert role required to use this command.', ephemeral: true });
    }

    try {
      await sendAlert(interaction.guild.id, message, { title, url }, 'alert');
      await interaction.reply('✅ Alert sent to the group.');
    } catch (err) {
      console.error('Alert error:', err);
      await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
