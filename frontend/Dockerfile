# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# builder — typecheck (tsc -b) + bundle produkcyjny Vite
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite wstrzykuje zmienne VITE_* w czasie builda, nie przy starcie kontenera —
# adres API trzeba więc podać jako build-arg (compose robi to za nas).
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------------------------------------------------------------------------
# runtime — statyczne pliki serwowane przez nginx (SPA fallback w nginx.conf)
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
