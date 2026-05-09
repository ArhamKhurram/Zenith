import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(50),
  DISCORD_CLIENT_ID: z.string().regex(/^\d+$/),
  DATABASE_URL: z.string().url(),
  PUSHOVER_APP_TOKEN: z.string().length(30),
  ENCRYPTION_KEY: z.string().refine(
    (key) => Buffer.from(key, 'base64').length === 32,
    'ENCRYPTION_KEY must be 32 bytes when base64 decoded'
  ),
  ADMIN_ROLE_IDS: z.string().optional(),
  OWNER_DISCORD_IDS: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DISCORD_TEST_GUILD_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);