require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const eventHandler = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});
client.commands = new Collection();

// 🔧 This line was missing `()` at the end
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    eventHandler(client);

    // ✅ Login to Discord **after** MongoDB is ready
    client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Logged in to Discord');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
  }
})();
