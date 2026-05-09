-- CreateTable
CREATE TABLE "UserRegistration" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "pushoverKeyEnc" TEXT NOT NULL,
    "encryptionIv" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ddEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trenchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nukeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "broadcastAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildName" TEXT NOT NULL,
    "alertHistoryChannelId" TEXT,
    "adminRoleIds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertAuditLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "triggerUserId" TEXT NOT NULL,
    "triggerUsername" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "attemptedCount" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "failureCount" INTEGER NOT NULL,
    "sourceMessageId" TEXT,
    "sourceChannelId" TEXT,
    "historyMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRegistration_discordUserId_key" ON "UserRegistration"("discordUserId");

-- CreateIndex
CREATE INDEX "UserRegistration_discordUserId_idx" ON "UserRegistration"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildConfig_guildId_key" ON "GuildConfig"("guildId");

-- CreateIndex
CREATE INDEX "GuildConfig_guildId_idx" ON "GuildConfig"("guildId");

-- CreateIndex
CREATE INDEX "AlertAuditLog_guildId_createdAt_idx" ON "AlertAuditLog"("guildId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
