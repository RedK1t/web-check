ARG NODE_VERSION=22
ARG DEBIAN_VERSION=bookworm-slim
FROM node:${NODE_VERSION}-${DEBIAN_VERSION}

WORKDIR /app

# Install Chromium and all required dependencies for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-sandbox \
    libnss3 \
    libgbm1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    fonts-liberation \
    fonts-noto-color-emoji \
    fontconfig \
    ca-certificates \
    wget \
    curl \
    gnupg \
  && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests and install production deps only
COPY package*.json ./
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm ci --only=production --no-audit --prefer-offline && \
    npm cache clean --force

# Copy app source
COPY . .

# Runtime env vars (NODE_ENV, PUPPETEER_*, PORT) are injected from web-check/.env
# via docker-compose env_file — the single source of truth.

# Use non-privileged user with proper permissions
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

USER pptruser

EXPOSE 3001

CMD ["npm", "start"]
