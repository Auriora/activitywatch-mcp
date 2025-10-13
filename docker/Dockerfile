# syntax=docker/dockerfile:1.7

# Builder stage installs full dependencies and compiles TypeScript to JavaScript
FROM node:20-bullseye AS builder

ENV NODE_ENV=development
WORKDIR /app

# Install dependencies first to leverage Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source needed to build the project
COPY tsconfig.json ./
COPY src ./src
COPY config ./config

# Compile TypeScript sources ahead of runtime stage
RUN npm run build


# Production runtime image contains only the dist output and production deps
FROM node:20-bullseye-slim AS runtime

ENV NODE_ENV=production \
    MCP_PORT=3000 \
    AW_URL=http://host.docker.internal:5600 \
    LOG_LEVEL=INFO

WORKDIR /app

# Install only production dependencies for a smaller image footprint
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy build artifacts and configuration required at runtime
COPY --from=builder /app/dist ./dist
COPY config ./config
COPY docker/entrypoint.sh ./entrypoint.sh
COPY docker/healthcheck.js ./healthcheck.js

RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["http"]
