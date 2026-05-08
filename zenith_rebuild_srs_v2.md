# Zenith Alerts - Software Requirements Specification v2.0

## 0. Purpose

Build a focused Discord bot that allows users to register Pushover keys and receive broadcast alerts from admins.

**In Scope:**
- User registration of Pushover keys (encrypted storage)
- User notification preferences (dd/ping/trench/nuke levels)
- Admin broadcast commands with different urgency levels
- Alert history logging in Discord

**Out of Scope (Not in MVP):**
- Automated price monitoring
- DEX/token alerts
- AI recap systems
- Message logging
- Reputation systems
- Moderation commands
- Any old Zenith legacy features

---

## 1. Product Name

**Product Name:** Zenith Alerts  
**Package Name:** `Zenith`  
**Repository:** Clean rebuild, not a fork of ArhamKhurram/Zenith

---

## 2. System Overview

A Discord bot that:
1. Lets users register their Pushover API key
2. Lets users configure notification intensity preferences
3. Lets admins broadcast alerts to all registered users
4. Logs all broadcasts in a dedicated Discord channel

```
┌─────────────┐
│ Discord User│
└──────┬──────┘
       │ /register add KEY
       ▼
┌─────────────────┐      ┌──────────────┐
│  Zenith Bot     │─────▶│  PostgreSQL  │
│  (Node.js)      │      │  (encrypted) │
└────────┬────────┘      └──────────────┘
         │ /alert all critical "Emergency!"
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Pushover API   │─────▶│ User's Phone │
└─────────────────┘      └──────────────┘
```

---

## 3. Hard Requirements

### 3.1 Technology Stack
- **Language:** TypeScript
- **Runtime:** Node.js 20 LTS
- **Discord Library:** discord.js v14
- **Database:** PostgreSQL 15+
- **ORM:** Prisma 5.x
- **Command Type:** Slash commands only (no prefix commands)

### 3.2 Security Requirements
- All Pushover user keys MUST be encrypted at rest using AES-256-GCM
- Encryption key MUST be stored in environment variable `ENCRYPTION_KEY`
- Never log raw Pushover keys (always use masking: `uABC...xyz`)
- Never expose keys in Discord messages (even ephemeral)
- Use ephemeral replies for all registration commands

### 3.3 Architecture Requirements
- Modular structure: commands → services → repositories → clients
- No hardcoded Discord IDs, tokens, or API keys
- All configuration via environment variables
- Fail fast on missing required env vars
- Structured JSON logging

---

## 4. User Stories

### 4.1 User Registration
**As a Discord user**, I want to register my Pushover key so I can receive alerts on my phone.

**Acceptance Criteria:**
- I can add my key with `/register add <key>`
- I can view my registration status with `/register list` (key is masked)
- I can remove my key with `/register remove`
- All registration commands are ephemeral (only I can see them)
- If I try to use alerts without registering, I get a helpful error message

### 4.2 User Settings
**As a registered user**, I want to configure which types of alerts I receive so I'm not overwhelmed.

**Acceptance Criteria:**
- I can run `/settings` to see my current preferences
- I can toggle on/off: DD, Ping, Trench, Nuke alert types
- I can toggle on/off broadcast alerts entirely
- My preferences are saved and persist across bot restarts
- Settings changes take effect immediately

### 4.3 Admin Broadcasts
**As an admin**, I want to send alerts to all registered users with different urgency levels.

**Acceptance Criteria:**
- I can use `/alert all silent <message>` for low-priority notices
- I can use `/alert all bell <message>` for important alerts
- I can use `/alert all critical <message>` for emergencies
- Non-admins cannot use these commands
- I receive a summary of how many users were notified
- Failed notifications are logged but don't block the command

### 4.4 Alert History
**As an admin**, I want to see a history of all broadcasts so I can audit what was sent.

**Acceptance Criteria:**
- Each broadcast is logged in a dedicated Discord channel
- Logs include: alert type, message text, sender, notification counts, timestamp, link to original message
- Logs persist even if the bot restarts

---

## 5. Data Models

### 5.1 Prisma Schema

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Stores encrypted Pushover user keys
model UserRegistration {
  id                String   @id @default(uuid())
  discordUserId     String   @unique
  discordUsername   String
  pushoverKeyEnc    String   // AES-256-GCM encrypted
  encryptionIv      String   // Unique IV per record
  registeredAt      DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  settings UserSettings?
  
  @@index([discordUserId])
}

// User notification preferences
model UserSettings {
  id                        String   @id @default(uuid())
  userId                    String   @unique
  user                      UserRegistration @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Alert type toggles
  ddEnabled                 Boolean  @default(true)
  pingEnabled               Boolean  @default(true)
  trenchEnabled             Boolean  @default(true)
  nukeEnabled               Boolean  @default(false) // Conservative default
  
  // Global toggle
  broadcastAlertsEnabled    Boolean  @default(true)
  
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  
  @@index([userId])
}

// Guild-specific configuration
model GuildConfig {
  id                    String   @id @default(uuid())
  guildId               String   @unique
  guildName             String
  
  // Channel where alert history is logged
  alertHistoryChannelId String?
  
  // Role IDs that can broadcast alerts (comma-separated)
  adminRoleIds          String?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@index([guildId])
}

