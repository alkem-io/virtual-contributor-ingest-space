# Stage 1: Build stage
FROM node:22.16.0-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Install dependencies (including devDependencies for building)
RUN npm ci

COPY . .

ENV NODE_ENV=production

# Build the application, then prune devDependencies
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force

# Stage 2: Runtime stage
FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /usr/src/app

# Copy built artifacts and production dependencies
COPY --from=builder --chown=nonroot:nonroot /usr/src/app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /usr/src/app/package.json ./package.json

# Set user to nonroot (distroless images have this user)
USER nonroot

# Environment variables
ENV NODE_ENV=production

# Run the application
CMD ["dist/index.js"]

