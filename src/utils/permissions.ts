import { GuildMember, PermissionResolvable } from 'discord.js';

/**
 * Checks if a user is an admin based on ADMINISTRATOR permission.
 */
export async function isAdmin(
  member: GuildMember | null,
): Promise<boolean> {
  if (!member) return false;

  return member.permissions.has('ADMINISTRATOR' as PermissionResolvable);
}

/**
 * Helper to check admin role from database config.
 * Used when prisma client is available.
 */
export function isAdminFromRoles(memberRoles: string[], guildAdminRoleIds?: string | null): boolean {
  if (!guildAdminRoleIds) return false;
  const allowedRoles = guildAdminRoleIds.split(',').map((id) => id.trim());
  return memberRoles.some((roleId) => allowedRoles.includes(roleId));
}