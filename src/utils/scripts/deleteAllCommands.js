require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// OPTIONAL: add your test guild ID to clean guild commands too
const GUILD_ID = '' //or leave null to skip

client.once('ready', async () => {
  try {
    console.log(`👋 Logged in as ${client.user.tag}`);

    // Global commands
    const globalCommands = await client.application.commands.fetch();
    for (const cmd of globalCommands.values()) {
      await client.application.commands.delete(cmd.id);
      console.log(`🗑 Deleted global command: ${cmd.name}`);
    }

    // Guild commands
    if (GUILD_ID) {
      const guild = await client.guilds.fetch(GUILD_ID);
      const guildCommands = await guild.commands.fetch();
      for (const cmd of guildCommands.values()) {
        await guild.commands.delete(cmd.id);
        console.log(`🗑 Deleted guild command: ${cmd.name}`);
      }
    }

    console.log('✅ Cleanup complete.');
  } catch (err) {
    console.error('❌ Error while deleting commands:', err);
  } finally {
    process.exit();
  }
});

client.login('MTA5NDU5MzIyNDYxMTQ3OTY3Mg.GFuA4g.Wda-Ffa0A3TepwjXV5Nu5-ffkShjlVa041dsv8');


