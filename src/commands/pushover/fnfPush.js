const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require('discord.js');
const PushoverConfig = require('../../models/PushoverConfig');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
  deleted: false,
  name: 'fnf-push',
  description: 'Send a Pushover alert to FNF group members individually.',
  options: [
    {
      name: 'message',
      description: 'Message to send via Pushover.',
      required: true,
      type: ApplicationCommandOptionType.String,
    },
  ],
  permissionsRequired: [],
  botPermissions: [PermissionFlagsBits.SendMessages],

  callback: async (client, interaction) => {
    const message = interaction.options.getString('message');
  // Only message is required now

    // Check if Pushover is configured
    const config = await PushoverConfig.findOne({ guildId: interaction.guild.id });
    if (!config) {
      return interaction.reply({ content: '❌ Pushover is not configured for this server.', ephemeral: true });
    }

    // Check if user has the FNF alert role
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (config.fnfAlertRole && !member.roles.cache.has(config.fnfAlertRole)) {
      return interaction.reply({ content: '❌ You do not have the FNF alert role required to use this command.', ephemeral: true });
    }

    try {
      // Load FNF user keys from JSON file
      const fnfKeysPath = path.join(__dirname, '../../../fnf-keys.json');
      let fnfKeys;
      
      try {
        const fnfKeysData = await fs.readFile(fnfKeysPath, 'utf8');
        fnfKeys = JSON.parse(fnfKeysData);
      } catch (err) {
        return interaction.reply({ content: '❌ FNF keys file not found or invalid. Please check fnf-keys.json', ephemeral: true });
      }

      if (!Array.isArray(fnfKeys) || fnfKeys.length === 0) {
        return interaction.reply({ content: '❌ No FNF user keys found in the configuration.', ephemeral: true });
      }

      // Send initial response
      await interaction.reply('📤 Sending FNF alerts...');

      let successCount = 0;
      let failureCount = 0;
      const errors = [];

      // Send alerts to each user individually
      for (const userKey of fnfKeys) {
        try {
          const params = new URLSearchParams({
            token: config.apiKey,
            user: userKey,
            message: message,
            priority: 2,
            retry: 30,
            expire: 1800,
          });

          // No title/url support -- only send the message

          await axios.post('https://api.pushover.net/1/messages.json', params);
          successCount++;
        } catch (err) {
          failureCount++;
          errors.push(`User key ${userKey}: ${err.response?.data?.errors?.[0] || err.message}`);
        }
      }

      // Send final status
      let statusMessage = `✅ FNF alerts sent!\n📊 **Results:** ${successCount} successful, ${failureCount} failed`;
      
      if (errors.length > 0) {
        statusMessage += `\n\n❌ **Errors:**\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          statusMessage += `\n... and ${errors.length - 5} more errors`;
        }
      }

      await interaction.editReply(statusMessage);

    } catch (err) {
      console.error('FNF push error:', err);
      await interaction.editReply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  },
};