// Audit log for all broadcasts
model AlertAuditLog {
  id                String   @id @default(uuid())
  guildId           String
  
  // Who sent it
  triggerUserId     String
  triggerUsername   String
  
  // What was sent
  alertType         String   // "silent" | "bell" | "critical"
  messageText       String
  
  // Results
  attemptedCount    Int
  successCount      Int
  failureCount      Int
  
  // Discord context
  sourceMessageId   String?
  sourceChannelId   String?
  historyMessageId  String?  // ID of the embed in history channel
  
  createdAt         DateTime @default(now())
  
  @@index([guildId, createdAt])
}
```

---

## 6. Command Specifications

### 6.1 User Commands

#### `/help`
**Description:** Show bot usage guide  
**Permissions:** Everyone  
**Response:** Ephemeral embed with command list and getting started guide

**Response Format:**
```
📢 Zenith Alerts - Help

Get push notifications for important server announcements.

Getting Started:
1. Get your Pushover user key from https://pushover.net
2. Use /register add <key> to register
3. Use /settings to customize your alerts

Commands:
• /register add - Add your Pushover key
• /register list - View registration status
• /register remove - Remove your key
• /settings - Configure notification preferences

Admin Commands:
• /alert all silent - Send silent notification
• /alert all bell - Send bell notification  
• /alert all critical - Send critical alert

Need help? Contact a server admin.
```

---

#### `/register add <pushover_key>`
**Description:** Register or update Pushover user key  
**Permissions:** Everyone  
**Options:**
- `pushover_key` (String, required): Your Pushover user key

**Validation:**
- Key must be 30 characters
- Key must be alphanumeric
- Validate format: `^[a-zA-Z0-9]{30}$`

**Flow:**
1. Validate key format
2. Encrypt key with AES-256-GCM + unique IV
3. Upsert UserRegistration record
4. Create default UserSettings if new user
5. Reply ephemerally

**Success Response:**
```
✅ Pushover Key Registered

Your key has been saved securely.
Use /settings to configure alert preferences.
```

**Error Responses:**
```
❌ Invalid Key Format
Pushover keys must be exactly 30 alphanumeric characters.
Example: uABC123xyz4567890DEFGHIJKLMNO

❌ Registration Failed
Could not save your key. Please try again or contact an admin.
```

---

#### `/register list`
**Description:** View registration status  
**Permissions:** Everyone  
**Response:** Ephemeral

**If Registered:**
```
✅ Registration Status

Pushover Key: uABC...xyz (registered)
Registered: Jan 15, 2025

Use /settings to manage preferences.
Use /register remove to unregister.
```

**If Not Registered:**
```
❌ Not Registered

You haven't registered a Pushover key yet.
Use /register add <key> to get started.
```

---

#### `/register remove`
**Description:** Delete Pushover key and settings  
**Permissions:** Everyone  
**Response:** Ephemeral with confirmation button

**Initial Response:**
```
⚠️ Confirm Removal

This will delete your Pushover key and all settings.
You will stop receiving alerts immediately.

Are you sure?

[Cancel] [Yes, Remove My Key]
```

**After Confirmation:**
```
✅ Registration Removed

Your Pushover key and settings have been deleted.
You will no longer receive alerts.
```

---

#### `/settings`
**Description:** Configure notification preferences  
**Permissions:** Everyone (must be registered)  
**Response:** Ephemeral

**Flow:**
1. Check if user is registered
2. Fetch current UserSettings
3. Show settings embed with "Edit" button
4. When "Edit" clicked, show modal with toggles
5. Save changes and confirm

**Settings Embed:**
```
⚙️ Your Alert Settings

Alert Types:
• DD (Silent): ✅ Enabled
• Ping (Bell): ✅ Enabled
• Trench (Loud): ✅ Enabled
• Nuke (Critical): ❌ Disabled

Broadcast Alerts: ✅ Enabled

[Edit Settings]
```

**Edit Modal Fields:**
- DD Alerts (Toggle)
- Ping Alerts (Toggle)
- Trench Alerts (Toggle)
- Nuke Alerts (Toggle)
- Broadcast Alerts (Toggle)

**After Save:**
```
✅ Settings Updated

Your preferences have been saved.
```

**If Not Registered:**
```
❌ Not Registered

You need to register first with /register add <key>
```

---

### 6.2 Admin Commands

#### `/alert all silent <message>`
**Description:** Send silent notification (no sound)  
**Permissions:** Admins only  
**Options:**
- `message` (String, required, max 1024 chars): Alert message

**Pushover Mapping:**
- Priority: `-1` (silent)
- Sound: None
- Retry/Expire: Not applicable

**Flow:**
1. Check user has admin role
2. Fetch all users where `broadcastAlertsEnabled = true` AND `ddEnabled = true`
3. Decrypt each user's Pushover key
4. Send Pushover notifications in parallel (max 10 concurrent)
5. Log results to AlertAuditLog
6. Post history embed in configured channel
7. Reply with summary

**Success Response:**
```
✅ Silent Alert Sent

