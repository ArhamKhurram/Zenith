import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { PushoverService } from '../modules/pushover/pushover.service';
import { AlertService } from '../modules/alerts/alert.service';
import { GuildService } from '../modules/guilds/guild.service';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('alert')
  .setDescription('Broadcast alerts to registered users')
  .addSubcommand((subcommand: any) =>
    subcommand
      .setName('all')
      .setDescription('Broadcast alert to all registered users')
      .addStringOption((option: any) =>
        option
          .setName('type')
          .setDescription('Alert type: silent, bell, or critical')
          .setRequired(true)
          .addChoices(
            { name: '🔕 Silent (no sound)', value: 'silent' },
            { name: '🔔 Bell (short sound)', value: 'bell' },
            { name: '🚨 Critical (loud, repeating)', value: 'critical' },
          ),
      )
      .addStringOption((option: any) =>
        option
          .setName('message')
          .setDescription('Alert message content')
          .setRequired(true)
          .setMaxLength(1024),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'all') {
    await handleAlertAll(interaction);
  }
}

async function handleAlertAll(interaction: ChatInputCommandInteraction) {
  const alertType = interaction.options.getString('type');
  const message = interaction.options.getString('message');

  if (!alertType || !message) {
    await interaction.reply({
      content:
        '❌ Missing required options.\n\nUsage: `/alert all <silent|bell|critical> <message>`',
      ephemeral: true,
    });
    return;
  }

  // Permission check
  let isUserAdmin = false;
  try {
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    isUserAdmin = member?.permissions.has('ADMINISTRATOR' as any) ?? false;
  } catch {
    isUserAdmin = false;
  }

  if (!isUserAdmin) {
    await interaction.reply({
      content:
        '❌ Permission Denied\n\nYou don\'t have permission to broadcast alerts.\nContact a server admin.',
      ephemeral: true,
    });
    return;
  }

  // Defer reply since broadcast may take time
  await interaction.deferReply({ ephemeral: true });

  const prisma = (interaction.client as any).prisma as import('@prisma/client').PrismaClient;
  const pushoverService = new PushoverService(prisma);
  const alertService = new AlertService(prisma);
  const guildService = new GuildService(prisma);

  try {
    // Get guild config for history channel
    const guildConfig = await guildService.getOrCreateGuildConfig(
      interaction.guildId!,
      interaction.guild!.name,
    );

    // Broadcast the alert
    const result = await pushoverService.broadcast(
      interaction.guildId!,
      interaction.user.id,
      interaction.user.username,
      alertType,
      message,
    );

    const { alertConfig } = result;

    // Log to audit
    const auditLog = await alertService.logBroadcast({
      guildId: interaction.guildId!,
      triggerUserId: interaction.user.id,
      triggerUsername: interaction.user.username,
      alertType,
      messageText: message,
      attemptedCount: result.attemptedCount,
      successCount: result.successCount,
      failureCount: result.failureCount,
    });

    // Try to post history embed in configured channel
    if (guildConfig.alertHistoryChannelId) {
      try {
        const channel = await interaction.client.channels.fetch(
          guildConfig.alertHistoryChannelId,
        );
        if (channel && channel.isTextBased()) {
          const { embed } = alertService.buildHistoryEmbed({
            alertType,
            message,
            triggerUsername: interaction.user.username,
            triggerUserId: interaction.user.id,
            successCount: result.successCount,
            failureCount: result.failureCount,
            attemptedCount: result.attemptedCount,
            timestamp: auditLog.createdAt,
            jumpUrl: undefined,
          });

          const historyMessage = await (channel as any).send({ embeds: [embed] });

          // Update audit log with message reference
          await alertService.linkHistoryMessage(
            auditLog.id,
            historyMessage.id,
            channel.id,
          );

          // Update audit log with source message info
          await prisma.alertAuditLog.update({
            where: { id: auditLog.id },
            data: {
              sourceMessageId: interaction.id,
              sourceChannelId: interaction.channelId,
            },
          });
        }
      } catch (error: any) {
        logger.error('Failed to post history embed', {
          channelId: guildConfig.alertHistoryChannelId,
          error: error.message,
        });
      }
    }

    // Build summary response
    const summaryLines: string[] = [];

    if (alertType === 'critical') {
      summaryLines.push('🚨 CRITICAL Alert Sent');
      summaryLines.push('');
      summaryLines.push(`Notified: ${result.successCount} users`);
      summaryLines.push(`Failed: ${result.failureCount} users`);
      summaryLines.push(`Type: Nuke (Emergency)`);
      if (result.fallbackApplied) {
        summaryLines.push('');
        summaryLines.push('⚠️ FALLBACK APPLIED: No users had Nuke (Critical) enabled.');
        summaryLines.push('Alert was sent to users with Bell or DD settings as fallback.');
      }
      summaryLines.push('');
      summaryLines.push('⚠️ This alert will retry for 1 hour until acknowledged.');
    } else if (alertType === 'bell') {
      summaryLines.push('✅ Bell Alert Sent');
      summaryLines.push('');
      summaryLines.push(`Notified: ${result.successCount} users`);
      summaryLines.push(`Failed: ${result.failureCount} users`);
      summaryLines.push(`Type: Ping (Bell)`);
    } else {
      summaryLines.push('✅ Silent Alert Sent');
      summaryLines.push('');
      summaryLines.push(`Notified: ${result.successCount} users`);
      summaryLines.push(`Failed: ${result.failureCount} users`);
      summaryLines.push(`Type: DD (Silent)`);
    }

    if (guildConfig.alertHistoryChannelId) {
      summaryLines.push('');
      summaryLines.push('History logged in the alert history channel.');
    }

    await interaction.editReply({
      content: summaryLines.join('\n'),
    });
  } catch (error: any) {
    logger.error('Alert broadcast failed', {
      error: error.message,
      guildId: interaction.guildId,
    });
    await interaction.editReply({
      content:
        '⚠️ Service Unavailable\n\nNotifications may be delayed. Try again later.',
    });
  }
}