module.exports = async (client, message) => {
  // Ignore all bot messages except Rick
  const rickId = '1081815963990761542'; // Replace with Rick's actual bot ID
  const guildId = '914516203609931816';
  if (message.author.bot && message.author.id !== rickId) return;


  // 🧠 Rick embed reaction logic
  if (
    message.author.id === rickId &&
    message.embeds.length > 0 &&
    message.guild && // make sure it's in a server
    message.guild.id === guildId
  ) {
    try {
      await message.react('✅');
      await message.react('❌');
    } catch (err) {
      console.error('❌ Failed to react to Rick embed:', err);
    }
  }
};