Notified: 42 users
Failed: 1 user
Type: DD (Silent)

History logged in #alert-history
```

---

#### `/alert all bell <message>`
**Description:** Send bell notification (short sound)  
**Permissions:** Admins only  
**Options:**
- `message` (String, required, max 1024 chars): Alert message

**Pushover Mapping:**
- Priority: `1` (high)
- Sound: `pushover` (default bell)
- Retry/Expire: Not applicable

**Flow:** Same as `/alert all silent` but filters for `pingEnabled = true`

**Success Response:**
```
✅ Bell Alert Sent

Notified: 38 users
Failed: 0 users
Type: Ping (Bell)

History logged in #alert-history
```

---

#### `/alert all critical <message>`
**Description:** Send critical emergency alert (loud alarm, repeating)  
**Permissions:** Admins only  
**Options:**
- `message` (String, required, max 1024 chars): Alert message

**Pushover Mapping:**
- Priority: `2` (emergency)
- Sound: `siren` (loud alarm)
- Retry: `60` (retry every 60 seconds)
- Expire: `3600` (expire after 1 hour)

**Flow:** Same as above but filters for:
- Alert type determines filter:
  - `critical` → `nukeEnabled = true`

**Success Response:**
```
🚨 CRITICAL Alert Sent

Notified: 12 users
Failed: 0 users
Type: Nuke (Emergency)

⚠️ This alert will retry for 1 hour until acknowledged.

History logged in #alert-history
```

**Permission Denied:**
```
❌ Permission Denied

You don't have permission to broadcast alerts.
Contact a server admin.
```

---

#### `/admin config`
**Description:** Configure guild settings  
**Permissions:** Admins only  
**Response:** Ephemeral

**Shows:**
- Current alert history channel
- Current admin roles
- Total registered users in guild

**Includes buttons:**
- Set History Channel
- Manage Admin Roles

---

#### `/admin health`
**Description:** Check bot health  
**Permissions:** Admins only  
**Response:** Ephemeral

**Shows:**
```
✅ Bot Health Check

Database: ✅ Connected
Pushover API: ✅ Reachable
Discord Gateway: ✅ Connected (35ms)

Registered Users: 47
Active Guilds: 1

Uptime: 3 days, 4 hours
```

---

## 7. Alert History Embed Format

**Posted in configured history channel after each broadcast:**

```
🔔 Alert Broadcast

Type: @ping (Bell)
Message: "Server maintenance in 30 minutes. Please save your work."

Sent by: @AdminUsername
Notified: 38 users ✅
Failed: 0 users

🔗 Jump to Message

━━━━━━━━━━━━━━━━━━━━
Today at 3:45 PM
```

**Color Coding:**
- Silent (DD): Gray (#95a5a6)
- Bell (Ping): Blue (#3498db)
- Critical (Nuke): Red (#e74c3c)

---

## 8. Pushover Client Specification

### 8.1 API Endpoint
```
POST https://api.pushover.net/1/messages.json
```

### 8.2 Request Format

**For Silent Alerts:**
```json
{
  "token": "APP_TOKEN_FROM_ENV",
  "user": "USER_KEY_DECRYPTED",
  "message": "Alert message text",
  "priority": -1,
  "timestamp": 1234567890
}
```

**For Bell Alerts:**
```json
{
  "token": "APP_TOKEN_FROM_ENV",
  "user": "USER_KEY_DECRYPTED",
  "message": "Alert message text",
  "title": "Zenith Alert",
  "priority": 1,
  "sound": "pushover",
  "timestamp": 1234567890
}
```

**For Critical Alerts:**
```json
{
  "token": "APP_TOKEN_FROM_ENV",
  "user": "USER_KEY_DECRYPTED",
  "message": "Alert message text",
  "title": "🚨 CRITICAL ALERT",
  "priority": 2,
  "sound": "siren",
  "retry": 60,
  "expire": 3600,
  "timestamp": 1234567890
}
```

### 8.3 Error Handling

| Status Code | Meaning | Action |
|------------|---------|--------|
| 200 | Success | Log success, increment successCount |
| 400 | Invalid user key | Log error, mark user as "needs_reauth", increment failureCount |
| 429 | Rate limited | Wait 5s, retry once, then log failure |
| 500 | Server error | Log error, increment failureCount |
| Network timeout (>10s) | Connection failed | Log error, increment failureCount |

**Never crash the bot on Pushover API failures.**

### 8.4 Rate Limiting
- Max 10 concurrent requests
- If you have >50 users, send in batches of 10 with 100ms delay between batches
- Respect Pushover's rate limits (7,500 messages/month per app)

---

## 9. Security Implementation

### 9.1 Encryption Specification

**Algorithm:** AES-256-GCM

**Encryption Flow:**
```typescript
function encryptPushoverKey(plainKey: string, masterKey: string): { encrypted: string, iv: string } {
  // 1. Generate random 16-byte IV
  const iv = crypto.randomBytes(16);
  
  // 2. Create cipher with master key and IV
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(masterKey, 'base64'), iv);
  
  // 3. Encrypt
  let encrypted = cipher.update(plainKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // 4. Get auth tag
  const authTag = cipher.getAuthTag();
  
  // 5. Return encrypted data + IV (store both in DB)
  return {
    encrypted: encrypted + ':' + authTag.toString('hex'),
    iv: iv.toString('hex')
  };
}
```

**Decryption Flow:**
```typescript
function decryptPushoverKey(encryptedData: string, iv: string, masterKey: string): string {
  // 1. Split encrypted data and auth tag
  const [encrypted, authTag] = encryptedData.split(':');
  
  // 2. Create decipher
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(masterKey, 'base64'),
    Buffer.from(iv, 'hex')
  );
  
  // 3. Set auth tag
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  // 4. Decrypt
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### 9.2 Key Masking
```typescript
function maskPushoverKey(key: string): string {
  if (key.length !== 30) return '[INVALID]';
  return `${key.slice(0, 4)}...${key.slice(-3)}`;
}
```

