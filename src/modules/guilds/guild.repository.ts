import { PrismaClient, GuildConfig } from '@prisma/client';

export class GuildRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds a guild config by guild ID.
   */
  async findByGuildId(guildId: string): Promise<GuildConfig | null> {
    return this.prisma.guildConfig.findUnique({
      where: { guildId },
    });
  }

  /**
   * Upserts a guild config record.
   */
  async upsert(
    guildId: string,
    guildName: string,
    data: Partial<Pick<GuildConfig, 'alertHistoryChannelId' | 'adminRoleIds'>>,
  ): Promise<GuildConfig> {
    return this.prisma.guildConfig.upsert({
      where: { guildId },
      update: {
        guildName,
        ...data,
        updatedAt: new Date(),
      },
      create: {
        guildId,
        guildName,
        alertHistoryChannelId: data.alertHistoryChannelId || null,
        adminRoleIds: data.adminRoleIds || null,
      },
    });
  }

  /**
   * Sets the alert history channel for a guild.
   */
  async setAlertHistoryChannel(
    guildId: string,
    guildName: string,
    channelId: string,
  ): Promise<GuildConfig> {
    return this.upsert(guildId, guildName, { alertHistoryChannelId: channelId });
  }

  /**
   * Sets the admin role IDs for a guild.
   */
  async setAdminRoles(
    guildId: string,
    guildName: string,
    roleIds: string,
  ): Promise<GuildConfig> {
    return this.upsert(guildId, guildName, { adminRoleIds: roleIds });
  }

  /**
   * Gets all guild configs.
   */
  async findAll(): Promise<GuildConfig[]> {
    return this.prisma.guildConfig.findMany();
  }
}