import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Validates the encryption key on startup.
 * Throws if the key is missing or not exactly 32 bytes when decoded.
 */
export function validateEncryptionKey(): void {
  if (!env.ENCRYPTION_KEY) {
    logger.error('ENCRYPTION_KEY environment variable is not set');
    throw new Error('ENCRYPTION_KEY is required');
  }

  const keyBuffer = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  if (keyBuffer.length !== 32) {
    logger.error('ENCRYPTION_KEY is not 32 bytes', { keyLength: keyBuffer.length });
    throw new Error('ENCRYPTION_KEY must be 32 bytes when base64 decoded');
  }

  logger.info('Encryption key validated successfully');
}

/**
 * Returns the master key buffer. Throws if invalid.
 */
function getMasterKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('Invalid encryption key');
  }
  return key;
}

/**
 * Encrypts a Pushover user key using AES-256-GCM with a unique IV.
 * @param plainKey The raw Pushover key (30 alphanumeric chars)
 * @returns Object containing encrypted data and IV (both hex-encoded)
 */
export function encryptPushoverKey(plainKey: string): { encrypted: string; iv: string } {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);

  let encrypted = cipher.update(plainKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted: `${encrypted}:${authTag.toString('hex')}`,
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypts a Pushover user key using AES-256-GCM.
 * @param encryptedData The encrypted data with auth tag (format: "data:authTag")
 * @param iv Hex-encoded initialization vector
 * @returns The decrypted plain key
 */
export function decryptPushoverKey(encryptedData: string, iv: string): string {
  const masterKey = getMasterKey();

  const [encrypted, authTag] = encryptedData.split(':');
  if (!encrypted || !authTag) {
    throw new Error('Invalid encrypted data format');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    masterKey,
    Buffer.from(iv, 'hex'),
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks a Pushover key for display in logs and Discord messages.
 * Shows first 4 and last 3 characters: uABC...xyz
 * @param key The raw or decrypted Pushover key
 * @returns Masked key string, or '[INVALID]' if key is not 30 chars
 */
export function maskPushoverKey(key: string): string {
  if (key.length !== 30) {
    return '[INVALID]';
  }
  return `${key.slice(0, 4)}...${key.slice(-3)}`;
}