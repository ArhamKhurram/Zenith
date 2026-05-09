const { isAdmin, isAdminFromRoles } = require('../../src/utils/permissions');

// Mock member factory
function createMockMember(roles: string[] = [], isAdminFlag: boolean = false) {
  return {
    roles: {
      cache: new Map(roles.map((r: string) => [r, { id: r }])),
    },
    permissions: {
      has: (perm: string) => {
        if (perm === 'ADMINISTRATOR') return isAdminFlag;
        return false;
      },
    },
  };
}

describe('Permissions', () => {
  test('grants admin to user with ADMINISTRATOR permission', async () => {
    const result = await isAdmin(createMockMember([], true));
    expect(result).toBe(true);
  });

  test('denies admin to regular user without any roles', async () => {
    const result = await isAdmin(createMockMember([], false));
    expect(result).toBe(false);
  });

  test('returns false for null member', async () => {
    const result = await isAdmin(null);
    expect(result).toBe(false);
  });

  test('isAdminFromRoles returns true with matching role', () => {
    const memberRoles = ['111', '222', '333'];
    expect(isAdminFromRoles(memberRoles, '111,444')).toBe(true);
  });

  test('isAdminFromRoles returns false with no matching roles', () => {
    const memberRoles = ['111', '222', '333'];
    expect(isAdminFromRoles(memberRoles, '444,555')).toBe(false);
  });

  test('isAdminFromRoles returns false when guildAdminRoleIds is null', () => {
    const memberRoles = ['111', '222', '333'];
    expect(isAdminFromRoles(memberRoles, null)).toBe(false);
  });
});