import { Client, GatewayIntentBits, Collection, ActivityType, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
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

  const commandDefinitions = [
    { data: helpData, execute: helpExecute },
    { data: registerData, execute: registerExecute },
    { data: settingsData, execute: settingsExecute, handleButton: handleSettingsButton, handleModal: handleSettingsModal },
    { data: alertAllData, execute: alertAllExecute },
    { data: adminData, execute: adminExecute },
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
      if (interaction.customId === 'settings:modal') {
        const settingsCmd = commands.get('settings');
        if (settingsCmd?.handleModal) {
          await settingsCmd.handleModal(interaction);
        }
        return;
      }
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