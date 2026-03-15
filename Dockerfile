# Stage 1: Build
FROM node:20-slim AS builder

# Install OpenSSL and other build dependencies
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev)
RUN npm ci

# Marker for sequential stage synchronization
RUN touch /app/build-done.txt

# Copy source code and config
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-slim AS runner

# Force Docker to finish the builder stage before starting this one
COPY --from=builder /app/build-done.txt /tmp/

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set environment
ENV NODE_ENV production

# Copy package files and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built code and prisma artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3001

# Command to run migrations and then the application
CMD npx prisma migrate deploy && node dist/server.js
