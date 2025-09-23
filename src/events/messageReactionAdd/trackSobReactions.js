const Sob = require('../../models/Sobs');

module.exports = async (client, reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;

    // Check if it's a sob emoji
    const sobEmoji = '😭';
    if (reaction.emoji.name !== sobEmoji) return;

    // Fetch the reaction and message if they're partial
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
        }
    }

    if (reaction.message.partial) {
        try {
            await reaction.message.fetch();
        } catch (error) {
            console.error('Error fetching message:', error);
            return;
        }
    }

    const message = reaction.message;

    // Don't track sobs on bot messages
    if (message.author.bot) return;

    // Don't allow self-sobbing
    if (user.id === message.author.id) return;

    try {
        // Check if this sob reaction already exists
        const existingSob = await Sob.findOne({
            messageId: message.id,
            reactorId: user.id
        });

        if (existingSob) {
            console.log(`Sob reaction already tracked for message ${message.id} by user ${user.username}`);
            return;
        }

        // Create new sob entry
        const sobData = {
            reactorId: user.id,
            reactorUsername: user.username,
            targetUserId: message.author.id,
            targetUsername: message.author.username,
            messageId: message.id,
            channelId: message.channel.id,
            guildId: message.guild.id,
            messageContent: message.content ? message.content.slice(0, 500) : '[No text content]'
        };

        await Sob.create(sobData);
        // console.log(`✅ Sob tracked: ${user.username} sobbed at ${message.author.username}'s message`);

    } catch (error) {
        console.error('Error tracking sob reaction:', error);
    }
};
