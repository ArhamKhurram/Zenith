const { maskPushoverKey } = require('../../src/modules/users/encryption.util');

describe('Key Masking', () => {
  test('masks 30-char key correctly', () => {
    const key = 'uABC123xyz4567890DEFGHIJKLMNOO'; // 30 chars
    const masked = maskPushoverKey(key);

    expect(masked).toBe('uABC...NOO');
    expect(masked).not.toContain('123xyz');
  });

  test('handles short keys', () => {
    expect(maskPushoverKey('short')).toBe('[INVALID]');
  });

  test('handles empty keys', () => {
    expect(maskPushoverKey('')).toBe('[INVALID]');
  });

  test('handles keys that are exactly 29 chars', () => {
    const key = 'uABC123xyz4567890DEFGHIJKLMNO'; // 29 chars
    expect(maskPushoverKey(key)).toBe('[INVALID]');
  });

  test('handles keys that are 31 chars', () => {
    const key = 'uABC123xyz4567890DEFGHIJKLMNOOO'; // 31 chars
    expect(maskPushoverKey(key)).toBe('[INVALID]');
  });

  test('does not expose internal characters of valid key', () => {
    const key = 'abcdefghij0123456789ABCDEFGHIJ'; // 30 chars
    const masked = maskPushoverKey(key);

    expect(masked).toBe('abcd...HIJ');
    expect(masked).not.toContain('0123456789');
    expect(masked).not.toContain('efgh');
  });
});