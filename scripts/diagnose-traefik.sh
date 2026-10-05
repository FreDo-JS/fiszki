#!/bin/sh
# Diagnostyka integracji z Traefikiem.
#
# Typowy objaw: przeglądarka ostrzega o niezaufanym certyfikacie, a po
# przejściu dalej widać 404. To jedna usterka widziana dwa razy — Traefik nie
# dopasował żadnego routera do domeny, więc oddaje swój domyślny certyfikat
# i domyślną odpowiedź 404. Ten skrypt pokazuje, dlaczego router nie powstał.
#
#   ./scripts/diagnose-traefik.sh
#
set -u

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

say() { printf '\n=== %s ===\n' "$1"; }

say "1. Ustawienia z .env"
if [ -f .env ]; then
  grep -E '^(DOMAIN|TRAEFIK_|CORS_ORIGIN|VITE_API_URL)=' .env || echo "BRAK zmiennych DOMAIN/TRAEFIK_* — to już jest przyczyna."
else
  echo "BRAK pliku .env w $PROJECT_ROOT — uruchom scripts/setup-env.sh"
  exit 1
fi

DOMAIN="$(grep -E '^DOMAIN=' .env | cut -d= -f2-)"
WANT_NET="$(grep -E '^TRAEFIK_NETWORK=' .env | cut -d= -f2-)"
WANT_EP="$(grep -E '^TRAEFIK_ENTRYPOINT=' .env | cut -d= -f2-)"
WANT_CR="$(grep -E '^TRAEFIK_CERTRESOLVER=' .env | cut -d= -f2-)"

say "1b. Spójność adresów w .env"
# Najczęstszy błąd po wdrożeniu: DOMAIN poprawione, ale CORS_ORIGIN i
# VITE_API_URL zostały lokalne. Objaw jest mylący, bo strona otwiera się
# normalnie, a dopiero logowanie zwraca 403 albo zapytania idą w pustkę.
CORS_ORIGIN_V="$(grep -E '^CORS_ORIGIN=' .env | cut -d= -f2-)"
VITE_API_URL_V="$(grep -E '^VITE_API_URL=' .env | cut -d= -f2-)"
PROBLEMY=0

case "$CORS_ORIGIN_V" in
  *"$DOMAIN"*) echo "CORS_ORIGIN zawiera domenę — OK" ;;
  *) echo "BŁĄD: CORS_ORIGIN ($CORS_ORIGIN_V) nie pasuje do DOMAIN ($DOMAIN)"
     echo "      -> API odrzuci logowanie i zapisy z komunikatem 'Invalid request origin'"
     PROBLEMY=$((PROBLEMY + 1)) ;;
esac

case "$VITE_API_URL_V" in
  *"$DOMAIN"*) echo "VITE_API_URL zawiera domenę — OK" ;;
  *) echo "BŁĄD: VITE_API_URL ($VITE_API_URL_V) nie pasuje do DOMAIN ($DOMAIN)"
     echo "      -> przeglądarka wyśle zapytania pod zły adres"
     PROBLEMY=$((PROBLEMY + 1)) ;;
esac

if [ "$PROBLEMY" -gt 0 ]; then
  echo
  echo "Po poprawieniu .env frontend MUSI zostać przebudowany (--build),"
  echo "bo VITE_API_URL jest wkompilowywane w bundle, a nie czytane przy starcie."
fi

say "2. Kontener Traefika"
TRAEFIK="$(docker ps --filter ancestor=traefik --format '{{.Names}}' | head -1)"
[ -z "$TRAEFIK" ] && TRAEFIK="$(docker ps --format '{{.Names}}' | grep -i traefik | head -1)"
if [ -z "$TRAEFIK" ]; then
  echo "Nie znalazłem działającego kontenera Traefika."
  exit 1
fi
echo "kontener: $TRAEFIK"
echo "sieci:    $(docker inspect "$TRAEFIK" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"

say "3. Entrypointy i resolvery, które Traefik NAPRAWDĘ ma"
# Nazwy bierzemy z argumentów uruchomienia; przy konfiguracji z pliku
# traefik.yml trzeba zajrzeć do niego (ścieżka poniżej w montowaniach).
docker inspect "$TRAEFIK" --format '{{range .Args}}{{println .}}{{end}}' \
  | grep -iE 'entrypoint|certificatesresolver' || echo "(brak w argumentach — sprawdź plik konfiguracyjny)"
echo "--- zamontowane pliki konfiguracyjne ---"
docker inspect "$TRAEFIK" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' \
  | grep -viE 'docker.sock' || echo "(brak)"

say "4. Czego oczekuje nakładka (z .env)"
echo "DOMAIN              = ${DOMAIN:-<puste>}"
echo "TRAEFIK_NETWORK     = ${WANT_NET:-<puste>}"
echo "TRAEFIK_ENTRYPOINT  = ${WANT_EP:-<puste>}   <- musi być na liście z punktu 3"
echo "TRAEFIK_CERTRESOLVER= ${WANT_CR:-<puste>}   <- musi być na liście z punktu 3"

say "5. Kontenery aplikacji: sieci i etykiety"
for svc in frontend backend; do
  C="$(docker compose ps -q "$svc" 2>/dev/null)"
  if [ -z "$C" ]; then
    echo "$svc: nie działa (uruchom z nakładką docker-compose.traefik.yml)"
    continue
  fi
  echo "$svc: sieci = $(docker inspect "$C" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
  docker inspect "$C" --format '{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}
{{end}}' | grep '^traefik' | sed 's/^/  /'
done

say "6. Co Traefik mówi o naszych routerach"
docker logs "$TRAEFIK" 2>&1 | grep -iE 'fiszki|entrypoint doesn|no valid entrypoint|certificate|acme' | tail -20 \
  || echo "(nic w logach — Traefik może w ogóle nie widzieć tych kontenerów)"

say "Najczęstsze przyczyny"
cat <<'HINTS'
  * TRAEFIK_ENTRYPOINT nie istnieje (np. Twój Traefik ma "https", nie "websecure").
    W logach: "EntryPoint doesn't exist" / "No valid entryPoint for this router".
  * TRAEFIK_CERTRESOLVER nie istnieje -> brak certyfikatu dla domeny i ostrzeżenie
    przeglądarki, mimo że trasa istnieje.
  * Kontenery nie są w tej samej sieci co Traefik (punkt 2 vs punkt 5).
  * Rekord A domeny nie wskazuje na ten serwer albo ruch idzie do innego proxy.
Po poprawieniu .env:
  docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --force-recreate
HINTS
