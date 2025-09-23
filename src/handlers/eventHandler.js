const path = require('path');
const getAllFiles = require('../utils/getAllFiles');

module.exports = (client) => {
  const eventFolders = getAllFiles(path.join(__dirname, '..', 'events'), true);

  for (const eventFolder of eventFolders) {
    const eventFiles = getAllFiles(eventFolder);
    eventFiles.sort((a, b) => a.localeCompare(b));

    const eventName = eventFolder.replace(/\\/g, '/').split('/').pop();

    client.on(eventName, async (...args) => {
      for (const eventFile of eventFiles) {
        try {
          const eventFunction = require(eventFile);
          if (typeof eventFunction !== 'function') {
            console.error(`❌ Event file ${eventFile} does not export a function`);
            continue;
          }
          await eventFunction(client, ...args);
        } catch (error) {
          console.error(`❌ Error in event file ${eventFile}:`, error.message);
        }
      }
    });
  }
};
