module.exports = async (client, message) => {
  if (message.author.bot) return;

    if (message.content.toLowerCase() === 'is vanq a bitch?') {
        if (message.author.id === "709272957192634472") {
            message.channel.send("nigga why you asking if YOU yourself are a bitch.");
        } else {
            message.channel.send("yea vanq is a bitch.");
        }
    }
}