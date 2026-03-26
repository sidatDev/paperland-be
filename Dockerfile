# Stage 1: Build
FROM node:20 AS builder

# Install specific dependencies for Prisma/Sharp
RUN apt-get update && apt-get install -y openssl python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (regular install for reliability in Coolify)
RUN npm ci

# Copy source code and config
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Prune devDependencies to keep node_modules light for the runner
RUN npm prune --omit=dev

# Marker for sequential stage synchronization
RUN touch /app/build-done.txt

# Stage 2: Production
FROM node:20-slim AS runner

# Force Docker to finish the builder stage before starting this one
COPY --from=builder /app/build-done.txt /tmp/

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set environment
ENV NODE_ENV production

# Copy package files
COPY package*.json ./

# Copy built code, prisma artifacts, AND pruned node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3001

# Command to run migrations and then the application
CMD npx prisma migrate deploy && node dist/server.js
