# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install ffmpeg for video capture and assembly
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Create directories for timelapses and temp files
RUN mkdir -p /app/timelapses /app/temp

# Set environment variables
ENV NODE_ENV=production

# Volume mounts for configuration, timelapses, and temp files
VOLUME ["/app/config", "/app/timelapses", "/app/temp"]

ENTRYPOINT ["node", "dist/index.js"]
CMD ["/app/config/config.json"]
