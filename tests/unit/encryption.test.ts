import crypto from 'crypto';

process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');

const { encryptPushoverKey, decryptPushoverKey, maskPushoverKey } = require('../../src/modules/users/encryption.util');

describe('Encryption', () => {
  test('encrypts and decrypts correctly', () => {
    const plainKey = 'uABC123xyz4567890DEFGHIJKLMNO';

    const { encrypted, iv } = encryptPushoverKey(plainKey);
    const decrypted = decryptPushoverKey(encrypted, iv);

    expect(decrypted).toBe(plainKey);
  });

  test('produces unique IVs for same input', () => {
    const plainKey = 'uABC123xyz4567890DEFGHIJKLMNO';

    const result1 = encryptPushoverKey(plainKey);
    const result2 = encryptPushoverKey(plainKey);

    expect(result1.iv).not.toBe(result2.iv);
    expect(result1.encrypted).not.toBe(result2.encrypted);
  });

  test('decryption fails with wrong IV', () => {
    const plainKey = 'uABC123xyz4567890DEFGHIJKLMNO';

    const { encrypted } = encryptPushoverKey(plainKey);
    const wrongIv = crypto.randomBytes(16).toString('hex');

    expect(() => decryptPushoverKey(encrypted, wrongIv)).toThrow();
  });

  test('decryption fails with tampered data', () => {
    const plainKey = 'uABC123xyz4567890DEFGHIJKLMNO';

    const { encrypted, iv } = encryptPushoverKey(plainKey);
    const tampered = encrypted.slice(0, 5) + 'X' + encrypted.slice(6);

    expect(() => decryptPushoverKey(tampered, iv)).toThrow();
  });

  test('handles different key lengths', () => {
    const shortKey = 'uABC123';
    const { encrypted, iv } = encryptPushoverKey(shortKey);
    const decrypted = decryptPushoverKey(encrypted, iv);

    expect(decrypted).toBe(shortKey);
  });
});