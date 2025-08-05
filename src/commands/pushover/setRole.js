const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require('discord.js');
const PushoverConfig = require('../../models/PushoverConfig');

module.exports = {
  deleted: false,
  name: 'setrole',
  description: 'Set which role is allowed to use alert commands.',
  options: [
    {
      name: 'type',
      description: 'Which permission to assign this role to.',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        {
          name: 'Normal Alert Permission',
          value: 'alertRole',
        },
        {
          name: 'Degen Alert Permission',
          value: 'degenAlertRole',
        },
        {
          name: 'FNF Alert Permission',
          value: 'fnfAlertRole',
        },
      ],
    },
    {
      name: 'role',
      description: 'The role that should be allowed to use the alert command.',
      type: ApplicationCommandOptionType.Role,
      required: true,
    },
  ],
  permissionsRequired: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.SendMessages],

  callback: async (client, interaction) => {
    const role = interaction.options.getRole('role');
    const roleType = interaction.options.getString('type'); // 'alertRole', 'degenAlertRole', or 'fnfAlertRole'

    if (!['alertRole', 'degenAlertRole', 'fnfAlertRole'].includes(roleType)) {
      return interaction.reply({ content: '❌ Invalid type specified.', ephemeral: true });
    }

    await PushoverConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { [roleType]: role.id },
      { upsert: true }
    );

    const readable = roleType === 'alertRole' ? 'normal alert' : 
                    roleType === 'degenAlertRole' ? 'degen alert' : 'FNF alert';

    await interaction.reply(`✅ Set <@&${role.id}> as the **${readable}** permission role.`);
  },
};
