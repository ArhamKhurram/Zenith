import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { GuildService } from '../modules/guilds/guild.service';
import { UserRepository } from '../modules/users/user.repository';
import { logger } from '../utils/logger';

interface TierRoleConfig {
  dd: string;
  bell: string;
  trench: string;
  nuke: string;
}

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin tools for managing the bot')
  .addSubcommand((subcommand) =>
    subcommand.setName('config').setDescription('View and configure guild settings'),
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('health').setDescription('Check bot health and status'),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'config') {
    await handleConfig(interaction);
  } else if (subcommand === 'health') {
    await handleHealth(interaction);
  }
}

async function handleConfig(interaction: ChatInputCommandInteraction) {
  // Permission check - admin via database, env, or discord permission
  const guildId = interaction.guildId!;
  let isUserAdmin = false;
  try {
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    isUserAdmin = member?.permissions.has('ADMINISTRATOR' as any) ?? false;
  } catch {
    isUserAdmin = false;
  }

  if (!isUserAdmin) {
    await interaction.reply({
      content: '❌ Permission Denied\n\nYou don\'t have permission to use admin commands.',
      ephemeral: true,
    });
    return;
  }

  const prisma = (interaction.client as any).prisma as import('@prisma/client').PrismaClient;
  const guildService = new GuildService(prisma);
  const userRepository = new UserRepository(prisma);

  const config = await guildService.getOrCreateGuildConfig(guildId, interaction.guild!.name);
  const userCount = await userRepository.findAll();

  // Parse tier roles for display
  let tierRoles: TierRoleConfig = { dd: 'Not set', bell: 'Not set', trench: 'Not set', nuke: 'Not set' };
  if (config.tierRoleIds) {
    try {
      tierRoles = { ...tierRoles, ...JSON.parse(config.tierRoleIds) };
    } catch {
      // Invalid JSON, leave defaults
    }
  }

  const adminEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('⚙️ Guild Configuration')
    .addFields(
      {
        name: 'Alert History Channel',
        value: config.alertHistoryChannelId
          ? `<#${config.alertHistoryChannelId}>`
          : 'Not set',
        inline: false,
      },
      {
        name: 'Admin Roles',
        value: config.adminRoleIds
          ? config.adminRoleIds
              .split(',')
              .map((id: string) => `<@&${id}>`)
              .join(', ')
          : 'Not set (defaults to ADMINISTRATOR permission)',
        inline: false,
      },
      {
        name: '📋 Tier Role Assignments',
        value: [
          `• DD (Silent): ${tierRoles.dd !== 'Not set' ? `<@&${tierRoles.dd}>` : 'Not set'}`,
          `• Bell (Ping): ${tierRoles.bell !== 'Not set' ? `<@&${tierRoles.bell}>` : 'Not set'}`,
          `• Trench (Loud): ${tierRoles.trench !== 'Not set' ? `<@&${tierRoles.trench}>` : 'Not set'}`,
          `• Nuke (Critical): ${tierRoles.nuke !== 'Not set' ? `<@&${tierRoles.nuke}>` : 'Not set'}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Registered Users',
        value: `${userCount.length}`,
        inline: true,
      },
      {
        name: 'Guild',
        value: interaction.guild!.name,
        inline: true,
      },
    )
    .setFooter({ text: 'Use the buttons below to update settings' });

  const configRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('admin:set_history_channel')
      .setLabel('Set History Channel')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('admin:set_admin_roles')
      .setLabel('Manage Admin Roles')
      .setStyle(ButtonStyle.Secondary),
  );

  const tierRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('admin:set_tier_dd')
      .setLabel('Set DD (Silent) Role')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('admin:set_tier_bell')
      .setLabel('Set Bell (Ping) Role')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('admin:set_tier_trench')
      .setLabel('Set Trench (Loud) Role')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('admin:set_tier_nuke')
      .setLabel('Set Nuke (Critical) Role')
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.reply({ embeds: [adminEmbed], components: [configRow, tierRow], ephemeral: true });
}

async function handleHealth(interaction: ChatInputCommandInteraction) {
  // Only allow admins/owners
  let isUserAdmin = false;
  try {
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    isUserAdmin = member?.permissions.has('ADMINISTRATOR' as any) ?? false;
  } catch {
    isUserAdmin = false;
  }

  if (!isUserAdmin) {
    await interaction.reply({
      content: '❌ Permission Denied',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const prisma = (interaction.client as any).prisma as import('@prisma/client').PrismaClient;
  const guildService = new GuildService(prisma);
  const userRepository = new UserRepository(prisma);
  const { pushoverClient } = await import('../modules/pushover/pushover.client');

  const uptime = formatUptime(process.uptime());

  // Check database health
  let dbStatus = '❌ Disconnected';
  let registeredUsers = 0;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = '✅ Connected';
    registeredUsers = await userRepository.findAll().then((u) => u.length);
  } catch (error: any) {
    logger.error('Database health check failed', { error: error.message });
  }

  // Check Pushover API health
  let pushoverStatus = '❌ Unreachable';
  try {
    const ok = await pushoverClient.testConnection();
    pushoverStatus = ok ? '✅ Reachable' : '❌ Unreachable';
  } catch {
    // Use unreachable from init
  }

  // Discord gateway latency
  const wsPing = interaction.client.ws.ping;
  const gatewayStatus = wsPing < 10000 ? `✅ Connected (${wsPing}ms)` : '⚠️ High latency';

  const healthEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('✅ Bot Health Check')
    .addFields(
      { name: 'Database', value: dbStatus, inline: true },
      { name: 'Pushover API', value: pushoverStatus, inline: true },
      { name: 'Discord Gateway', value: gatewayStatus, inline: true },
      { name: 'Registered Users', value: `${registeredUsers}`, inline: true },
      { name: 'Active Guilds', value: `${interaction.client.guilds.cache.size}`, inline: true },
      { name: 'Uptime', value: uptime, inline: true },
    );

  await interaction.editReply({ embeds: [healthEmbed] });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (parts.length === 0) parts.push('Less than a minute');

  return parts.join(', ');
}