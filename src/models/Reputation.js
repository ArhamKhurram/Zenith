// Reputation model stub: the reputation system has been removed.
// This stub provides safe no-op methods so any remaining requires won't crash.

module.exports = {
  findOne: async () => null,
  find: async () => [],
  create: async (obj) => ({ ...obj }),
  // generic fallback
  __removed: true,
};
