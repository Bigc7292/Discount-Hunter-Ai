# Stage 1: Build TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Stage 2: Production — Express + Puppeteer (system Chromium)
FROM node:20-alpine

WORKDIR /app

# Chromium + runtime deps for headless checkout verification
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Railway / containers inject PORT; app reads process.env.PORT
CMD ["node", "dist/index.js"]
