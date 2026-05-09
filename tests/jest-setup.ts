import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Set required environment variables before any module imports
process.env.DISCORD_TOKEN = 'NDcxMjM0NTY3ODkwfQ.XLhMuw.8aKjzP4mYwL0nHq3vF2tG9rS5eD7bNc1A2f3G';
process.env.DISCORD_CLIENT_ID = '123456789012345678';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.PUSHOVER_APP_TOKEN = 'a1b2c3d4e5f6g7h8i9j0a1b2c3d4e5';
process.env.ENCRYPTION_KEY = 'dGVzdGVuY3J5cHRpb25rZXkwMTIzNDU2Nzg5MDEyMzQ=';
process.env.NODE_ENV = 'test';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };

// Helper to create a user in the database
export async function createUser(
  discordUserId: string,
  overrides: {
    discordUsername?: string;
    pushoverKey?: string;
    ddEnabled?: boolean;
    pingEnabled?: boolean;
    trenchEnabled?: boolean;
    nukeEnabled?: boolean;
    broadcastAlertsEnabled?: boolean;
  } = {},
) {
  const { encryptPushoverKey } = require('../src/modules/users/encryption.util');

  const pushoverKey = overrides.pushoverKey || `uABC123xyz4567890DEFGHIJKL${discordUserId.slice(0, 4)}`;
  const { encrypted, iv } = encryptPushoverKey(pushoverKey);
  const username = overrides.discordUsername || `user_${discordUserId}`;

  const registration = await prisma.userRegistration.upsert({
    where: { discordUserId },
    update: {
      pushoverKeyEnc: encrypted,
      encryptionIv: iv,
      discordUsername: username,
    },
    create: {
      discordUserId,
      discordUsername: username,
      pushoverKeyEnc: encrypted,
      encryptionIv: iv,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: registration.id },
    update: {
      ddEnabled: overrides.ddEnabled ?? true,
      pingEnabled: overrides.pingEnabled ?? true,
      trenchEnabled: overrides.trenchEnabled ?? true,
      nukeEnabled: overrides.nukeEnabled ?? false,
      broadcastAlertsEnabled: overrides.broadcastAlertsEnabled ?? true,
    },
    create: {
      userId: registration.id,
      ddEnabled: overrides.ddEnabled ?? true,
      pingEnabled: overrides.pingEnabled ?? true,
      trenchEnabled: overrides.trenchEnabled ?? true,
      nukeEnabled: overrides.nukeEnabled ?? false,
      broadcastAlertsEnabled: overrides.broadcastAlertsEnabled ?? true,
    },
  });

  return registration;
}