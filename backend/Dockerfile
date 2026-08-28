# Debian-based image on purpose: Prisma's query/schema engines need OpenSSL,
# and Alpine's musl + OpenSSL 3.x combination makes the engine fail to load
# ("Could not parse schema engine response"). node:20-slim also ships glibc,
# so argon2 can use its prebuilt native binary instead of compiling.
FROM node:20-slim AS base
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
