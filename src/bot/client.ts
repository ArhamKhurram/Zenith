import {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

export { client };
export const commands: Collection<string, any> = new Collection();

export async function initClient(): Promise<void> {
  await client.login(env.DISCORD_TOKEN);
}

client.once('clientReady', async () => {
  logger.info('Bot is ready', {
    tag: client.user?.tag,
    guilds: client.guilds.cache.size,
  });
  client.user?.setActivity('Protecting the server', { type: ActivityType.Watching });

  // Dynamically import and register commands
  const { data: helpData, execute: helpExecute } = await import('../commands/help.command');
  const { data: registerData, execute: registerExecute } = await import('../commands/register.command');
  const { data: settingsData, execute: settingsExecute, handleButton: handleSettingsButton, handleModal: handleSettingsModal } = await import('../commands/settings.command');
  const { data: alertAllData, execute: alertAllExecute } = await import('../commands/alertAll.command');
  const { data: adminData, execute: adminExecute } = await import('../commands/admin.command');
  const { data: setupData, execute: setupExecute } = await import('../commands/setup.command');

  const commandDefinitions = [
    { data: helpData, execute: helpExecute },
    { data: registerData, execute: registerExecute },
    { data: settingsData, execute: settingsExecute, handleButton: handleSettingsButton, handleModal: handleSettingsModal },
    { data: alertAllData, execute: alertAllExecute },
    { data: adminData, execute: adminExecute },
    { data: setupData, execute: setupExecute },
  ];

  const { registerCommands } = await import('./registerCommands');
  await registerCommands(commandDefinitions);

  logger.info('Slash commands registered', { count: commandDefinitions.length });
});

client.on('warn', (info) => {
  logger.warn('Discord client warning', { info });
});

client.on('error', (error: Error) => {
  logger.error('Discord client error', { error: error.message });
});

// Tier mapping: internal key -> role label and settings field
const TIER_MAPPING: Record<string, { label: string; settingKey: keyof import('@prisma/client').UserSettings }> = {
  dd: { label: 'DD (Silent)', settingKey: 'ddEnabled' },
  bell: { label: 'Bell (Ping)', settingKey: 'pingEnabled' },
  trench: { label: 'Trench (Loud)', settingKey: 'trenchEnabled' },
  nuke: { label: 'Nuke (Critical)', settingKey: 'nukeEnabled' },
};

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        logger.warn('Unknown command invoked', { commandName: interaction.commandName });
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
        return;
      }
      await command.execute(interaction as any);
    } else if (interaction.isModalSubmit()) {
      // Settings modal
      if (interaction.customId === 'settings:modal') {
        const settingsCmd = commands.get('settings');
        if (settingsCmd?.handleModal) {
          await settingsCmd.handleModal(interaction);
        }
        return;
      }
      // Admin: Manage Admin Roles modal
      if (interaction.customId === 'admin:modal_roles') {
        const prisma = (client as any).prisma;
         const { GuildService } = await import('../modules/guilds/guild.service');
        const guildService = new GuildService(prisma);

        const roleIds = interaction.fields.getTextInputValue('admin:role_ids');
        const guildId = interaction.guildId!;

        const result = await guildService.setAdminRoles(guildId, roleIds, interaction.guild!.name);
        await interaction.reply({ content: result.message, ephemeral: true });
        return;
      }
      // Admin: Modal submission for tier role assignment
      if (interaction.customId.startsWith('admin:modal_tier_')) {
        const prisma = (client as any).prisma;
         const { GuildService } = await import('../modules/guilds/guild.service');
        const guildService = new GuildService(prisma);

        const tierKey = interaction.customId.replace('admin:modal_tier_', '');
        const roleId = (interaction as any).fields.getTextInputValue('admin:tier_role_id').trim();

        const config = await guildService.getOrCreateGuildConfig(interaction.guildId!, interaction.guild!.name);

        // Parse existing tier roles
        let existingTierRoles: Record<string, string> = {};
        if (config.tierRoleIds) {
          try {
            existingTierRoles = JSON.parse(config.tierRoleIds);
          } catch {
            // ignore
          }
        }

        if (roleId) {
          existingTierRoles[tierKey] = roleId;
        } else {
          delete existingTierRoles[tierKey];
        }

        const result = await guildService.setTierRoles(
          interaction.guildId!,
          JSON.stringify(existingTierRoles),
          interaction.guild!.name,
        );

        const tierLabels: Record<string, string> = {
          dd: 'DD (Silent)',
          bell: 'Bell (Ping)',
          trench: 'Trench (Loud)',
          nuke: 'Nuke (Critical)',
        };

        await interaction.reply({
          content: result.success
            ? `✅ ${tierLabels[tierKey] || tierKey} role ${roleId ? 'set' : 'cleared'}.`
            : `❌ ${result.message}`,
          ephemeral: true,
        });
        return;
      }
    } else if (interaction.isButton()) {
      // Register remove cancel
      if (interaction.customId === 'register:cancel_remove') {
        await interaction.update({ content: 'Cancelled. Your key has not been removed.', components: [] });
        return;
      }
      // Register remove confirm
      if (interaction.customId === 'register:confirm_remove') {
        const { UserService } = await import('../modules/users/user.service');
        const prisma = (client as any).prisma;
        const userService = new UserService(prisma);
        const result = await userService.removeRegistration(interaction.user.id);
        await interaction.update({ content: result.message, components: [] });
        return;
      }
      // Settings edit button -> show modal
      if (interaction.customId === 'settings:edit') {
        const settingsCmd = commands.get('settings');
        if (settingsCmd?.handleButton) {
          await settingsCmd.handleButton(interaction);
        }
        return;
      }
      // Admin: Set History Channel button
      if (interaction.customId === 'admin:set_history_channel') {
        const prisma = (client as any).prisma;
         const { GuildService } = await import('../modules/guilds/guild.service');
        const guildService = new GuildService(prisma);

        const channelId = interaction.channelId;
        const result = await guildService.setAlertHistoryChannel(
          interaction.guildId!,
          channelId,
          interaction.guild!.name,
        );

        await interaction.update({
          content: result.success
            ? `✅ History channel set to <#${channelId}>.`
            : `❌ ${result.message}`,
          components: [],
        });
        return;
      }
      // Admin: Manage Admin Roles button -> show modal
      if (interaction.customId === 'admin:set_admin_roles') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const prisma = (client as any).prisma;
         const { GuildService } = await import('../modules/guilds/guild.service');
        const guildService = new GuildService(prisma);

        const config = await guildService.getOrCreateGuildConfig(interaction.guildId!, interaction.guild!.name);
        const currentRoles = config.adminRoleIds || '';

        const modal = new ModalBuilder()
          .setCustomId('admin:modal_roles')
          .setTitle('Manage Admin Roles');

        const roleInput = new TextInputBuilder()
          .setCustomId('admin:role_ids')
          .setLabel('Role IDs (comma-separated)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('e.g. 123456789,987654321')
          .setValue(currentRoles)
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(roleInput) as any);
        await interaction.showModal(modal);
        return;
      }
      // Admin: Set tier role buttons -> show modal for specific tier
      if (
        ['admin:set_tier_dd', 'admin:set_tier_bell', 'admin:set_tier_trench', 'admin:set_tier_nuke'].includes(
          interaction.customId,
        )
      ) {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
        const prisma = (client as any).prisma;
         const { GuildService } = await import('../modules/guilds/guild.service');
        const guildService = new GuildService(prisma);

        const config = await guildService.getOrCreateGuildConfig(interaction.guildId!, interaction.guild!.name);

        // Parse existing tier roles
        let existingTierRoles: Record<string, string> = {};
        if (config.tierRoleIds) {
          try {
            existingTierRoles = JSON.parse(config.tierRoleIds);
          } catch {
            // ignore
          }
        }

        const tierKey = interaction.customId.replace('admin:set_tier_', '');
        const tierLabels: Record<string, string> = {
          dd: 'DD (Silent)',
          bell: 'Bell (Ping)',
          trench: 'Trench (Loud)',
          nuke: 'Nuke (Critical)',
        };
        const currentRoleId = existingTierRoles[tierKey] || '';

        const modal = new ModalBuilder()
          .setCustomId(`admin:modal_tier_${tierKey}`)
          .setTitle(`Set ${tierLabels[tierKey] || tierKey} Role`);

        const roleInput = new TextInputBuilder()
          .setCustomId('admin:tier_role_id')
          .setLabel(`Discord Role ID for ${tierLabels[tierKey] || tierKey}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 123456789')
          .setValue(currentRoleId)
          .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(roleInput) as any);
        await interaction.showModal(modal);
        return;
      }
      // Admin: Modal submission for tier role assignment
      if (interaction.customId.startsWith('admin:modal_tier_')) {
        const prisma = (client as any).prisma;
         const { GuildService } = await import('../modules/guilds/guild.service');
        const guildService = new GuildService(prisma);

        const tierKey = interaction.customId.replace('admin:modal_tier_', '');
        const roleId = (interaction as any).fields.getTextInputValue('admin:tier_role_id').trim();

        const config = await guildService.getOrCreateGuildConfig(interaction.guildId!, interaction.guild!.name);

        // Parse existing tier roles
        let existingTierRoles: Record<string, string> = {};
        if (config.tierRoleIds) {
          try {
            existingTierRoles = JSON.parse(config.tierRoleIds);
          } catch {
            // ignore
          }
        }

        if (roleId) {
          existingTierRoles[tierKey] = roleId;
        } else {
          delete existingTierRoles[tierKey];
        }

        const result = await guildService.setTierRoles(
          interaction.guildId!,
          JSON.stringify(existingTierRoles),
          interaction.guild!.name,
        );

        const tierLabels: Record<string, string> = {
          dd: 'DD (Silent)',
          bell: 'Bell (Ping)',
          trench: 'Trench (Loud)',
          nuke: 'Nuke (Critical)',
        };

        await interaction.reply({
          content: result.success
            ? `✅ ${tierLabels[tierKey] || tierKey} role ${roleId ? 'set' : 'cleared'}.`
            : `❌ ${result.message}`,
          ephemeral: true,
        });
        return;
      }
      // Setup: Toggle buttons for role-based alert preferences
      if (interaction.customId.startsWith('setup:toggle_')) {
        const prisma = (client as any).prisma;
         const { GuildService } = await import('../modules/guilds/guild.service');
        const { UserService } = await import('../modules/users/user.service');
        const guildService = new GuildService(prisma);
        const userService = new UserService(prisma);

        const tierKey = interaction.customId.replace('setup:toggle_', '');
        const tierInfo = TIER_MAPPING[tierKey];

        if (!tierInfo) {
          await interaction.reply({ content: '❌ Unknown tier.', ephemeral: true });
          return;
        }

        const guildId = interaction.guildId!;
        const userId = interaction.user.id;

        // Get or create guild config
        const config = await guildService.getOrCreateGuildConfig(guildId, interaction.guild!.name);

        // Parse existing tier roles
        let tierRoles: Record<string, string> = {};
        if (config.tierRoleIds) {
          try {
            tierRoles = JSON.parse(config.tierRoleIds);
          } catch {
            // ignore
          }
        }

        const roleIdForTier = tierRoles[tierKey];

        // Check if the tier role is configured
        if (!roleIdForTier) {
          await interaction.reply({
            content: `❌ No Discord role is assigned for ${tierInfo.label}. Ask an admin to set it up with \`/admin config\`.`,
            ephemeral: true,
          });
          return;
        }

        // Get the guild member to check roles
        const member = await interaction.guild?.members.fetch(userId);
        if (!member) {
          await interaction.reply({ content: '❌ Could not fetch your profile.', ephemeral: true });
          return;
        }

        // Check if the user currently has the role
        const hasRole = member.roles.cache.has(roleIdForTier);

        // Determine new state: toggle
        const newState = !hasRole;

        // Update user settings in DB
        const update: Record<string, boolean> = {};
        update[tierInfo.settingKey] = newState;

        const result = await userService.updateSettings(userId, update);

        if (!result.success) {
          await interaction.reply({ content: result.message, ephemeral: true });
          return;
        }

        // Assign/remove the Discord role
        if (newState) {
          await member.roles.add(roleIdForTier);
        } else {
          await member.roles.remove(roleIdForTier);
        }

        // Reconstruct the setup embed with updated button styles
        const { setupRow } = await buildSetupComponents(guildService, guildId);
        const description = buildSetupDescription();

        const embed = new EmbedBuilder()
          .setColor(newState ? 0x2ecc71 : 0xe74c3c)
          .setTitle('📢 Zenith Alerts — Setup')
          .setDescription(description)
          .addFields(
            {
              name: `🔕 DD (Silent) ${tierKey === 'dd' ? (newState ? '✅ Enabled' : '❌ Disabled') : ''}`,
              value: 'Low-priority directional-dialogue alerts.\nLowest urgency, no sound.',
              inline: true,
            },
            {
              name: `🔔 Bell (Ping) ${tierKey === 'bell' ? (newState ? '✅ Enabled' : '❌ Disabled') : ''}`,
              value: 'Standard notification alerts.\nShort push sound on your phone.',
              inline: true,
            },
            {
              name: `📡 Trench (Loud) ${tierKey === 'trench' ? (newState ? '✅ Enabled' : '❌ Disabled') : ''}`,
              value: 'Important alerts that need attention.\nLoud repeating sound.',
              inline: true,
            },
            {
              name: `🚨 Nuke (Critical) ${tierKey === 'nuke' ? (newState ? '✅ Enabled' : '❌ Disabled') : ''}`,
              value: 'Emergency / critical alerts.\nSiren sound, retries every 60s for 1 hour.',
              inline: true,
            },
          )
          .setFooter({ text: `Click the buttons below to toggle roles | ${tierInfo.label} ${newState ? 'enabled' : 'disabled'}` });

        await interaction.update({ embeds: [embed], components: [setupRow] });
        return;
      }
    }
  } catch (error: any) {
    logger.error('Error handling interaction', { error: error.message, stack: error.stack });
    const msg = error.isOperational ? error.message : 'An unexpected error occurred.';
    try {
      const inter = interaction as any;
      if (inter.replied || inter.deferred) {
        await inter.followUp({ content: msg, ephemeral: true });
      } else {
        await inter.reply({ content: msg, ephemeral: true });
      }
    } catch (e: any) {
      logger.error('Failed to send error reply', { error: e.message });
    }
  }
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages and DMs
  if (message.author.bot || !message.guildId) return;
  // Only process messages from users with admin/setup roles or general chat — process all messages

  try {
    const prisma = (client as any).prisma;
      const { PushoverService } = await import('../modules/pushover/pushover.service');
      const { GuildService } = await import('../modules/guilds/guild.service');

    const pushoverService = new PushoverService(prisma);
    const guildService = new GuildService(prisma);

    const config = await guildService.getOrCreateGuildConfig(message.guildId, message.guild!.name);

    // Parse tier roles from guild config
    let tierRoles: Record<string, string> = {};
    if (config.tierRoleIds) {
      try {
        tierRoles = JSON.parse(config.tierRoleIds);
      } catch {
        return; // No valid tier roles configured
      }
    }

    if (Object.keys(tierRoles).length === 0) return;

    // Check if any tier role is mentioned in this message
    const mentionedTierKeys: string[] = [];
    for (const [tierKey, roleId] of Object.entries(tierRoles)) {
      const roleMention = `<@&${roleId}>`;
      if (message.content.includes(roleMention)) {
        mentionedTierKeys.push(tierKey);
      }
    }

    if (mentionedTierKeys.length === 0) return;

    // Remove bot mentions and role mentions from content for cleanliness
    const cleanContent = message.content.replace(/<@!?\d+>/g, '').replace(/<@&\d+>/g, '').trim();

    // Get the triggering user info
    const member = await message.guild!.members.fetch(message.author.id);
    const triggerUsername = member?.displayName || message.author.username;

    // Send alerts for each mentioned tier
    for (const tierKey of mentionedTierKeys) {
      const tierLabels: Record<string, string> = {
        dd: 'DD (Silent)',
        bell: 'Bell (Ping)',
        trench: 'Trench (Loud)',
        nuke: 'Nuke (Critical)',
      };

      const result = await pushoverService.broadcast(
        message.guildId,
        message.author.id,
        triggerUsername,
        tierKey,
        cleanContent,
      );

      // React to the message to confirm delivery
      const emojiMap: Record<string, string> = {
        dd: '🔕',
        bell: '🔔',
        trench: '📡',
        nuke: '🚨',
      };

      if (result.successCount > 0) {
        await message.react(emojiMap[tierKey] || '✅');
        logger.info('Role mention alert delivered', {
          channelId: message.channelId,
          tier: tierKey,
          successCount: result.successCount,
          mentionedBy: message.author.id,
        });
      } else {
        await message.react('⚠️');
        logger.warn('Role mention alert had no eligible recipients', {
          tier: tierKey,
          mentionedBy: message.author.id,
        });
      }
    }
  } catch (error: any) {
    logger.error('Error processing role mention alert', { error: error.message, stack: error.stack });
  }
});

