ARG NODE_VERSION=22
ARG DEBIAN_VERSION=bookworm-slim
FROM node:${NODE_VERSION}-${DEBIAN_VERSION}

WORKDIR /app

# Install Chromium and minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 \
    libgbm1 \
    libasound2 \
    fonts-liberation \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests and install production deps only
COPY package*.json ./
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm ci --only=production --no-audit --prefer-offline && \
    npm cache clean --force

# Copy app source
COPY . .

# Environment variables
ENV NODE_ENV=production \
    CHROMIUM_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PORT=3001

# Use non-privileged user
USER node

EXPOSE 3001

CMD ["npm", "start"]