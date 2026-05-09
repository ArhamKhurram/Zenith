import { PrismaClient, UserRegistration, UserSettings } from '@prisma/client';

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds a user registration by Discord user ID.
   */
  async findByDiscordUserId(discordUserId: string): Promise<UserRegistration | null> {
    return this.prisma.userRegistration.findUnique({
      where: { discordUserId },
    });
  }

  /**
   * Upserts a user registration record. Creates if not exists, updates if exists.
   */
  async upsert(
    discordUserId: string,
    discordUsername: string,
    pushoverKeyEnc: string,
    encryptionIv: string,
  ): Promise<UserRegistration> {
    return this.prisma.userRegistration.upsert({
      where: { discordUserId },
      update: {
        pushoverKeyEnc,
        encryptionIv,
        updatedAt: new Date(),
      },
      create: {
        discordUserId,
        discordUsername,
        pushoverKeyEnc,
        encryptionIv,
      },
    });
  }

  /**
   * Deletes a user registration and their settings (cascade).
   */
  async delete(discordUserId: string): Promise<UserRegistration | null> {
    return this.prisma.userRegistration.delete({
      where: { discordUserId },
    });
  }

  /**
   * Gets the settings for a user by their registration ID.
   */
  async getSettings(registrationId: string): Promise<UserSettings | null> {
    return this.prisma.userSettings.findUnique({
      where: { userId: registrationId },
    });
  }

  /**
   * Gets all user registrations.
   */
  async findAll(): Promise<UserRegistration[]> {
    return this.prisma.userRegistration.findMany();
  }
}