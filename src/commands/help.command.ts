import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show bot usage guide');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📢 Zenith Alerts - Help')
    .setDescription(
      'Get push notifications for important server announcements.\n\n' +
        '**Getting Started:**\n' +
        '1. Get your Pushover user key from https://pushover.net\n' +
        '2. Use `/register add <key>` to register\n' +
        '3. Use `/setup` to configure alert role preferences\n' +
        '4. Use `/settings` to customize your notification toggles\n',
    )
    .addFields(
      {
        name: 'User Commands',
        value:
          '`/register add <key>` - Add your Pushover key\n' +
          '`/register list` - View registration status\n' +
          '`/register remove` - Remove your key\n' +
          '`/setup` - Set up alert roles (toggle DD/Bell/Trench/Nuke)\n' +
          '`/settings` - Configure notification preferences',
        inline: false,
      },
      {
        name: 'Admin Commands',
        value:
          '`/alert all silent <message>` - Send silent notification\n' +
          '`/alert all bell <message>` - Send bell notification\n' +
          '`/alert all critical <message>` - Send critical alert\n' +
          '`/admin config` - Configure guild settings & tier roles\n' +
          '`/admin health` - Check bot health',
        inline: false,
      },
    )
    .addFields({
      name: 'Need help?',
      value: 'Contact a server admin.',
      inline: false,
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}