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
    GatewayIntentBits.GuildMessageReactions,
  ],
});
client.commands = new Collection();

// 🔧 This line was missing `()` at the end
(async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Found' : 'Missing');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });
    console.log('✅ Connected to MongoDB');
    
    console.log('🔄 Loading events...');
    eventHandler(client);
    console.log('✅ Events loaded');

    // ✅ Login to Discord **after** MongoDB is ready
    console.log('🔄 Logging in to Discord...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Logged in to Discord');
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
