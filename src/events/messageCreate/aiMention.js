// // events/messageCreate/aiMention.js
// const askGemini = require('../../utils/gemini');

// module.exports = async (client, message) => {
//   if (message.author.bot) return;

//   if (message.mentions.everyone || message.mentions.roles.size > 0) return;

//   if (message.mentions.has(client.user)) {
//     const userInput = message.content.replace(/<@!?(\d+)>/, '').trim();

//     if (!userInput) {
//       return message.reply("Shut the fuck up nigga.");
//     }

//     await message.channel.sendTyping();

//     // 🧠 Custom context or personality
//     const prefix = "You are a thug who's familiar with all the slang that new gen uses like adin ross, AMP house, and streamers, named Zenith. Be chill and dont mention all that shit. Thats just your personality. Use their tone and how they speak. But dont mention them. Also be composed, u yapping too much, gotta stop with that. One or two sentence answers. Be sassy kinda. Answer like Zenith would.";
//     const prompt = `${prefix}\n\n${userInput}`;

//     const reply = await askGemini(prompt);
//     message.reply(reply);
//   }
// };
