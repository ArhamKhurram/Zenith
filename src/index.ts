import { PrismaClient } from '@prisma/client';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initClient } from './bot/client';

const prisma = new PrismaClient();

// Store prisma on client for access in commands
import { client } from './bot/client';
(client as any).prisma = prisma;

async function main() {
  try {
    logger.info('Starting Zenith Alerts bot...', {
      nodeEnv: env.NODE_ENV,
      version: '2.0.0',
    });

    // Connect Discord client (handles command registration internally)
    await initClient();

    logger.info('Zenith Alerts bot started successfully');
  } catch (error: any) {
    logger.error('Failed to start bot', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  await client.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  await client.destroy();
  process.exit(0);
});