import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { UserService } from '../modules/users/user.service';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Manage your Pushover registration')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Add or update your Pushover key')
      .addStringOption((option) =>
        option
          .setName('key')
          .setDescription('Your Pushover user key')
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
  const userService = new UserService(interaction.client as any);

  if (subcommand === 'add') {
    await handleAdd(interaction, userService);
  } else if (subcommand === 'list') {
    await handleList(interaction, userService);
  } else if (subcommand === 'remove') {
    await handleRemove(interaction, userService);
  }
}

async function handleAdd(
  interaction: ChatInputCommandInteraction,
  userService: UserService,
) {
  const key = interaction.options.getString('key');

  if (!key) {
    await interaction.reply({
      content:
        '❌ Invalid Key Format\n\nYou must provide a Pushover key.\nExample: /register add uABC123xyz4567890DEFGHIJKLMNO',
      ephemeral: true,
    });
    return;
  }

  const result = await userService.registerUser(
    interaction.user.id,
    interaction.user.username,
    key,
  );

  await interaction.reply({ content: result.message, ephemeral: true });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  userService: UserService,
) {
  const result = await userService.getRegistrationStatus(interaction.user.id);
  await interaction.reply({ content: result.message, ephemeral: true });
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  userService: UserService,
) {
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