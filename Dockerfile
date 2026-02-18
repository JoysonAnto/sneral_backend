# Multi-stage build for optimized production image
FROM node:18-slim AS builder

# Install build dependencies for Prisma and native modules
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-slim AS production

# Install only the necessary libraries for Puppeteer and Chromium
RUN apt-get update && apt-get install -y \
  openssl \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpangocairo-1.0-0 \
  libpango-1.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Create uploads directory and set permissions
RUN mkdir -p uploads && chown -R node:node /app

# Copy entrypoint script
COPY entrypoint.sh ./
USER root
RUN chmod +x entrypoint.sh && chown node:node entrypoint.sh
USER node

# Expose port (Render uses 10000)
EXPOSE 10000

# Start command
CMD ["./entrypoint.sh"]


