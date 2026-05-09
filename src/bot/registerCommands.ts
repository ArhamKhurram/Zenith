import { REST, Routes } from 'discord.js';
import { client, commands } from './client';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface CommandDefinition {
  data: any;
  execute: (interaction: any) => Promise<void>;
  handleModal?: (interaction: any) => Promise<void>;
  handleButton?: (interaction: any) => Promise<void>;
}

/**
 * Registers all slash commands with Discord.
 * Uses PUT to replace all commands (guild-specific for testing, global for production).
 */
export async function registerCommands(commandDefinitions: CommandDefinition[]): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  // Build command data
  const commandData = commandDefinitions.map((cmd) => cmd.data.toJSON());

  // Determine endpoint - use guild for development, global for production
  const endpoint =
    env.NODE_ENV === 'development' && env.DISCORD_TEST_GUILD_ID
      ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_TEST_GUILD_ID)
      : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

  try {
    logger.info('Started refreshing application (/) commands.', { commandCount: commandData.length });
    await rest.put(endpoint, { body: commandData });
    logger.info('Successfully reloaded application (/) commands.');
  } catch (error: any) {
    logger.error('Failed to register commands', { error: error.message });
    throw error;
  }

  // Store command definitions for routing
  commands.clear();
  for (const cmd of commandDefinitions) {
    commands.set(cmd.data.name, cmd);
  }
}