# -----------------------------
# 1. Base stage: dependencies
# -----------------------------
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /usr/src/app

ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1

# Install all dependencies (including TypeScript devDependencies)
COPY package*.json ./
RUN npm ci

# -----------------------------
# 2. Build stage: compile TS
# -----------------------------
FROM deps AS builder
WORKDIR /usr/src/app

# Copy configuration and source files
COPY tsconfig*.json ./
COPY src ./src

# Compile TypeScript to JavaScript (e.g., outputs to dist/)
RUN npm run build

# -----------------------------
# 3. Production stage: runtime
# -----------------------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production

RUN mkdir -p /usr/src/app/logs && chown -R node:node /usr/src/app/logs

RUN mkdir -p /home/node/.yt-dlp/plugins/bgutil-ytdlp-pot-provider
RUN chown -R node:node /home/node/.yt-dlp/plugins/bgutil-ytdlp-pot-provider

RUN apk add --no-cache python3 ffmpeg

RUN wget https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/latest/download/bgutil-ytdlp-pot-provider.zip
RUN unzip bgutil-ytdlp-pot-provider.zip -d /home/node/.yt-dlp/plugins/bgutil-ytdlp-pot-provider
RUN rm bgutil-ytdlp-pot-provider.zip

COPY static ./static

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Run as non-privileged node user
USER node

# Copy compiled JS from builder
COPY --from=builder /usr/src/app/out ./out

EXPOSE 3000

# Run the compiled JS output
CMD ["node", "out/app.js"]
