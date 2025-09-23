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

    try {
        // Remove the sob entry when reaction is removed
        const deletedSob = await Sob.findOneAndDelete({
            messageId: message.id,
            reactorId: user.id
        });

        if (deletedSob) {
            // console.log(`✅ Sob reaction removed: ${user.username} un-sobbed ${deletedSob.targetUsername}'s message`);
        }

    } catch (error) {
        console.error('Error removing sob reaction:', error);
    }
};
