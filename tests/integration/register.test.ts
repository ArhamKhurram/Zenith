import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ensure encryption key is set for tests
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');

// Helper to create a user in the database
async function createUser(
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
  const { encryptPushoverKey } = require('../../src/modules/users/encryption.util');

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

describe('Registration Flow', () => {
  beforeEach(async () => {
    await prisma.alertAuditLog.deleteMany({});
    await prisma.userSettings.deleteMany({});
    await prisma.userRegistration.deleteMany({});
    await prisma.guildConfig.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('user can register and retrieve status', async () => {
    const { UserService } = require('../../src/modules/users/user.service');
    const userService = new UserService(prisma);

    const userId = 'test_user_001';
    const key = 'uABC123xyz4567890DEFGHIJKLMNO';

    const addResult = await userService.registerUser(userId, 'testuser', key);
    expect(addResult.success).toBe(true);

    const user = await prisma.userRegistration.findUnique({
      where: { discordUserId: userId },
    });
    expect(user).not.toBeNull();
    expect(user!.pushoverKeyEnc).not.toBe(key);
    expect(user!.discordUsername).toBe('testuser');

    const listResult = await userService.getRegistrationStatus(userId);
    expect(listResult.success).toBe(true);
    expect(listResult.masked).toBe('uABC...MNO');
  });

  test('user registration upserts existing user', async () => {
    const { UserService } = require('../../src/modules/users/user.service');
    const userService = new UserService(prisma);

    const userId = 'test_user_upsert';
    const key1 = 'uABC123xyz4567890DEFGHIJKLMNO';
    const key2 = 'uXYZ987abc4567890DEFGHIJKLMNO';

    const result1 = await userService.registerUser(userId, 'testuser', key1);
    expect(result1.success).toBe(true);

    const result2 = await userService.registerUser(userId, 'testuser', key2);
    expect(result2.success).toBe(true);

    const listResult = await userService.getRegistrationStatus(userId);
    expect(listResult.success).toBe(true);
    expect(listResult.masked).toBe('uXYZ...MNO');
  });

  test('invalid key format is rejected', async () => {
    const { UserService } = require('../../src/modules/users/user.service');
    const userService = new UserService(prisma);

    const result = await userService.registerUser('user1', 'testuser', 'short');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid Key Format');
  });

  test('user can remove registration', async () => {
    const { UserService } = require('../../src/modules/users/user.service');
    const userService = new UserService(prisma);

    const userId = 'test_user_remove';
    await userService.registerUser(userId, 'testuser', 'uABC123xyz4567890DEFGHIJKLMNO');

    let user = await prisma.userRegistration.findUnique({ where: { discordUserId: userId } });
    expect(user).not.toBeNull();

    const result = await userService.removeRegistration(userId);
    expect(result.success).toBe(true);

    user = await prisma.userRegistration.findUnique({ where: { discordUserId: userId } });
    expect(user).toBeNull();
  });

  test('unregistered user cannot get status', async () => {
    const { UserService } = require('../../src/modules/users/user.service');
    const userService = new UserService(prisma);

    const result = await userService.getRegistrationStatus('nonexistent_user');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Not Registered');
  });
});

describe('Broadcast Flow', () => {
  beforeEach(async () => {
    await prisma.alertAuditLog.deleteMany({});
    await prisma.userSettings.deleteMany({});
    await prisma.userRegistration.deleteMany({});
    await prisma.guildConfig.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('filters users by settings for bell alert', async () => {
    const { PushoverService } = require('../../src/modules/pushover/pushover.service');
    const pushoverService = new PushoverService(prisma);

    await createUser('user1_broadcast', {
      pushoverKey: 'uABC123456789012345678901234ABCD',
      pingEnabled: true,
      broadcastAlertsEnabled: true,
    });
    await createUser('user2_broadcast', {
      pushoverKey: 'uXYZ123456789012345678901234EFGH',
      pingEnabled: false,
      broadcastAlertsEnabled: true,
    });
    await createUser('user3_broadcast', {
      pushoverKey: 'uDEF123456789012345678901234IJKL',
      pingEnabled: true,
      broadcastAlertsEnabled: false,
    });

    const result = await pushoverService.broadcast(
      'guild1',
      'admin1',
      'Admin',
      'bell',
      'Test message',
    );

    expect(result.attemptedCount).toBe(1);
  });

  test('silent alert filters on ddEnabled', async () => {
    const { PushoverService } = require('../../src/modules/pushover/pushover.service');
    const pushoverService = new PushoverService(prisma);

    await createUser('user_silent1', { pushoverKey: 'uS123456789012345678901234ABC1', ddEnabled: true });
    await createUser('user_silent2', { pushoverKey: 'uS223456789012345678901234ABC2', ddEnabled: false });

    const result = await pushoverService.broadcast('guild1', 'admin1', 'Admin', 'silent', 'Silent test');
    expect(result.attemptedCount).toBe(1);
  });

  test('critical alert filters on nukeEnabled', async () => {
    const { PushoverService } = require('../../src/modules/pushover/pushover.service');
    const pushoverService = new PushoverService(prisma);

    await createUser('user_crit1', { pushoverKey: 'uC123456789012345678901234ABC1', nukeEnabled: true });
    await createUser('user_crit2', { pushoverKey: 'uC223456789012345678901234ABC2', nukeEnabled: false });

    const result = await pushoverService.broadcast('guild1', 'admin1', 'Admin', 'critical', 'Critical test');
    expect(result.attemptedCount).toBe(1);
  });
});