import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Get started with Zenith Alerts — interactive setup guide');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📢 Zenith Alerts — Setup')
    .setDescription(
      'Configure your alert preferences by toggling roles below.\n\n' +
        '**Step 1:** Register your Pushover key with `/register add <key>`\n' +
        '**Step 2:** Enable the alert tiers you want to receive\n' +
        '**Step 3:** Get notified on your phone!\n\n' +
        'Each button toggles a Discord role that maps to an alert tier.\n' +
        'When a role is **enabled**, you will receive that tier of Pushover alerts.\n' +
        'When a role is **disabled**, you will stop receiving that tier.\n',
    )
    .addFields(
      {
        name: '🔕 DD (Silent)',
        value: 'Low-priority directional-dialogue alerts.\nLowest urgency, no sound.',
        inline: true,
      },
      {
        name: '🔔 Bell (Ping)',
        value: 'Standard notification alerts.\nShort push sound on your phone.',
        inline: true,
      },
      {
        name: '📡 Trench (Loud)',
        value: 'Important alerts that need attention.\nLoud repeating sound.',
        inline: true,
      },
      {
        name: '🚨 Nuke (Critical)',
        value: 'Emergency / critical alerts.\nSiren sound, retries every 60s for 1 hour.',
        inline: true,
      },
    )
    .setFooter({ text: 'Click the buttons below to toggle roles' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:toggle_dd')
      .setLabel('🔕 DD (Silent)')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:toggle_bell')
      .setLabel('🔔 Bell (Ping)')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:toggle_trench')
      .setLabel('📡 Trench (Loud)')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:toggle_nuke')
      .setLabel('🚨 Nuke (Critical)')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}