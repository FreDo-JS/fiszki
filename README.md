Fiszki - Bardzo chce nauczyć się słowek dlatego też utworzony został ten projekt przy użyciu
-REACT
-NODE
-POSTGRES

Aby mieć dobre narzędzie do stworzenia sensownego pola do nauki

Aktualny krok to wdrożenie na serwer i zdockerowanie całej aplikacji z Docker Compose

## Uruchomienie przez Docker Compose

Wymagany jest tylko Docker (Docker Desktop na Windows/macOS, Docker Engine + plugin `compose` na Linuksie).

1. Skopiuj przykładową konfigurację i uzupełnij sekrety:

   ```bash
   cp .env.example .env
   ```

   W `.env` ustaw co najmniej `POSTGRES_PASSWORD`, `JWT_SECRET` i `JWT_REFRESH_SECRET`
   (dwie różne, długie losowe wartości — `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`).
   Bez nich `docker compose` celowo odmówi startu.

2. Zbuduj i uruchom całość:

   ```bash
   docker compose up -d --build
   ```

   - frontend: http://localhost:8080
   - API: http://localhost:4000/api (health check: http://localhost:4000/health)
   - Postgres: `127.0.0.1:5432` (tylko z hosta)

   Migracje Prismy (`prisma migrate deploy`) wykonują się automatycznie przy starcie kontenera API.

3. Opcjonalnie — zasil bazę startowym słownictwem (jednorazowo, po wstaniu API):

   ```bash
   docker compose --profile seed run --rm seeder
   ```

4. Podgląd logów i zatrzymanie:

   ```bash
   docker compose logs -f backend
   ```

   ```bash
   docker compose down
   ```

   `docker compose down -v` usuwa też wolumen z danymi bazy.

### Wdrożenie na serwer

W `.env` podmień adresy na publiczne (`VITE_API_URL`, `CORS_ORIGIN`) i przebuduj frontend —
`VITE_API_URL` jest wkompilowywane w bundle w czasie builda, a nie czytane przy starcie:

```bash
docker compose up -d --build
```

`CORS_ORIGIN` musi być dokładnym originem frontendu (bez ukośnika na końcu), inaczej API
odrzuci logowanie i wszystkie zapisy (mechanizm anty-CSRF sprawdza nagłówek `Origin`).
