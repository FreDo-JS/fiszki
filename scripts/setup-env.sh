#!/bin/sh
# Creates the .env that docker compose needs, with freshly generated secrets.
#
# Secrets are never committed (.env is in .gitignore), so a fresh clone on a
# server has none and compose refuses to start — by design. Run this once on
# the server instead of copying your local .env there: every machine should
# have its own secrets, so a leak on one never affects the other.
#
#   ./scripts/setup-env.sh --domain fiszki.example.com
#   ./scripts/setup-env.sh --domain fiszki.example.com --api-domain api.fiszki.example.com
#   ./scripts/setup-env.sh --local
#
set -eu

ENV_FILE=".env"
DOMAIN=""
API_DOMAIN=""
FORCE=0
LOCAL=0
SCHEME="https"

usage() {
  cat <<'USAGE'
Użycie: ./scripts/setup-env.sh [opcje]

  --domain <host>       Domena, pod którą działa frontend (np. fiszki.example.com).
  --api-domain <host>   Osobna domena API. Pominięta = API pod /api tej samej domeny
                        (wymaga reverse proxy kierującego /api do backendu).
  --local               Konfiguracja na localhost zamiast domeny (http, porty 8080/4000).
  --force               Nadpisz istniejący .env (stary trafi do .env.bak).
  -h, --help            Ta pomoc.

Po zmianie adresów trzeba przebudować frontend:
  docker compose up -d --build
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --api-domain) API_DOMAIN="${2:-}"; shift 2 ;;
    --local) LOCAL=1; SCHEME="http"; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Nieznana opcja: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ "$LOCAL" -eq 0 ] && [ -z "$DOMAIN" ]; then
  echo "Błąd: podaj --domain <host> albo --local." >&2
  usage >&2
  exit 2
fi

if [ -e "$ENV_FILE" ] && [ "$FORCE" -eq 0 ]; then
  echo "Błąd: $ENV_FILE już istnieje." >&2
  echo "Nie nadpisuję go, bo zmiana POSTGRES_PASSWORD rozjechałaby się z hasłem" >&2
  echo "w istniejącym wolumenie bazy. Użyj --force, jeśli wiesz, co robisz." >&2
  exit 1
fi

# Hex only, i na to jest powód: POSTGRES_PASSWORD trafia do DATABASE_URL jako
# część adresu, więc znaki typu @ : / # musiałyby być kodowane i po cichu
# rozwaliłyby połączenie z bazą.
gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 48
  elif [ -r /dev/urandom ]; then
    od -An -tx1 -N48 /dev/urandom | tr -d ' \n'
  else
    echo "Błąd: brak openssl i /dev/urandom — nie mam z czego wygenerować sekretów." >&2
    exit 1
  fi
}

POSTGRES_PASSWORD="$(gen_secret)"
JWT_SECRET="$(gen_secret)"
JWT_REFRESH_SECRET="$(gen_secret)"

DOMAIN_VALUE="${DOMAIN:-localhost}"

if [ "$LOCAL" -eq 1 ]; then
  FRONTEND_ORIGIN="http://localhost:8080"
  API_URL="http://localhost:4000/api"
elif [ -n "$API_DOMAIN" ]; then
  FRONTEND_ORIGIN="${SCHEME}://${DOMAIN}"
  API_URL="${SCHEME}://${API_DOMAIN}/api"
else
  FRONTEND_ORIGIN="${SCHEME}://${DOMAIN}"
  API_URL="${SCHEME}://${DOMAIN}/api"
fi

[ -e "$ENV_FILE" ] && cp "$ENV_FILE" "$ENV_FILE.bak"

# umask 077 zanim powstanie plik: nawet przez ułamek sekundy nie powinien być
# czytelny dla innych kont na serwerze.
OLD_UMASK="$(umask)"
umask 077

cat > "$ENV_FILE" <<ENVFILE
# Wygenerowane przez scripts/setup-env.sh $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Ten plik zawiera sekrety. Nie commituj go i nie kopiuj między maszynami.

POSTGRES_USER=fiszki
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=fiszki
POSTGRES_PORT=5432

JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

BACKEND_PORT=4000
FRONTEND_PORT=8080

# VITE_API_URL jest wkompilowywane w bundle podczas budowy obrazu frontendu —
# po jego zmianie konieczne jest "docker compose up -d --build".
VITE_API_URL=${API_URL}
# Musi być dokładnym originem frontendu, bez ukośnika na końcu, inaczej API
# odrzuci logowanie i wszystkie zapisy (middleware verifyOrigin).
CORS_ORIGIN=${FRONTEND_ORIGIN}

AUTH_RATE_LIMIT_MAX=10

# Używane wyłącznie przez opcjonalny profil "proxy" (Caddy + HTTPS):
#   docker compose --profile proxy up -d
DOMAIN=${DOMAIN_VALUE}
ACME_EMAIL=
ENVFILE

umask "$OLD_UMASK"
chmod 600 "$ENV_FILE"

echo "Utworzono $ENV_FILE (uprawnienia 600, tylko właściciel)."
echo
echo "  frontend : ${FRONTEND_ORIGIN}"
echo "  API      : ${API_URL}"
echo
echo "Następny krok:"
echo "  docker compose up -d --build"
echo "  docker compose --profile seed run --rm seeder   # jednorazowo, dane startowe"

if [ "$LOCAL" -eq 0 ] && [ "$SCHEME" = "https" ]; then
  echo
  echo "Uwaga: ciasteczka sesji mają flagę Secure w trybie produkcyjnym, więc"
  echo "aplikacja MUSI działać po HTTPS. Po zwykłym HTTP logowanie przejdzie,"
  echo "ale sesja się nie utrzyma. Postaw przed nią reverse proxy z certyfikatem."
fi
