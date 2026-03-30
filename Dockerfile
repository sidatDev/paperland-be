# Stage 1: Build
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --no-audit --no-fund

COPY . .

RUN npx prisma generate
RUN npm run build

# Remove devDeps but keep Prisma engines
RUN npm prune --omit=dev

# Stage 2: Production
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

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