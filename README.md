# Zenith Alerts - Discord Pushover Notification Bot

A Discord bot that allows users to register Pushover keys and receive broadcast alerts from admins.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Configuration](#configuration)
- [Running](#running)
- [Docker](#docker)
- [Commands](#commands)
- [Testing](#testing)
- [Project Structure](#project-structure)

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 15+
- [Pushover](https://pushover.net) account and application token

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/ArhamKhurram/Zenith.git
cd Zenith
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```env
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/zenith

# Pushover
PUSHOVER_APP_TOKEN=your_pushover_app_token

# Security
ENCRYPTION_KEY=base64_encoded_32_byte_key

# Permissions (optional)
ADMIN_ROLE_IDS=123456789012345678
OWNER_DISCORD_IDS=123456789012345678
```

### 4. Set up Prisma

```bash
npx prisma migrate dev --name init
# Or for existing databases:
npx prisma db pull
npx prisma generate
```

## Running

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f bot

# Stop
docker-compose down
```

## Commands

### User Commands

| Command | Description |
|---------|-------------|
| `/help` | Show bot usage guide |
| `/register add <key>` | Register your Pushover key |
| `/register list` | View your registration status |
| `/register remove` | Remove your Pushover key |
| `/settings` | Configure notification preferences |

### Admin Commands

| Command | Description |
|---------|-------------|
| `/alert all silent <message>` | Send silent notification |
| `/alert all bell <message>` | Send bell notification |
| `/alert all critical <message>` | Send critical emergency alert |
| `/admin config` | Configure guild settings |
| `/admin health` | Check bot health |

## Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage
```

## Project Structure

```
src/
├── index.ts                 # Entry point
├── bot/
│   ├── client.ts            # Discord client setup
│   ├── registerCommands.ts  # Deploy slash commands
│   └── interactionRouter.ts # Route interactions
├── commands/
│   ├── help.command.ts
│   ├── register.command.ts
│   ├── settings.command.ts
│   ├── alertAll.command.ts
│   └── admin.command.ts
├── modules/
│   ├── users/
│   │   ├── user.repository.ts
│   │   ├── user.service.ts
│   │   └── encryption.util.ts
│   ├── pushover/
│   │   ├── pushover.client.ts
│   │   └── pushover.service.ts
│   ├── alerts/
│   │   ├── alert.repository.ts
│   │   └── alert.service.ts
│   └── guilds/
│       ├── guild.repository.ts
│       └── guild.service.ts
├── config/
│   └── env.ts
├── utils/
│   ├── logger.ts
│   ├── errors.ts
│   └── permissions.ts
├── prisma/
│   └── schema.prisma
└── tests/
    ├── unit/
    │   ├── encryption.test.ts
    │   ├── masking.test.ts
    │   └── permissions.test.ts
    ├── integration/
    │   └── register.test.ts
    └── jest-setup.ts
```

## Security

- All Pushover keys are encrypted at rest using AES-256-GCM
- Keys are never logged or displayed in plain text
- Registration commands are ephemeral (only visible to the user)
- Admin commands require appropriate permissions

## License

ISC