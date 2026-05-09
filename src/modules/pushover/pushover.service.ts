import { PrismaClient } from '@prisma/client';
import { PushoverClient } from './pushover.client';
import { UserRepository } from '../users/user.repository';
import { logger } from '../../utils/logger';
import { maskPushoverKey, decryptPushoverKey } from '../users/encryption.util';
import type { UserRegistration, UserSettings } from '@prisma/client';

interface BroadcastStats {
  attemptedCount: number;
  successCount: number;
  failureCount: number;
  notifiedUserIds?: string[];
}

interface AlertTypeConfig {
  priority: number;
  sound?: string;
  retry?: number;
  expire?: number;
  filterField: keyof Pick<
    UserSettings,
    'ddEnabled' | 'pingEnabled' | 'trenchEnabled' | 'nukeEnabled'
  >;
  typeLabel: string;
  typeEmoji: string;
}

interface AlertTypeConfig {
  priority: number;
  sound?: string;
  retry?: number;
  expire?: number;
  filterField: keyof Pick<
    UserSettings,
    'ddEnabled' | 'pingEnabled' | 'trenchEnabled' | 'nukeEnabled'
  >;
  typeLabel: string;
  typeEmoji: string;
}

const ALERT_TYPES: Record<string, AlertTypeConfig> = {
  silent: {
    priority: -1,
    filterField: 'ddEnabled',
    typeLabel: 'DD (Silent)',
    typeEmoji: '🔕',
  },
  bell: {
    priority: 1,
    sound: 'pushover',
    filterField: 'pingEnabled',
    typeLabel: 'Ping (Bell)',
    typeEmoji: '🔔',
  },
  critical: {
    priority: 2,
    sound: 'siren',
    retry: 60,
    expire: 3600,
    filterField: 'nukeEnabled',
    typeLabel: 'Nuke (Emergency)',
    typeEmoji: '🚨',
  },
};

export class PushoverService {
  private readonly prisma: PrismaClient;
  private readonly pushoverClient: PushoverClient;
  private readonly userRepository: UserRepository;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.pushoverClient = new PushoverClient();
    this.userRepository = new UserRepository(prisma);
  }

  /**
   * Determines the alert type config and filter settings for a given alert type string.
   */
  private getAlertType(alertType: string): AlertTypeConfig {
    const config = ALERT_TYPES[alertType];
    if (!config) {
      throw new Error(`Unknown alert type: ${alertType}`);
    }
    return config;
  }

  /**
   * Builds a filter function to determine which users should receive an alert
   * based on their settings and the alert type.
   */
  private buildFilter(alertType: string): ((settings: UserSettings) => boolean) {
    const config = this.getAlertType(alertType);

    return (settings: UserSettings): boolean => {
      // Must have broadcast alerts enabled globally
      if (!settings.broadcastAlertsEnabled) return false;
      // Must have the specific alert type enabled
      return settings[config.filterField] === true;
    };
  }

  /**
   * Broadcasts an alert to all eligible users in parallel with concurrency limiting.
   * @param guildId The Discord guild ID
   * @param triggerUserId The user ID who triggered the alert
   * @param triggerUsername The username of the user who triggered the alert
   * @param alertType The type of alert: 'silent' | 'bell' | 'critical'
   * @param message The alert message text
   * @returns Broadcast results
   */
  async broadcast(
    guildId: string,
    triggerUserId: string,
    triggerUsername: string,
    alertType: string,
    message: string,
  ): Promise<BroadcastStats & { alertConfig: AlertTypeConfig }> {
    const config = this.getAlertType(alertType);
    const shouldReceive = this.buildFilter(alertType);

    // Get all users with their settings
    const registrations = await this.userRepository.findAll();
    const usersWithSettings: Array<{
      registration: UserRegistration;
      settings: UserSettings | null;
    }> = [];

    for (const reg of registrations) {
      const settings = await this.userRepository.getSettings(reg.id);
      usersWithSettings.push({ registration: reg, settings });
    }

// Filter eligible users
  const eligibleUsers = usersWithSettings.filter(({ settings }) => {
    if (!settings) return false;
    return shouldReceive(settings);
  });

  logger.info('Broadcasting alert', {
    guildId,
    alertType,
    eligibleCount: eligibleUsers.length,
    totalRegistered: registrations.length,
  });

  // Send notifications in parallel with concurrency control
  let successCount = 0;
  let failureCount = 0;
  const notifiedUserIds: string[] = [];

  // Process in batches to control concurrency
  const batchSize = 10;
  const delayBetweenBatches = 100;

  for (let i = 0; i < eligibleUsers.length; i += batchSize) {
    const batch = eligibleUsers.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async ({ registration, settings }) => {
        try {
          const decryptedKey = decryptPushoverKey(registration.pushoverKeyEnc, registration.encryptionIv);
          const result = await this.pushoverClient.send(
            decryptedKey,
            message,
            config.priority,
            {
              title: config.typeLabel,
              sound: config.sound,
              retry: config.retry,
              expire: config.expire,
            },
          );

          return {
            userId: registration.discordUserId,
            success: result.success,
            error: result.error,
          };
        } catch (error: any) {
          logger.error('Broadcast send error', {
            userId: registration.discordUserId,
            error: error.message,
          });
          return {
            userId: registration.discordUserId,
            success: false,
            error: error.message,
          };
        }
      }),
    );

    for (const result of results) {
      if (result.success) {
        successCount++;
        notifiedUserIds.push(result.userId);
      } else {
        failureCount++;
        logger.warn('Failed to notify user', {
          userId: result.userId,
          error: result.error,
        });
      }
    }

    // Delay between batches (except for the last one)
    if (i + batchSize < eligibleUsers.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

    const attemptedCount = successCount + failureCount;

    logger.info('Broadcast complete', {
      guildId,
      alertType,
      attemptedCount,
      successCount,
      failureCount,
    });

    return {
      attemptedCount,
      successCount,
      failureCount,
      notifiedUserIds,
      alertConfig: config,
    };
  }

  private decryptKey(registration: UserRegistration): string {
    return decryptPushoverKey(registration.pushoverKeyEnc, registration.encryptionIv);
  }
}