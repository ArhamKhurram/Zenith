import { PrismaClient } from '@prisma/client';
import { PushoverClient } from './pushover.client';
import { UserRepository } from '../users/user.repository';
import { logger } from '../../utils/logger';
import { decryptPushoverKey } from '../users/encryption.util';
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

const ALERT_TYPES: Record<string, AlertTypeConfig> = {
  dd: {
    priority: -1,
    filterField: 'ddEnabled',
    typeLabel: 'DD (Silent)',
    typeEmoji: '🔕',
  },
  bell: {
    priority: 1,
    sound: 'cashregister',
    filterField: 'pingEnabled',
    typeLabel: 'Bell (Ping)',
    typeEmoji: '🔔',
  },
  trench: {
    priority: 1,
    sound: 'pushover',
    filterField: 'trenchEnabled',
    typeLabel: 'Trench (Loud)',
    typeEmoji: '📡',
  },
  nuke: {
    priority: 2,
    sound: 'siren',
    retry: 60,
    expire: 3600,
    filterField: 'nukeEnabled',
    typeLabel: 'Nuke (Critical)',
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

  private getAlertType(alertType: string): AlertTypeConfig {
    const config = ALERT_TYPES[alertType];
    if (!config) {
      throw new Error(`Unknown alert type: ${alertType}`);
    }
    return config;
  }

  private buildFilter(alertType: string): ((settings: UserSettings) => boolean) {
    const config = this.getAlertType(alertType);
    return (settings: UserSettings): boolean => {
      if (!settings.broadcastAlertsEnabled) return false;
      return settings[config.filterField] === true;
    };
  }

   async broadcast(
     guildId: string,
     triggerUserId: string,
     triggerUsername: string,
     alertType: string,
     message: string,
   ): Promise<BroadcastStats & { alertConfig: AlertTypeConfig; fallbackApplied?: boolean }> {
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

      // Auto-create missing UserSettings with defaults for any user without settings
      for (const entry of usersWithSettings) {
        if (!entry.settings) {
          entry.settings = await this.prisma.userSettings.upsert({
            where: { userId: entry.registration.id },
            update: {},
            create: { userId: entry.registration.id },
          });
          logger.info('Created missing user settings during broadcast', {
            userId: entry.registration.id,
          });
        }
      }

      // Filter eligible users
     const eligibleUsers = usersWithSettings.filter(({ settings }) => {
       if (!settings) return false;
       const filterField = config.filterField;
       if (filterField === 'nukeEnabled') {
         if (settings.broadcastAlertsEnabled && settings.nukeEnabled) return true;
         return false;
       }
       return shouldReceive(settings);
     });

     // Fallback for nuke alerts: if no nuke-enabled users found, include users
     // with any other alert type enabled (bell/dd/trench)
     let fallbackApplied = false;
     if (alertType === 'nuke' && eligibleUsers.length === 0) {
       const fallbackUsers = usersWithSettings.filter(({ settings }) => {
         if (!settings || !settings.broadcastAlertsEnabled) return false;
         return settings.pingEnabled || settings.ddEnabled || settings.trenchEnabled;
       });
       if (fallbackUsers.length > 0) {
         fallbackApplied = true;
         logger.warn('Critical alert fallback activated', {
           guildId,
           reason: 'No users with nukeEnabled found, falling back to users with bell/dd/trench settings',
           fallbackCount: fallbackUsers.length,
         });
         eligibleUsers.push(...fallbackUsers);
       }
     }

     logger.info('Broadcasting alert', {
       guildId,
       alertType,
       eligibleCount: eligibleUsers.length,
       totalRegistered: registrations.length,
       fallbackApplied,
     });

     // Send notifications in batches
     let successCount = 0;
     let failureCount = 0;
     const notifiedUserIds: string[] = [];

     const batchSize = 10;
     const delayBetweenBatches = 100;

     for (let i = 0; i < eligibleUsers.length; i += batchSize) {
       const batch = eligibleUsers.slice(i, i + batchSize);

        const results = await Promise.all(
          batch.map(async ({ registration }) => {
            try {
              const decryptedKey = decryptPushoverKey(
                registration.pushoverKeyEnc,
                registration.encryptionIv,
              );

              // Validate decrypted key format (must be exactly 30 alphanumeric chars)
              if (!/^[a-zA-Z0-9]{30}$/.test(decryptedKey)) {
                logger.error('Invalid Pushover key format after decryption', {
                  userId: registration.discordUserId,
                  keyLength: decryptedKey.length,
                  keyPreview: decryptedKey.slice(0, 10),
                });
                return {
                  userId: registration.discordUserId,
                  success: false,
                  error: 'Invalid key format',
                };
              }

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
      fallbackApplied,
    };
  }
}