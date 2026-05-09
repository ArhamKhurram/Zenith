import { PrismaClient } from '@prisma/client';
import { UserRepository } from './user.repository';
import { encryptPushoverKey, decryptPushoverKey, maskPushoverKey } from './encryption.util';
import { logger } from '../../utils/logger';

export interface RegistrationResult {
  success: boolean;
  message: string;
  maskedKey?: string;
}

export interface SettingsResult {
  success: boolean;
  message: string;
  settings?: any;
  maskedKey?: string;
}

export class UserService {
  private readonly prisma: PrismaClient;
  readonly repository: UserRepository;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.repository = new UserRepository(prisma);
  }

  /**
   * Registers or updates a user's Pushover key.
   * Validates key format, encrypts it, upserts the registration, and creates default settings.
   */
  async registerUser(
    discordUserId: string,
    discordUsername: string,
    rawKey: string,
  ): Promise<RegistrationResult> {
    // Validate key format: exactly 30 alphanumeric characters
    if (!/^[a-zA-Z0-9]{30}$/.test(rawKey)) {
      return {
        success: false,
        message:
          '❌ Invalid Key Format\n\nPushover keys must be exactly 30 alphanumeric characters.\nExample: uABC123xyz4567890DEFGHIJKLMNO',
      };
    }

    try {
      // Encrypt the key
      const { encrypted, iv } = encryptPushoverKey(rawKey);
      const maskedKey = maskPushoverKey(rawKey);

      // Upsert the user registration
      const registration = await this.repository.upsert(discordUserId, discordUsername, encrypted, iv);
      // Ensure default settings are created for new registrations
      await this.prisma.userSettings.upsert({
        where: { userId: registration.id },
        update: {},
        create: { userId: registration.id },
      });

      logger.info('User registered', {
        userId: discordUserId,
        username: discordUsername,
        maskedKey,
      });

      return {
        success: true,
        message:
          '✅ Pushover Key Registered\n\nYour key has been saved securely.\nUse /settings to configure alert preferences.',
        maskedKey,
      };
    } catch (error: any) {
      logger.error('Registration failed', {
        userId: discordUserId,
        error: error.message,
      });
      return {
        success: false,
        message:
          '❌ Registration Failed\n\nCould not save your key. Please try again or contact an admin.',
      };
    }
  }

  /**
   * Retrieves a user's registration status with masked key.
   */
  async getRegistrationStatus(discordUserId: string): Promise<SettingsResult> {
    const user = await this.repository.findByDiscordUserId(discordUserId);

    if (!user) {
      return {
        success: false,
        message:
          '❌ Not Registered\n\nYou haven\'t registered a Pushover key yet.\nUse /register add <key> to get started.',
      };
    }

    const settings = await this.repository.getSettings(user.id);
    const maskedKey = maskPushoverKey(
      decryptPushoverKey(user.pushoverKeyEnc, user.encryptionIv),
    );
    const registeredDate = user.registeredAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return {
      success: true,
      message: `✅ Registration Status\n\nPushover Key: ${maskedKey} (registered)\nRegistered: ${registeredDate}\n\nUse /settings to manage preferences.\nUse /register remove to unregister.`,
      maskedKey,
    };
  }

  /**
   * Removes a user's registration (key and settings).
   */
  async removeRegistration(discordUserId: string): Promise<RegistrationResult> {
    try {
      await this.repository.delete(discordUserId);
      logger.info('User registration removed', { userId: discordUserId });

      return {
        success: true,
        message:
          '✅ Registration Removed\n\nYour Pushover key and settings have been deleted.\nYou will no longer receive alerts.',
      };
    } catch (error: any) {
      return {
        success: false,
        message: '❌ Failed to remove registration. Please try again.',
      };
    }
  }

  /**
   * Updates a user's notification settings.
   */
  async updateSettings(
    discordUserId: string,
    updates: Partial<{
      ddEnabled: boolean;
      pingEnabled: boolean;
      trenchEnabled: boolean;
      nukeEnabled: boolean;
      broadcastAlertsEnabled: boolean;
    }>,
  ): Promise<SettingsResult> {
    const user = await this.repository.findByDiscordUserId(discordUserId);
    if (!user) {
      return {
        success: false,
        message:
          '❌ Not Registered\n\nYou need to register first with /register add <key>',
      };
    }

    try {
      const updated = await this.prisma.userSettings.update({
        where: { userId: user.id },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });

      logger.info('Settings updated', { userId: discordUserId, updates });

      return {
        success: true,
        message: '✅ Settings Updated\n\nYour preferences have been saved.',
        settings: updated,
        maskedKey: maskPushoverKey(
          decryptPushoverKey(user.pushoverKeyEnc, user.encryptionIv),
        ),
      };
    } catch (error: any) {
      return {
        success: false,
        message: '❌ Failed to update settings. Please try again.',
      };
    }
  }

  /**
   * Retrieves current settings for a user, creating defaults if needed.
   */
  async getOrCreateSettings(discordUserId: string): Promise<any> {
    const user = await this.repository.findByDiscordUserId(discordUserId);
    if (!user) {
      throw new Error('User not registered');
    }

    let settings = await this.repository.getSettings(user.id);
    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { userId: user.id },
      });
    }

    return settings;
  }

  /**
   * Decrypts the Pushover key for a user.
   */
  decryptKey(user: { pushoverKeyEnc: string; encryptionIv: string }): string {
    return decryptPushoverKey(user.pushoverKeyEnc, user.encryptionIv);
  }
}