### 9.3 Environment Variable Requirements
```bash
# Required: 32-byte key encoded as base64
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=base64_encoded_32_byte_key
```

**Validation on startup:**
```typescript
if (!process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY is required');
}

const keyBuffer = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
if (keyBuffer.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes');
}
```

---

## 10. Permission System

### 10.1 Admin Role Resolution

**Priority Order:**
1. Check `GuildConfig.adminRoleIds` in database
2. Fall back to `ADMIN_ROLE_IDS` environment variable
3. Fall back to Discord permission: `ADMINISTRATOR`

**Implementation:**
```typescript
async function isAdmin(userId: string, guildId: string): Promise<boolean> {
  const member = await guild.members.fetch(userId);
  
  // Check database config
  const guildConfig = await db.guildConfig.findUnique({ where: { guildId } });
  if (guildConfig?.adminRoleIds) {
    const allowedRoles = guildConfig.adminRoleIds.split(',');
    return member.roles.cache.some(role => allowedRoles.includes(role.id));
  }
  
  // Check env var
  const envRoles = process.env.ADMIN_ROLE_IDS?.split(',') || [];
  if (envRoles.length > 0) {
    return member.roles.cache.some(role => envRoles.includes(role.id));
  }
  
  // Fall back to Discord admin permission
  return member.permissions.has('ADMINISTRATOR');
}
```

### 10.2 Owner Override

**Environment Variable:**
```bash
OWNER_DISCORD_IDS=123456789012345678,987654321098765432
```

**Owners can:**
- Use `/admin` commands in any guild
- Access health checks
- Override permission errors

---

## 11. Environment Variables

```bash
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/Zenith

# Pushover
PUSHOVER_APP_TOKEN=your_pushover_app_token

# Security
ENCRYPTION_KEY=base64_encoded_32_byte_key

# Permissions (optional, comma-separated)
ADMIN_ROLE_IDS=123456789012345678,987654321098765432
OWNER_DISCORD_IDS=123456789012345678

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

### 11.1 Required Variables
- `DISCORD_TOKEN` ✅
- `DISCORD_CLIENT_ID` ✅
- `DATABASE_URL` ✅
- `PUSHOVER_APP_TOKEN` ✅
- `ENCRYPTION_KEY` ✅

### 11.2 Optional Variables
- `ADMIN_ROLE_IDS` (falls back to database or ADMINISTRATOR permission)
- `OWNER_DISCORD_IDS` (falls back to none)
- `LOG_LEVEL` (defaults to `info`)
- `NODE_ENV` (defaults to `development`)

### 11.3 Validation Script
```typescript
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(50),
  DISCORD_CLIENT_ID: z.string().regex(/^\d+$/),
  DATABASE_URL: z.string().url(),
  PUSHOVER_APP_TOKEN: z.string().length(30),
  ENCRYPTION_KEY: z.string().refine(
    (key) => Buffer.from(key, 'base64').length === 32,
    'ENCRYPTION_KEY must be 32 bytes when base64 decoded'
  ),
  ADMIN_ROLE_IDS: z.string().optional(),
  OWNER_DISCORD_IDS: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
```

---

## 12. Project Structure

```
Zenith/
├── src/
│   ├── index.ts                 # Entry point
│   ├── bot/
│   │   ├── client.ts            # Discord client setup
│   │   ├── registerCommands.ts  # Deploy slash commands
│   │   └── interactionRouter.ts # Route interactions to handlers
│   ├── commands/
│   │   ├── help.command.ts
│   │   ├── register.command.ts
│   │   ├── settings.command.ts
│   │   ├── alertAll.command.ts
│   │   └── admin.command.ts
│   ├── modules/
│   │   ├── users/
│   │   │   ├── user.repository.ts   # DB access for users
│   │   │   ├── user.service.ts      # Business logic
│   │   │   └── encryption.util.ts   # Encrypt/decrypt keys
│   │   ├── pushover/
│   │   │   ├── pushover.client.ts   # HTTP client for Pushover API
│   │   │   └── pushover.service.ts  # Broadcast logic
│   │   ├── alerts/
│   │   │   ├── alert.repository.ts  # DB access for audit logs
│   │   │   └── alert.service.ts     # Logging logic
│   │   └── guilds/
│   │       ├── guild.repository.ts
│   │       └── guild.service.ts
│   ├── config/
│   │   └── env.ts               # Environment validation
│   ├── utils/
│   │   ├── logger.ts            # Structured logging
│   │   ├── errors.ts            # Custom error classes
│   │   └── permissions.ts       # Permission checks
│   └── prisma/
│       └── schema.prisma        # Database schema
├── tests/
│   ├── unit/
│   │   ├── encryption.test.ts
│   │   ├── masking.test.ts
│   │   └── permissions.test.ts
│   └── integration/
│       ├── register.test.ts
│       └── broadcast.test.ts
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

