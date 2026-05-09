import { PrismaClient, AlertAuditLog } from '@prisma/client';

export class AlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates an audit log record for a broadcast alert.
   */
  async createAuditLog(data: {
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
  }): Promise<AlertAuditLog> {
    return this.prisma.alertAuditLog.create({
      data,
    });
  }

  /**
   * Updates the history message ID on an existing audit log.
   */
  async updateHistoryMessage(
    auditLogId: string,
    historyMessageId: string,
    sourceChannelId?: string,
  ): Promise<AlertAuditLog> {
    return this.prisma.alertAuditLog.update({
      where: { id: auditLogId },
      data: { historyMessageId, sourceChannelId },
    });
  }

  /**
   * Gets recent audit logs for a guild, ordered by most recent.
   */
  async getRecentLogs(
    guildId: string,
    limit: number = 10,
  ): Promise<AlertAuditLog[]> {
    return this.prisma.alertAuditLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Gets all audit logs for a guild (for admin history view).
   */
  async getAllLogs(guildId: string): Promise<AlertAuditLog[]> {
    return this.prisma.alertAuditLog.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
    });
  }
}