import { AlertRepository } from './alert.repository';
import { PrismaClient, AlertAuditLog } from '@prisma/client';
import { logger } from '../../utils/logger';

interface BroadcastResult {
  alertType: string;
  message: string;
  attemptedCount: number;
  successCount: number;
  failureCount: number;
}

export class AlertService {
  private readonly prisma: PrismaClient;
  private readonly repository: AlertRepository;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.repository = new AlertRepository(prisma);
  }

  /**
   * Logs a broadcast alert to the audit log.
   */
  async logBroadcast(
    data: {
      guildId: string;
      triggerUserId: string;
      triggerUsername: string;
      alertType: string;
      messageText: string;
      attemptedCount: number;
      successCount: number;
      failureCount: number;
      sourceMessageId?: string;
      sourceChannelId?: string;
    },
  ): Promise<AlertAuditLog> {
    const auditLog = await this.repository.createAuditLog(data);
    logger.info('Alert logged to audit', {
      auditLogId: auditLog.id,
      alertType: data.alertType,
      guildId: data.guildId,
      successCount: data.successCount,
      failureCount: data.failureCount,
    });
    return auditLog;
  }

  /**
   * Updates the history message reference on an audit log entry.
   */
  async linkHistoryMessage(
    auditLogId: string,
    historyMessageId: string,
    sourceChannelId?: string,
  ): Promise<void> {
    await this.repository.updateHistoryMessage(
      auditLogId,
      historyMessageId,
      sourceChannelId,
    );
    logger.debug('Linked history message to audit log', {
      auditLogId,
      historyMessageId,
    });
  }

  /**
   * Builds a Discord embed for the alert history message.
   */
  buildHistoryEmbed(
    data: BroadcastResult & {
      triggerUsername: string;
      triggerUserId: string;
      jumpUrl?: string;
      timestamp: Date;
    },
  ): { embed: any; color: number } {
    const colorMap: Record<string, number> = {
      silent: 0x95a5a6,   // Gray
      bell: 0x3498db,    // Blue
      critical: 0xe74c3c, // Red
    };

    const typeEmojiMap: Record<string, string> = {
      silent: '🔕',
      bell: '🔔',
      critical: '🚨',
    };

    const color = colorMap[data.alertType] || 0x95a5a6;
    const emoji = typeEmojiMap[data.alertType] || '📢';

    const formattedDate = data.timestamp.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const embed = {
      color,
      title: `${emoji} Alert Broadcast`,
      description: [
        `**Type:** ${data.alertType.charAt(0).toUpperCase() + data.alertType.slice(1)}`,
        `**Message:** "${data.message}"`,
        ``,
        `**Sent by:** <@${data.triggerUserId}>`,
        `**Notified:** ${data.successCount} users ✅`,
        `**Failed:** ${data.failureCount} users ❌`,
        ``,
        data.jumpUrl ? `🔗 [Jump to Message](${data.jumpUrl})` : '',
        ``,
        '━━━━━━━━━━━━━━━━━━━',
        formattedDate,
      ].join('\n'),
    };

    return { embed, color };
  }

  /**
   * Gets recent audit logs for displaying in admin panel.
   */
  async getRecentLogs(guildId: string, limit: number = 10): Promise<AlertAuditLog[]> {
    return this.repository.getRecentLogs(guildId, limit);
  }
}