# Stage 1: Build
FROM node:20-alpine AS builder

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

RUN npm ci --no-audit --no-fund

COPY . .

RUN npx prisma generate
RUN npm run build

# Remove devDeps but keep Prisma engines
RUN npm prune --omit=dev

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

# Direct execution - no wrapping shell or npx overhead
CMD ["node", "dist/server.js"]