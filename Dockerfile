# Stage 1: Build
FROM node:20-alpine AS builder

# Set Node memory limit for the entire build process
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Install build dependencies
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    python3 \
    make \
    g++

WORKDIR /app

# Increase npm network reliability
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --no-audit --no-fund

COPY . .

# Generate Prisma client and build the application
# Combining these steps reduces layer overhead
RUN npx prisma generate && \
    npm run build && \
    npm prune --omit=dev --no-audit --no-fund

# Stage 2: Production
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV production

# Only copy essential artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

# Direct execution
CMD ["node", "dist/server.js"]