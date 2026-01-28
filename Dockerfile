# --- STAGE 1: BUILD ---
# Switched to 22-bookworm-slim for 2026 LTS stability
ARG NODE_VERSION=22
ARG DEBIAN_VERSION=bookworm-slim
FROM node:${NODE_VERSION}-${DEBIAN_VERSION} AS build

WORKDIR /app

# Install build essentials for native modules
RUN apt-get update && apt-get install -y \
    make g++ \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 100000

COPY . .

# 1. Run your build
RUN yarn build --production

# 2. Delete everything in node_modules and install ONLY production deps
# This is the "No Unstability" way to prune with Yarn
RUN rm -rf node_modules && \
    yarn install --production --frozen-lockfile --network-timeout 100000 && \
    yarn cache clean

# --- STAGE 2: FINAL ---
FROM node:${NODE_VERSION}-${DEBIAN_VERSION} AS final

WORKDIR /app

# Install Chromium + Rendering Dependencies + Basic Fonts
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-freefont-ttf \
    libnss3 \
    libgbm1 \
    libasound2 \
    --no-install-recommends && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Environment Variables
ENV NODE_ENV=production \
    CHROME_PATH='/usr/bin/chromium' \
    PUPPETEER_EXECUTABLE_PATH='/usr/bin/chromium' \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PORT=3000

# Copy assets from build stage
COPY --from=build /app/package.json /app/yarn.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/api ./api
COPY --from=build /app/server.js ./server.js

# Run as non-privileged user
USER node

EXPOSE 3000

CMD ["yarn", "start"]