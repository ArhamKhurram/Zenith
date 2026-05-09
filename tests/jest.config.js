module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/setupEnv.ts'],
  collectCoverageFrom: [
    'src/modules/users/encryption.util.ts',
    'src/modules/users/user.service.ts',
    'src/utils/permissions.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};