---

## 13. Example Flows

### 13.1 New User Registration

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ 1. /register add uABC123xyz...
     ▼
┌─────────────────┐
│ register.command│
└────┬────────────┘
     │
     │ 2. Validate format (30 chars, alphanumeric)
     ▼
┌─────────────────┐
│  user.service   │
└────┬────────────┘
     │
     │ 3. Encrypt key with AES-256-GCM
     ▼
┌─────────────────┐
│ user.repository │
└────┬────────────┘
     │
     │ 4. UPSERT UserRegistration
     │ 5. INSERT UserSettings (if new)
     ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘
     │
     │ 6. Success
     ▼
┌─────────────────┐
│ Ephemeral Reply │
│ ✅ Key Saved    │
└─────────────────┘
```

**Database State After:**
```sql
-- UserRegistration
id: uuid
discordUserId: "123456789"
discordUsername: "alice"
pushoverKeyEnc: "a8f3...9b2e:4f1a...8c3d" -- encrypted
encryptionIv: "7b2e...5d1c"
registeredAt: "2025-01-15T10:30:00Z"

-- UserSettings
id: uuid
userId: <foreign key to UserRegistration>
ddEnabled: true
pingEnabled: true
trenchEnabled: true
nukeEnabled: false
broadcastAlertsEnabled: true
```

---

### 13.2 Admin Broadcast Flow

```
┌─────────┐
│  Admin  │
└────┬────┘
     │
     │ 1. /alert all bell "Maintenance in 30min"
     ▼
┌──────────────────┐
│ alertAll.command │
└────┬─────────────┘
     │
     │ 2. Check isAdmin(userId, guildId)
     ▼
┌──────────────────┐
│ permissions.util │
└────┬─────────────┘
     │ ✅ Authorized
     ▼
┌──────────────────┐
│ user.repository  │
└────┬─────────────┘
     │
     │ 3. Fetch users WHERE:
     │    - broadcastAlertsEnabled = true
     │    - pingEnabled = true (for "bell" alert)
     │
     │ Result: [user1, user2, user3]
     ▼
┌──────────────────┐
│ encryption.util  │
└────┬─────────────┘
     │
     │ 4. Decrypt each pushoverKeyEnc
     ▼
┌──────────────────┐
│ pushover.client  │
└────┬─────────────┘
     │
     │ 5. Send 3 requests to Pushover API
     │    - user1: ✅ 200 OK
     │    - user2: ✅ 200 OK
     │    - user3: ❌ 400 Invalid User Key
     ▼
┌──────────────────┐
│ pushover.service │
└────┬─────────────┘
     │
     │ 6. Aggregate results:
     │    successCount: 2
     │    failureCount: 1
     ▼
┌──────────────────┐
│ alert.repository │
└────┬─────────────┘
     │
     │ 7. INSERT AlertAuditLog
     ▼
┌──────────────────┐
│   PostgreSQL     │
└──────────────────┘
     │
     │ 8. Build embed
     ▼
┌──────────────────┐
│ Discord Channel  │
│ #alert-history   │
│                  │
│ 🔔 Alert Sent    │
│ Type: Bell       │
│ Notified: 2 ✅   │
│ Failed: 1 ❌     │
└──────────────────┘
     │
     │ 9. Reply to command
     ▼
┌──────────────────┐
│ Admin sees:      │
│ ✅ Bell Alert    │
│ Notified: 2      │
│ Failed: 1        │
└──────────────────┘
```

---

### 13.3 Settings Update Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ 1. /settings
     ▼
┌──────────────────┐
│ settings.command │
└────┬─────────────┘
     │
     │ 2. Check if registered
     ▼
┌──────────────────┐
│ user.repository  │
└────┬─────────────┘
     │
     │ 3. Fetch UserSettings
     ▼
┌──────────────────┐
│ Build embed with │
│ current settings │
│ + "Edit" button  │
└────┬─────────────┘
     │
     │ 4. User clicks "Edit"
     ▼
┌──────────────────┐
│ Show modal with: │
│ ☑ DD Enabled     │
│ ☑ Ping Enabled   │
│ ☑ Trench Enabled │
│ ☐ Nuke Disabled  │
│ ☑ Broadcasts On  │
└────┬─────────────┘
     │
     │ 5. User unchecks "Trench", submits
     ▼
┌──────────────────┐
│ settings.command │
│ (modal handler)  │
└────┬─────────────┘
     │
     │ 6. UPDATE UserSettings
     │    SET trenchEnabled = false
     ▼
┌──────────────────┐
│   PostgreSQL     │
└──────────────────┘
     │
     │ 7. Confirm
     ▼
┌──────────────────┐
│ ✅ Settings      │
│ Updated          │
└──────────────────┘
```

