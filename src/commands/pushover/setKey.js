const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require('discord.js');
const PushoverConfig = require('../../models/PushoverConfig');

module.exports = {
  deleted: false,
  name: 'setkey',
  description: 'Link your personal Pushover user key.',
  options: [
    {
      name: 'key',
      description: 'Your Pushover user key.',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  permissionsRequired: [],
  botPermissions: [PermissionFlagsBits.SendMessages],

  callback: async (client, interaction) => {
    const userKey = interaction.options.getString('key');

    await PushoverConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { $set: { [`users.${interaction.user.id}`]: userKey } },
      { upsert: true }
    );

    await interaction.reply('✅ Your key has been linked.');
  },
};
