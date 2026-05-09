import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
} from 'discord.js';
import { UserService } from '../modules/users/user.service';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Configure your notification preferences');

export async function execute(interaction: ChatInputCommandInteraction) {
  const userService = new UserService((interaction.client as any).prisma);

  // Check if user is registered
  const user = await userService['repository'].findByDiscordUserId(interaction.user.id);
  if (!user) {
    await interaction.reply({
      content:
        '❌ Not Registered\n\nYou need to register first with /register add <key>',
      ephemeral: true,
    });
    return;
  }

  const settings = await userService.getOrCreateSettings(interaction.user.id);
  const decryptedKey = userService['decryptKey'](user);
  const masked = decryptedKey.length === 30
    ? `${decryptedKey.slice(0, 4)}...${decryptedKey.slice(-3)}`
    : '[INVALID]';

  const ddStatus = settings.ddEnabled ? '✅ Enabled' : '❌ Disabled';
  const pingStatus = settings.pingEnabled ? '✅ Enabled' : '❌ Disabled';
  const trenchStatus = settings.trenchEnabled ? '✅ Enabled' : '❌ Disabled';
  const nukeStatus = settings.nukeEnabled ? '✅ Enabled' : '❌ Disabled';
  const broadcastStatus = settings.broadcastAlertsEnabled
    ? '✅ Enabled'
    : '❌ Disabled';

  const embed = {
    color: 0x5865f2,
    title: '⚙️ Your Alert Settings',
    description:
      `Alert Types:\n` +
      `• DD (Silent): ${ddStatus}\n` +
      `• Ping (Bell): ${pingStatus}\n` +
      `• Trench (Loud): ${trenchStatus}\n` +
      `• Nuke (Critical): ${nukeStatus}\n\n` +
      `Broadcast Alerts: ${broadcastStatus}`,
    fields: [
      {
        name: 'Pushover Key',
        value: `\`${masked}\``,
        inline: false,
      },
    ],
    footer: { text: 'Click Edit to modify your preferences' },
  };

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings:edit')
      .setLabel('Edit Settings')
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

/**
 * Handles the settings modal submission.
 */
export async function handleModal(interaction: any) {
  const userService = new UserService((interaction.client as any).prisma);

  const updates: Record<string, boolean> = {
    ddEnabled: interaction.fields.getTextInputValue('settings:ddEnabled').toLowerCase() === 'true',
    pingEnabled: interaction.fields.getTextInputValue('settings:pingEnabled').toLowerCase() === 'true',
    trenchEnabled: interaction.fields.getTextInputValue('settings:trenchEnabled').toLowerCase() === 'true',
    nukeEnabled: interaction.fields.getTextInputValue('settings:nukeEnabled').toLowerCase() === 'true',
    broadcastAlertsEnabled: interaction.fields.getTextInputValue('settings:broadcastAlertsEnabled').toLowerCase() === 'true',
  };

  const result = await userService.updateSettings(interaction.user.id, updates);
  await interaction.reply({ content: result.message, ephemeral: true });
}

/**
 * Shows the settings edit modal.
 */
export async function handleButton(interaction: any) {
  const userService = new UserService((interaction.client as any).prisma);

  const user = await userService['repository'].findByDiscordUserId(interaction.user.id);
  if (!user) {
    await interaction.reply({
      content: '❌ Not registered. Use /register add <key> first.',
      ephemeral: true,
    });
    return;
  }

  const settings = await userService.getOrCreateSettings(interaction.user.id);

  const modal = new ModalBuilder()
    .setCustomId('settings:modal')
    .setTitle('Edit Notification Settings');

  const ddInput = new TextInputBuilder()
    .setCustomId('settings:ddEnabled')
    .setLabel('DD (Silent) Alerts')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('true or false')
    .setValue(settings.ddEnabled.toString())
    .setRequired(true);

  const pingInput = new TextInputBuilder()
    .setCustomId('settings:pingEnabled')
    .setLabel('Ping (Bell) Alerts')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('true or false')
    .setValue(settings.pingEnabled.toString())
    .setRequired(true);

  const trenchInput = new TextInputBuilder()
    .setCustomId('settings:trenchEnabled')
    .setLabel('Trench (Loud) Alerts')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('true or false')
    .setValue(settings.trenchEnabled.toString())
    .setRequired(true);

  const nukeInput = new TextInputBuilder()
    .setCustomId('settings:nukeEnabled')
    .setLabel('Nuke (Critical) Alerts')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('true or false')
    .setValue(settings.nukeEnabled.toString())
    .setRequired(true);

  const broadcastInput = new TextInputBuilder()
    .setCustomId('settings:broadcastAlertsEnabled')
    .setLabel('Broadcast Alerts (Global Toggle)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('true or false')
    .setValue(settings.broadcastAlertsEnabled.toString())
    .setRequired(true);

  const actionRows = [
    new ActionRowBuilder<TextInputBuilder>().addComponents(ddInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(pingInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(trenchInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(nukeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(broadcastInput),
  ];

  modal.addComponents(...actionRows);
  await interaction.showModal(modal);
}