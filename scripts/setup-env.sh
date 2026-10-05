#!/bin/sh
# Creates the .env that docker compose needs, with freshly generated secrets.
#
# Secrets are never committed (.env is in .gitignore), so a fresh clone on a
# server has none and compose refuses to start — by design. Run this once on
# the server instead of copying your local .env there: every machine should
# have its own secrets, so a leak on one never affects the other.
#
# Można go wywołać z dowolnego katalogu — .env zawsze powstaje obok
# docker-compose.yml:
#   ./scripts/setup-env.sh --domain fiszki.example.com
#   ./scripts/setup-env.sh --domain fiszki.example.com --api-domain api.fiszki.example.com
#   ./scripts/setup-env.sh --local
#
set -eu

# .env musi powstać obok docker-compose.yml, a nie w katalogu, z którego akurat
# wywołano skrypt — inaczej uruchomienie go z wnętrza scripts/ tworzy plik,
# którego compose nigdy nie zobaczy. Ustalamy katalog projektu z położenia
# samego skryptu.
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$PROJECT_ROOT/docker-compose.yml" ]; then
  echo "Błąd: nie znalazłem docker-compose.yml w $PROJECT_ROOT." >&2
  echo "Skrypt powinien leżeć w katalogu scripts/ wewnątrz repozytorium." >&2
  exit 1
fi

ENV_FILE="$PROJECT_ROOT/.env"
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

# Nazwy sieci, entrypointu i resolvera różnią się między instalacjami Traefika,
# a wpisanie złej nie daje błędu — tylko 404 i certyfikat zastępczy, co trudno
# powiązać z przyczyną. Dlatego czytamy je z działającego kontenera, zamiast
# zgadywać. Gdy Traefika nie ma albo konfiguruje go plik yml, zostają wartości
# domyślne i komunikat, żeby je sprawdzić ręcznie.
TRAEFIK_NETWORK_VALUE="traefik"
TRAEFIK_ENTRYPOINT_VALUE="websecure"
TRAEFIK_CERTRESOLVER_VALUE="letsencrypt"
TRAEFIK_DETECTED=""

if command -v docker >/dev/null 2>&1; then
  TRAEFIK_CT="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i traefik | head -1)"
  if [ -n "$TRAEFIK_CT" ]; then
    TRAEFIK_ARGS="$(docker inspect "$TRAEFIK_CT" --format '{{range .Args}}{{println .}}{{end}}' 2>/dev/null)"

    DET_NET="$(docker inspect "$TRAEFIK_CT" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}
{{end}}' 2>/dev/null | grep -v '^$' | head -1)"
    # Entrypoint obsługujący :443 — tam trafia ruch HTTPS.
    DET_EP="$(printf '%s' "$TRAEFIK_ARGS" | sed -n 's/^--entrypoints\.\([^.]*\)\.address=:443$/\1/p' | head -1)"
    DET_CR="$(printf '%s' "$TRAEFIK_ARGS" | sed -n 's/^--certificatesresolvers\.\([^.]*\)\..*/\1/p' | head -1)"

    [ -n "$DET_NET" ] && TRAEFIK_NETWORK_VALUE="$DET_NET"
    [ -n "$DET_EP" ] && TRAEFIK_ENTRYPOINT_VALUE="$DET_EP"
    [ -n "$DET_CR" ] && TRAEFIK_CERTRESOLVER_VALUE="$DET_CR"
    TRAEFIK_DETECTED="$TRAEFIK_CT"
  fi
fi

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

# Domena aplikacji. Używana przez reverse proxy — zarówno wbudowany profil
# "proxy" (Caddy), jak i nakładkę docker-compose.traefik.yml.
DOMAIN=${DOMAIN_VALUE}

# Tylko dla profilu "proxy" (Caddy): adres do powiadomień Let's Encrypt.
ACME_EMAIL=

# Tylko dla nakładki docker-compose.traefik.yml. Wartości MUSZĄ odpowiadać
# Twojej instancji Traefika, inaczej trasy po cichu nie powstaną:
#   docker network ls                        # nazwa sieci Traefika
#   docker inspect <kontener-traefika>       # entrypoints i certificatesresolvers
TRAEFIK_NETWORK=${TRAEFIK_NETWORK_VALUE}
TRAEFIK_ENTRYPOINT=${TRAEFIK_ENTRYPOINT_VALUE}
TRAEFIK_CERTRESOLVER=${TRAEFIK_CERTRESOLVER_VALUE}
ENVFILE

umask "$OLD_UMASK"
chmod 600 "$ENV_FILE"

echo "Utworzono $ENV_FILE (uprawnienia 600, tylko właściciel)."
echo
echo "  frontend : ${FRONTEND_ORIGIN}"
echo "  API      : ${API_URL}"
echo
echo "Następny krok — z katalogu projektu ($PROJECT_ROOT):"
echo "  docker compose up -d --build"
echo "  docker compose --profile seed run --rm seeder   # jednorazowo, dane startowe"
echo
if [ -n "$TRAEFIK_DETECTED" ]; then
  echo "Wykryto Traefika w kontenerze \"$TRAEFIK_DETECTED\" i wpisano jego ustawienia:"
  echo "  TRAEFIK_NETWORK=$TRAEFIK_NETWORK_VALUE"
  echo "  TRAEFIK_ENTRYPOINT=$TRAEFIK_ENTRYPOINT_VALUE"
  echo "  TRAEFIK_CERTRESOLVER=$TRAEFIK_CERTRESOLVER_VALUE"
  echo "Uruchom z nakładką:"
  echo "  docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build"
else
  echo "Masz własnego Traefika? Sprawdź jego nazwy i wpisz je w .env"
  echo "(TRAEFIK_NETWORK / TRAEFIK_ENTRYPOINT / TRAEFIK_CERTRESOLVER), a potem:"
  echo "  docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build"
  echo "Diagnostyka rozbieżności: ./scripts/diagnose-traefik.sh"
fi

if [ "$LOCAL" -eq 0 ] && [ "$SCHEME" = "https" ]; then
  echo
  echo "Uwaga: ciasteczka sesji mają flagę Secure w trybie produkcyjnym, więc"
  echo "aplikacja MUSI działać po HTTPS. Po zwykłym HTTP logowanie przejdzie,"
  echo "ale sesja się nie utrzyma. Postaw przed nią reverse proxy z certyfikatem."
fi
