import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { UserService } from '../modules/users/user.service';

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Manage your Pushover registration')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Add or update your Pushover key')
      .addStringOption((option) =>
        option
          .setName('pushover_key')
          .setDescription('Your Pushover user key (30 alphanumeric characters)')
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('list').setDescription('View your registration status'),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('remove').setDescription('Remove your Pushover key'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const prisma = (interaction.client as any).prisma;
  const userService = new UserService(prisma);

  if (subcommand === 'add') {
    const key = interaction.options.getString('pushover_key') || '';

    // Defer immediately to prevent interaction timeout
    await interaction.deferReply({ ephemeral: true });

    const result = await userService.registerUser(
      interaction.user.id,
      interaction.user.username,
      key,
    );
    await interaction.editReply({ content: result.message });
  } else if (subcommand === 'list') {
    // Defer immediately to prevent interaction timeout
    await interaction.deferReply({ ephemeral: true });

    const result = await userService.getRegistrationStatus(interaction.user.id);
    await interaction.editReply({ content: result.message });
  } else if (subcommand === 'remove') {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('register:confirm_remove')
        .setLabel('Yes, Remove My Key')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('register:cancel_remove')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setColor(0xf0ad4e)
      .setTitle('⚠️ Confirm Removal')
      .setDescription(
        'This will delete your Pushover key and all settings.\nYou will stop receiving alerts immediately.\n\nAre you sure?',
      );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  }
}