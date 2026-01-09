const priceMonitor = require('../../utils/priceMonitor');

module.exports = (client) => {
        // inject client so the price monitor can send channel/DM alerts
        try {
            if (priceMonitor && typeof priceMonitor.setClient === 'function') priceMonitor.setClient(client);
        } catch (e) {
            // ignore
        }

        console.log(
                `\n\n${client.user.username} is online and ready to serve!`
        )
};