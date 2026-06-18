# ---- Build stage: compile native deps (better-sqlite3) ----
FROM node:20-alpine AS build
WORKDIR /app

# Toolchain needed to build better-sqlite3 from source.
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --omit=dev

# ---- Runtime stage ----
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# Bring in the already-built dependencies and the app source.
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public

# SQLite data lives here; declared as a volume so it survives container restarts.
RUN mkdir -p /app/data && chown -R node:node /app
VOLUME ["/app/data"]

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