---

## 14. Error Handling

### 14.1 User-Facing Errors

| Error Condition | Message | Action |
|----------------|---------|--------|
| Invalid Pushover key format | ❌ Invalid Key Format<br>Pushover keys must be exactly 30 alphanumeric characters. | Show example format |
| User not registered | ❌ Not Registered<br>Use /register add <key> first. | Link to registration |
| No permission for admin command | ❌ Permission Denied<br>Contact a server admin. | Log attempt |
| Pushover API down | ⚠️ Service Unavailable<br>Notifications may be delayed. Try again later. | Log error, don't crash |
| Database connection failed | ❌ Database Error<br>Could not save changes. Please try again. | Log error, retry 3x |

### 14.2 Internal Error Handling

**Pushover Send Failures:**
```typescript
try {
  const response = await pushoverClient.send(user.pushoverKey, message);
  successCount++;
} catch (error) {
  if (error.status === 400) {
    // Invalid user key - log but continue
    logger.warn('Invalid Pushover key', { userId: user.discordUserId });
    failureCount++;
  } else if (error.status === 429) {
    // Rate limited - wait and retry once
    await sleep(5000);
    try {
      await pushoverClient.send(user.pushoverKey, message);
      successCount++;
    } catch {
      failureCount++;
    }
  } else {
    // Other error - log and continue
    logger.error('Pushover send failed', { error, userId: user.discordUserId });
    failureCount++;
  }
}
```

**Database Failures:**
```typescript
async function saveWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 15. Testing Strategy

### 15.1 Unit Tests

**Test File:** `tests/unit/encryption.test.ts`
```typescript
describe('Encryption', () => {
  test('encrypts and decrypts correctly', () => {
    const plainKey = 'uABC123xyz4567890DEFGHIJKLMNO';
    const masterKey = crypto.randomBytes(32).toString('base64');
    
    const { encrypted, iv } = encryptPushoverKey(plainKey, masterKey);
    const decrypted = decryptPushoverKey(encrypted, iv, masterKey);
    
    expect(decrypted).toBe(plainKey);
  });
  
  test('produces unique IVs', () => {
    const plainKey = 'uABC123xyz4567890DEFGHIJKLMNO';
    const masterKey = crypto.randomBytes(32).toString('base64');
    
    const result1 = encryptPushoverKey(plainKey, masterKey);
    const result2 = encryptPushoverKey(plainKey, masterKey);
    
    expect(result1.iv).not.toBe(result2.iv);
    expect(result1.encrypted).not.toBe(result2.encrypted);
  });
});
```

**Test File:** `tests/unit/masking.test.ts`
```typescript
describe('Key Masking', () => {
  test('masks 30-char key correctly', () => {
    const key = 'uABC123xyz4567890DEFGHIJKLMNO';
    const masked = maskPushoverKey(key);
    
    expect(masked).toBe('uABC...MNO');
    expect(masked).not.toContain('123xyz');
  });
  
  test('handles invalid keys', () => {
    expect(maskPushoverKey('short')).toBe('[INVALID]');
    expect(maskPushoverKey('')).toBe('[INVALID]');
  });
});
```

**Test File:** `tests/unit/permissions.test.ts`
```typescript
describe('Permissions', () => {
  test('grants admin to user with admin role', async () => {
    // Mock member with admin role
    const result = await isAdmin('123', 'guild1');
    expect(result).toBe(true);
  });
  
  test('denies admin to regular user', async () => {
    // Mock member without admin role
    const result = await isAdmin('456', 'guild1');
    expect(result).toBe(false);
  });
});
```

### 15.2 Integration Tests

**Test File:** `tests/integration/register.test.ts`
```typescript
describe('Registration Flow', () => {
  test('user can register and retrieve status', async () => {
    // 1. Register key
    const addResult = await registerCommand({
      userId: '123',
      key: 'uABC123xyz4567890DEFGHIJKLMNO'
    });
    
    expect(addResult.success).toBe(true);
    
    // 2. Check database
    const user = await db.userRegistration.findUnique({
      where: { discordUserId: '123' }
    });
    
    expect(user).not.toBeNull();
    expect(user.pushoverKeyEnc).not.toBe('uABC123xyz4567890DEFGHIJKLMNO'); // Must be encrypted
    
    // 3. List registration
    const listResult = await listCommand({ userId: '123' });
    
    expect(listResult.masked).toBe('uABC...MNO');
  });
});
```

**Test File:** `tests/integration/broadcast.test.ts`
```typescript
describe('Broadcast Flow', () => {
  test('filters users by settings', async () => {
    // Setup: 3 users with different settings
    await createUser('user1', { pingEnabled: true, broadcastAlertsEnabled: true });
    await createUser('user2', { pingEnabled: false, broadcastAlertsEnabled: true });
    await createUser('user3', { pingEnabled: true, broadcastAlertsEnabled: false });
    
    // Execute broadcast
    const result = await broadcastBellAlert('guild1', 'admin1', 'Test message');
    
    // Verify: Only user1 should be notified
    expect(result.attemptedCount).toBe(1);
    expect(result.notifiedUserIds).toEqual(['user1']);
  });
  
  test('logs audit record', async () => {
    await broadcastBellAlert('guild1', 'admin1', 'Test');
    
    const log = await db.alertAuditLog.findFirst({
      where: { guildId: 'guild1' },
      orderBy: { createdAt: 'desc' }
    });
    
    expect(log).not.toBeNull();
    expect(log.alertType).toBe('bell');
    expect(log.triggerUserId).toBe('admin1');
  });
});
```

### 15.3 Test Coverage Requirements

Minimum coverage:
- Encryption/decryption: 100%
- Key masking: 100%
- Permission checks: 100%
- Broadcast filtering: 100%
- Error handling: 80%

---

## 16. Deployment

### 16.1 Docker Setup

**Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Run migrations on startup
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: zenith
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: zenith
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zenith"]
      interval: 10s
      timeout: 5s
      retries: 5

  bot:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://zenith:${DB_PASSWORD}@postgres:5432/zenith
      DISCORD_TOKEN: ${DISCORD_TOKEN}
      DISCORD_CLIENT_ID: ${DISCORD_CLIENT_ID}
      PUSHOVER_APP_TOKEN: ${PUSHOVER_APP_TOKEN}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      LOG_LEVEL: info
      NODE_ENV: production
    restart: unless-stopped

volumes:
  postgres_data:
```

