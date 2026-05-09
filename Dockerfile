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