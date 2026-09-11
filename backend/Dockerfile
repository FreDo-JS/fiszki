# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# base — wspólny fundament. Prisma i argon2 linkują się z OpenSSL 3, stąd obraz
# bookworm-slim (zgodny z binaryTarget "debian-openssl-3.0.x" w schema.prisma).
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# deps — pełne node_modules (z devDependencies). Narzędzia kompilacji są tu
# potrzebne tylko wtedy, gdy argon2 nie znajdzie gotowego binarium dla danej
# architektury i musi zbudować się ze źródeł; do obrazu runtime nie trafiają.
# ---------------------------------------------------------------------------
FROM base AS deps
ENV NODE_ENV=development
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — generuje klienta Prismy i kompiluje TypeScript do dist/
# ---------------------------------------------------------------------------
FROM deps AS builder
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
# prod-deps — to samo drzewo zależności bez devDependencies. `npm prune` zamiast
# ponownego `npm ci` oszczędza kolejną kompilację natywnych modułów.
# ---------------------------------------------------------------------------
FROM deps AS prod-deps
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# runtime — finalny obraz produkcyjny
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=4000

COPY --from=prod-deps /app/node_modules ./node_modules
# Wygenerowany klient Prismy oraz samo CLI — entrypoint uruchamia nim
# `migrate deploy`, a prune usunąłby je jako devDependency.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
