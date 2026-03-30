# Stage 1: Build
FROM node:20-slim AS builder

# Install build dependencies for Debian slim
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY prisma ./prisma/

# Leverage the npm cache mount for faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Generate Prisma Client with proper binary targets
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Remove devDependencies and prune node_modules
RUN npm prune --omit=dev --no-audit --no-fund

# Stage 2: Production
FROM node:20-slim AS runner

# Install runtime dependencies for Debian slim
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The 'node' user already exists in the official image
# Set ownership before switching to the node user
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Create uploads directory and set permissions
RUN mkdir -p public/uploads && \
    chown -R node:node /app

# Set environment
ENV NODE_ENV=production \
    PORT=3001

# Switch to non-root user
USER node

# Expose port
EXPOSE 3001

# Command to run migrations and then the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]