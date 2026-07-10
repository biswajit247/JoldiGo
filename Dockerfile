# Stage 1: Build & dependencies installation
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package configurations
COPY server/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Stage 2: Final lightweight runtime container
FROM node:20-alpine

WORKDIR /app

# Copy production node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy server source code files
COPY server/index.js ./index.js
COPY server/db.js ./db.js
COPY server/migrate.js ./migrate.js

# Expose backend API port
EXPOSE 5001

# Set production environment
ENV NODE_ENV=production
ENV PORT=5001

# Start the Node.js application
CMD ["node", "index.js"]