// Helper to build setup embed description
function buildSetupDescription(): string {
  return (
    'Configure your alert preferences by toggling roles below.\n\n' +
    '**Step 1:** Register your Pushover key with `/register add <key>`\n' +
    '**Step 2:** Enable the alert tiers you want to receive\n' +
    '**Step 3:** Get notified on your phone!\n\n' +
    'Each button toggles a Discord role that maps to an alert tier.\n' +
    'When a role is **enabled**, you will receive that tier of Pushover alerts.\n' +
    'When a role is **disabled**, you will stop receiving that tier.\n'
  );
}

// Helper to build setup ActionRow with toggle buttons
async function buildSetupComponents(guildService: any, guildId: string): Promise<{ setupRow: ActionRowBuilder<ButtonBuilder> }> {
  const config = await guildService.getOrCreateGuildConfig(guildId);
  let tierRoles: Record<string, string> = {};
  if (config.tierRoleIds) {
    try {
      tierRoles = JSON.parse(config.tierRoleIds);
    } catch {
      // ignore
    }
  }

  const tierButtons = [
    { key: 'dd', label: '🔕 DD (Silent)', style: ButtonStyle.Secondary },
    { key: 'bell', label: '🔔 Bell (Ping)', style: ButtonStyle.Secondary },
    { key: 'trench', label: '📡 Trench (Loud)', style: ButtonStyle.Secondary },
    { key: 'nuke', label: '🚨 Nuke (Critical)', style: ButtonStyle.Secondary },
  ];

  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const tier of tierButtons) {
    const roleId = tierRoles[tier.key];
    let buttonStyle = tier.style;
    let buttonLabel = tier.label;

    if (roleId) {
      buttonStyle = ButtonStyle.Success;
      buttonLabel = `✅ ${tier.label.replace(/^[^\s]+/, '')}`.trim();
    }

    const button = new ButtonBuilder()
      .setCustomId(`setup:toggle_${tier.key}`)
      .setLabel(buttonLabel)
      .setStyle(buttonStyle);

    row.addComponents(button);
  }

  return { setupRow: row };
}