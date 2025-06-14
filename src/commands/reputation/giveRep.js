const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require('discord.js');
const Reputation = require('../../models/Reputation');

module.exports = {
  deleted: false,
  name: 'giverep',
  description: 'Give good or bad rep to a user.',
  options: [
    {
      name: 'user',
      description: 'The user you want to give reputation to.',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'type',
      description: 'Reputation type: good or bad.',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: '👍 Good Rep', value: 'good' },
        { name: '👎 Bad Rep', value: 'bad' },
      ],
    },
    {
      name: 'reason',
      description: 'Optional reason for giving rep.',
      type: ApplicationCommandOptionType.String,
    },
  ],

  callback: async (client, interaction) => {
    const targetUser = interaction.options.getUser('user');
    const repType = interaction.options.getString('type');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ You can’t give rep to yourself!',
        ephemeral: true,
      });
    }

    try {
      let rep = await Reputation.findOne({
        userId: targetUser.id,
        guildId: interaction.guild.id,
      });

      if (!rep) {
        rep = await Reputation.create({
          userId: targetUser.id,
          guildId: interaction.guild.id,
        });
      }

      if (repType === 'good') {
        rep.goodRep += 1;
        rep.totalReputation += 1;
      } else {
        rep.badRep += 1;
        rep.totalReputation -= 1;
      }

      await rep.save();

      await interaction.reply({
        content: `✅ Gave **${repType === 'good' ? 'Good' : 'Bad'} Rep** to <@${targetUser.id}>.\n📌 Reason: ${reason}`,
      });

      console.log('Rep after update:', rep);


    } catch (err) {
      console.error('Error giving rep:', err);
      await interaction.reply({
        content: '⚠️ Something went wrong while updating reputation.',
        ephemeral: true,
      });
    }
  },
};
