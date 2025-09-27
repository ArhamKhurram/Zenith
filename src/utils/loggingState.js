// Simple logging state management (no memory storage)
let isLogging = false;

module.exports = {
    getLoggingState: () => isLogging,
    
    setLoggingState: (state) => {
        isLogging = state;
    },
    
    // Only log to console, no memory storage
    logMessage: (messageData) => {
        if (isLogging) {
            console.log(`📝 [${messageData.serverName}] #${messageData.channelName} | ${messageData.username}: ${messageData.content}`);
        }
    }
};