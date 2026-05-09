import { PrismaClient, GuildConfig } from '@prisma/client';
import { GuildRepository } from './guild.repository';
import { logger } from '../../utils/logger';
import type { GuildMember } from 'discord.js';

interface GuildConfigResult {
  success: boolean;
  message: string;
  config?: GuildConfig;
}

export class GuildService {
  private readonly prisma: PrismaClient;
  private readonly repository: GuildRepository;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.repository = new GuildRepository(prisma);
  }

  /**
   * Gets or creates a guild config.
   */
  async getOrCreateGuildConfig(
    guildId: string,
    guildName?: string,
  ): Promise<GuildConfig> {
    let config = await this.repository.findByGuildId(guildId);
    if (!config) {
      config = await this.repository.upsert(guildId, guildName || guildId, {});
      logger.info('Guild config created', { guildId });
    }
    return config;
  }

  /**
   * Gets all guild configurations.
   */
  async getAllConfigs(): Promise<GuildConfig[]> {
    return this.repository.findAll();
  }

  /**
   * Updates the alert history channel for a guild.
   */
  async setAlertHistoryChannel(
    guildId: string,
    channelId: string,
    guildName?: string,
  ): Promise<GuildConfigResult> {
    try {
      const config = await this.repository.setAlertHistoryChannel(
        guildId,
        guildName || guildId,
        channelId,
      );
      logger.info('Alert history channel set', { guildId, channelId });
      return { success: true, message: 'History channel updated.', config };
    } catch (error: any) {
      logger.error('Failed to set history channel', {
        guildId,
        error: error.message,
      });
      return {
        success: false,
        message: 'Failed to update history channel.',
      };
    }
  }

  /**
   * Updates admin role IDs for a guild.
   */
  async setAdminRoles(
    guildId: string,
    roleIds: string,
    guildName?: string,
  ): Promise<GuildConfigResult> {
    try {
      const config = await this.repository.setAdminRoles(
        guildId,
        guildName || guildId,
        roleIds,
      );
      logger.info('Admin roles updated', { guildId, roleIds });
      return { success: true, message: 'Admin roles updated.', config };
    } catch (error: any) {
      logger.error('Failed to set admin roles', {
        guildId,
        error: error.message,
      });
      return {
        success: false,
        message: 'Failed to update admin roles.',
      };
    }
  }

  /**
   * Checks if a user is an admin for a given guild.
   * Resolves based on GuildConfig adminRoleIds, then ADMINISTRATOR permission.
   */
  async isUserAdmin(
    userId: string,
    guildId: string,
    getGuildMember: (
      userId: string,
    ) => Promise<GuildMember | null>,
  ): Promise<boolean> {
    const config = await this.repository.findByGuildId(guildId);

    if (config?.adminRoleIds) {
      const member = await getGuildMember(userId);
      if (member) {
        const allowedRoles = config.adminRoleIds!.split(',').map((id) =>
          id.trim(),
        );
        return member.roles.cache.some((role) =>
          allowedRoles.includes(role.id),
        );
      }
    }

    // Fall back to ADMINISTRATOR permission
    const member = await getGuildMember(userId);
    if (!member) return false;

    return member.permissions.has('ADMINISTRATOR' as any);
  }
}