### 16.2 Deployment Checklist

- [ ] Generate `ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- [ ] Create `.env` file from `.env.example`
- [ ] Run `docker-compose up -d`
- [ ] Verify bot comes online in Discord
- [ ] Run `/help` to test commands
- [ ] Register test Pushover key
- [ ] Configure guild with `/admin config`
- [ ] Test broadcast with `/alert all silent "Test"`
- [ ] Verify alert history appears in channel

---

## 17. Logging

### 17.1 Structured Logs

Use JSON format for production:

```json
{
  "level": "info",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "message": "User registered",
  "userId": "123456789",
  "username": "alice",
  "masked_key": "uABC...xyz"
}
```

### 17.2 Log Levels

| Level | Usage |
|-------|-------|
| `error` | Critical failures, bot crashes, database down |
| `warn` | Recoverable errors, invalid user keys, API failures |
| `info` | Important events: registrations, broadcasts, settings changes |
| `debug` | Detailed flow, useful for troubleshooting |

### 17.3 What to Log

**Always Log:**
- Bot startup/shutdown
- User registrations (with masked keys)
- Settings changes
- Broadcast executions (with counts)
- Admin command usage
- Permission denials
- API failures

**Never Log:**
- Raw Pushover keys
- Discord bot token
- Encryption keys
- Full environment variables

---

## 18. Operations Guide

### 18.1 Common Tasks

**View Logs:**
```bash
docker-compose logs -f bot
```

**Restart Bot:**
```bash
docker-compose restart bot
```

**Database Backup:**
```bash
docker-compose exec postgres pg_dump -U zenith zenith > backup.sql
```

**Add Migration:**
```bash
# Edit schema.prisma
npx prisma migrate dev --name add_new_field
docker-compose up -d --build
```

### 18.2 Monitoring

**Health Check Endpoint (optional future feature):**
```
GET /health
Response: { "status": "ok", "database": "connected", "uptime": 123456 }
```

**Metrics to Track:**
- Total registered users
- Broadcasts sent per day
- Failed notifications per day
- Average response time
- Database query time

---

## 19. AI Agent Implementation Prompt

**Use this section to prompt an AI coding agent:**

---

### Task: Build Zenith Alerts Discord Bot

You are building a Discord bot from scratch that allows users to register Pushover keys and receive broadcast alerts from admins.

**Hard Constraints:**
- TypeScript only
- discord.js v14
- PostgreSQL + Prisma ORM
- Slash commands only (no prefix commands)
- All Pushover keys MUST be encrypted with AES-256-GCM
- Modular architecture: commands → services → repositories → clients
- No hardcoded secrets (everything in .env)
- Structured JSON logging

**What to Build:**

1. **User Registration System**
   - `/register add <key>` - Save encrypted Pushover key
   - `/register list` - Show masked key status
   - `/register remove` - Delete key and settings
   - Validate keys: exactly 30 alphanumeric chars
   - Store in PostgreSQL with encryption

2. **User Settings**
   - `/settings` - Interactive embed with "Edit" button
   - Modal with toggles for:
     * DD (silent) alerts
     * Ping (bell) alerts
     * Trench (loud) alerts
     * Nuke (critical) alerts
     * Broadcast alerts on/off
   - Persist to database

3. **Admin Broadcast Commands**
   - `/alert all silent <message>` - Pushover priority -1
   - `/alert all bell <message>` - Pushover priority 1
   - `/alert all critical <message>` - Pushover priority 2 (with retry/expire)
   - Permission check: admin role or ADMINISTRATOR permission
   - Filter recipients by user settings
   - Send notifications in parallel (max 10 concurrent)
   - Log to AlertAuditLog table
   - Post embed in configured history channel

4. **Admin Tools**
   - `/admin config` - Set history channel, manage roles
   - `/admin health` - Database, Pushover API, uptime check

**Database Schema:**
Implement the Prisma schema from Section 5.1 exactly.

**Encryption:**
Use AES-256-GCM with unique IV per record. See Section 9.1 for reference implementation.

**Error Handling:**
Never crash on Pushover API failures. Log errors and continue. Use retry logic for rate limits (429).

**Project Structure:**
Follow the folder structure in Section 12.

**Environment Variables:**
Require: DISCORD_TOKEN, DISCORD_CLIENT_ID, DATABASE_URL, PUSHOVER_APP_TOKEN, ENCRYPTION_KEY

**Testing:**
Write unit tests for encryption, masking, and permissions. Write integration tests for registration and broadcast flows.

**Deployment:**
Provide Dockerfile and docker-compose.yml as specified in Section 16.1.

**Build Order:**
1. Init TypeScript project with discord.js, Prisma, dotenv
2. Create Prisma schema
3. Implement env validation (use zod)
4. Setup Discord client and command registration
5. Implement `/help` command
6. Implement `/register` commands (add/list/remove)
7. Implement encryption utils (encrypt/decrypt/mask)
8. Implement `/settings` command with modal
9. Implement Pushover client (HTTP wrapper)
10. Implement `/alert all` commands (silent/bell/critical)
11. Implement alert history embed posting
12. Implement `/admin` commands
13. Add tests
14. Add Dockerfile + docker-compose.yml
15. Write README with setup instructions

**Quality Rules:**
- Commands are thin (just parse input, call services)
- Business logic lives in services
- Database access only in repositories
- External HTTP calls only in clients
- Use typed errors (class AppError extends Error)
- Never log secrets
- Keep codebase small and focused

---

## 20. Definition of Done

The bot is complete when:

✅ **Functionality:**
- [ ] User can register Pushover key with `/register add`
- [ ] User can view masked key with `/register list`
- [ ] User can remove key with `/register remove`
- [ ] User can configure settings with `/settings`
- [ ] Admin can broadcast with `/alert all silent|bell|critical`
- [ ] Broadcasts respect user settings (dd/ping/trench/nuke toggles)
- [ ] Broadcasts appear in alert history channel
- [ ] Non-admins cannot use `/alert all` commands
- [ ] `/admin health` shows system status

✅ **Security:**
- [ ] All Pushover keys encrypted at rest
- [ ] Keys never appear in logs or Discord messages
- [ ] Masking function works correctly
- [ ] Environment validation fails fast on missing vars
- [ ] No secrets in git

✅ **Quality:**
- [ ] TypeScript compiles with no errors
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Code follows modular architecture
- [ ] Structured logging implemented

✅ **Deployment:**
- [ ] Dockerfile builds successfully
- [ ] docker-compose starts bot and database
- [ ] Prisma migrations run automatically
- [ ] Bot connects to Discord
- [ ] Database connection works
- [ ] Pushover API reachable

✅ **Documentation:**
- [ ] README with setup instructions
- [ ] .env.example provided
- [ ] Comments in complex functions
- [ ] This SRS document in `docs/SRS.md`

---

## Appendix A: Pushover API Reference

**Endpoint:**
```
POST https://api.pushover.net/1/messages.json
```

**Authentication:**
- Requires `token` (your app token)
- Requires `user` (recipient's user key)

**Priority Levels:**
- `-2` = Lowest (no notification/alert)
- `-1` = Low (generates no sound or vibration)
- `0` = Normal (default)
- `1` = High (highlighted in red, bypasses quiet hours)
- `2` = Emergency (requires acknowledgment, repeats until acknowledged)

**Required Fields for Priority 2:**
- `retry` = How often (in seconds) to resend notification (minimum 30)
- `expire` = How long (in seconds) to retry (maximum 10800)

**Rate Limits:**
- 7,500 messages per month per app
- 10,000 messages per month per user

**Error Codes:**
- `200` = Success
- `400` = Bad request (invalid user key, missing fields)
- `429` = Rate limit exceeded
- `500` = Server error

---

## Appendix B: Discord Permission Integers

If checking permissions programmatically:

```typescript
enum DiscordPermissions {
  ADMINISTRATOR = 0x0000000000000008,
  MANAGE_GUILD = 0x0000000000000020,
  MANAGE_ROLES = 0x0000000000010000,
}
```

Use `member.permissions.has('ADMINISTRATOR')` in discord.js v14.

---

## Appendix C: Example .env File

```bash
# .env.example
# Copy to .env and fill in your values

# Discord
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here

# Database
DATABASE_URL=postgresql://zenith:your_password@localhost:5432/zenith

# Pushover
PUSHOVER_APP_TOKEN=your_pushover_app_token_here

# Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_KEY=your_base64_encoded_32_byte_key_here

# Permissions (optional, comma-separated Discord role IDs)
ADMIN_ROLE_IDS=123456789012345678
OWNER_DISCORD_IDS=123456789012345678

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

---

**End of Specification**
