// Set required environment variables before any modules are loaded
process.env.DISCORD_TOKEN = 'NDcxMjM0NTY3ODkwfQ.XLhMuw.8aKjzP4mYwL0nHq3vF2tG9rS5eD7bNc1A2f3G';
process.env.DISCORD_CLIENT_ID = '123456789012345678';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.PUSHOVER_APP_TOKEN = 'a1b2c3d4e5f6g7h8i9j0a1b2c3d4e5'; // exactly 30 chars
process.env.ENCRYPTION_KEY = 'dGVzdGVuY3J5cHRpb25rZXkwMTIzNDU2Nzg5MDEyMzQ='; // 32 bytes base64
process.env.NODE_ENV = 'test';