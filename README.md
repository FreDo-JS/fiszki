[![CI](https://github.com/FreDo-JS/fiszki/actions/workflows/ci.yml/badge.svg)](https://github.com/FreDo-JS/fiszki/actions/workflows/ci.yml)

Fiszki - Bardzo chce nauczyć się słowek dlatego też utworzony został ten projekt przy użyciu
-REACT
-NODE
-POSTGRES

Aby mieć dobre narzędzie do stworzenia sensownego pola do nauki

Aktualny krok to wdrożenie na serwer i zdockerowanie całej aplikacji z Docker Compose

## Jak działa nauka

### Algorytm powtórek (SM-2)

Terminy powtórek wyznacza klasyczny algorytm **SuperMemo 2** na oryginalnej skali jakości 0-5
([backend/src/services/sm2.service.ts](backend/src/services/sm2.service.ts)). Po odsłonięciu odpowiedzi
oceniasz ją jednym z pięciu przycisków (skróty `1`-`5`):

| Przycisk | Jakość (q) | Co robi algorytm |
| --- | --- | --- |
| Nie pamiętam | 0 | zeruje postęp, fiszka wraca po ~10 min, ease -0,80 |
| Ledwo | 1 | zeruje postęp, fiszka wraca po ~20 min, ease -0,54 |
| Z trudem | 3 | zalicza, ale skraca odstęp (×0,8) i obniża ease o 0,14 |
| Dobrze | 4 | pełny odstęp, ease bez zmian |
| Łatwo | 5 | odstęp ×1,3, ease +0,10 |

Zgodnie z SM-2 jakość poniżej 3 to **nieudane przypomnienie** — liczy się jako błąd w statystykach
i cofa fiszkę na początek harmonogramu. Udane powtórki idą ścieżką 1 dzień → 6 dni →
`poprzedni odstęp × easeFactor`, przy czym ease jest przycięty do zakresu 1,3-3,2.
Fiszka dostaje status „opanowana" dopiero po 3 kolejnych ocenach Dobrze/Łatwo i odstępie co najmniej 7 dni.

### Tempo nauki i cofanie oceny

**Dzienny limit nowych fiszek** (domyślnie 20, do zmiany w *Ustawieniach*) ogranicza, ile niewidzianych
wcześniej fiszek aplikacja wprowadzi w ciągu dnia. Limit liczy się łącznie dla wszystkich zestawów, więc
nie da się go obejść przeskakiwaniem między nimi. **Powtórek limit nie dotyczy** — przychodzą w terminie
wyznaczonym przez SM-2, bo to praca, na którą już się zapisałeś. Wartość 0 wyłącza nowe fiszki.

**Cofnięcie ostatniej oceny** (przycisk w sesji albo klawisz `Z`) odtwarza stan fiszki sprzed oceny co do
daty następnej powtórki — każda ocena zapisuje pełną migawkę stanu. Razem z nią wycofywane są liczniki
dnia, sesji i seria. Cofnąć można tylko ostatnią ocenę.

### Rodzaje fiszek

Każda fiszka ma rodzaj (**słownictwo**, **gramatyka**, **czasy**) i poziom CEFR (**A1-C1**).
Po obu da się filtrować listę fiszek, a panel główny pokazuje postęp w rozbiciu na te kategorie.
Tryb nauki wybierasz linkiem: `?mode=review` (tylko zaplanowane powtórki), `?mode=new` (tylko nowe)
albo bez parametru (zaległe → na dziś → nowe).

Seed tworzy trzy publiczne zestawy startowe (44 fiszki: 15 słownictwa, 15 gramatyki, 14 czasów)
obok dziesięciu zestawów z listy frekwencyjnej.

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

## Testy

Testy backendu wymagają działającego Postgresa i **czyszczą tabele przed każdym testem**, więc nigdy nie
uruchamiaj ich na bazie z prawdziwymi danymi. Przy wstawionym stacku najprościej użyć osobnej bazy w tym
samym kontenerze:

```bash
docker compose exec db psql -U fiszki -d postgres -c "CREATE DATABASE fiszki_test OWNER fiszki;"
```

```bash
cd backend && DATABASE_URL="postgresql://fiszki:<hasło>@localhost:5432/fiszki_test?schema=public" npx prisma migrate deploy && npm test
```

To samo robi CI przy każdym pushu — plus typecheck obu stron, build frontendu i budowa obrazów Dockera
(patrz [.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Wdrożenie na serwer (VPS z Dockerem)

### Sekrety

Plik `.env` jest w `.gitignore`, więc **świeży klon na serwerze go nie ma** i compose celowo odmówi
startu. To nie usterka — sekrety nigdy nie powinny jechać przez repozytorium. Wygeneruj je na miejscu:

```bash
git clone https://github.com/FreDo-JS/fiszki.git && cd fiszki && ./scripts/setup-env.sh --domain twoja-domena.pl
```

Skrypt tworzy `.env` z trzema losowymi sekretami (po 96 znaków hex), nadaje mu uprawnienia `600`
i odmawia nadpisania istniejącego pliku — zmiana `POSTGRES_PASSWORD` rozjechałaby się z hasłem
zapisanym w wolumenie bazy przy pierwszym starcie.

Zasady, które warto utrzymać:

- **Nie kopiuj lokalnego `.env` na serwer.** Każda maszyna ma własne sekrety, więc wyciek na jednej
  nie dotyka drugiej.
- Sekrety zna tylko serwer. Jeśli potrzebujesz kopii zapasowej, trzymaj ją w menedżerze haseł, nie w repo.
- Rotacja kluczy JWT (`JWT_SECRET`, `JWT_REFRESH_SECRET`) jest bezpieczna w każdej chwili — wyloguje
  tylko wszystkich użytkowników. Rotacja `POSTGRES_PASSWORD` wymaga też `ALTER USER` w bazie.

### Wariant A: masz już własnego Traefika

Użyj nakładki [docker-compose.traefik.yml](docker-compose.traefik.yml) razem z plikiem bazowym.
W `.env` muszą się znaleźć cztery wartości — trzy ostatnie **muszą odpowiadać Twojej instancji Traefika**,
inaczej trasy nie powstaną:

```bash
docker network ls          # nazwa sieci Traefika -> TRAEFIK_NETWORK
docker inspect <traefik>   # entrypoints i certificatesresolvers
```

```
DOMAIN=fiszki.juniodevops.xyz
TRAEFIK_NETWORK=traefik
TRAEFIK_ENTRYPOINT=websecure
TRAEFIK_CERTRESOLVER=letsencrypt
```

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

Nakładka podłącza frontend i backend do sieci Traefika, opisuje je etykietami (`/api` i `/health` do
backendu z priorytetem 100, reszta do frontendu z priorytetem 10) i **zdejmuje publikowanie portów
8080/4000 na hoście** — za reverse proxy aplikacja nie ma być dostępna z pominięciem TLS-a. Baza
zostaje wyłącznie w sieci wewnętrznej, z `traefik.enable=false`.

Express montuje router pod `/api`, więc prefiksu **nie** obcinamy żadnym middleware.

**Przeglądarka ostrzega o certyfikacie, a po przejściu dalej widać 404?** To jedna usterka widziana
dwa razy: żaden router nie dopasował domeny, więc Traefik oddaje swój domyślny certyfikat
(`CN=TRAEFIK DEFAULT CERT`) i domyślne 404. Prawie zawsze oznacza to, że `TRAEFIK_ENTRYPOINT` albo
`TRAEFIK_CERTRESOLVER` nie istnieje w Twojej instancji. Przyczynę wskaże:

```bash
./scripts/diagnose-traefik.sh
```

Skrypt zestawia obok siebie nazwy, które Traefik naprawdę ma, z tymi, których oczekuje nakładka,
i wyciąga z logów wpisy `EntryPoint doesn't exist` oraz `nonexistent certificate resolver`.

### Wariant B: nie masz reverse proxy — użyj wbudowanego

### HTTPS jest wymagany, nie opcjonalny

Ciasteczka sesji mają w trybie produkcyjnym flagę `Secure`, więc **po zwykłym HTTP logowanie przejdzie,
ale sesja się nie utrzyma** — przeglądarka po cichu odrzuci ciasteczko. W repo jest gotowy reverse proxy
(Caddy, automatyczny certyfikat Let's Encrypt), uruchamiany opcjonalnym profilem:

```bash
docker compose --profile proxy up -d --build
```

Caddy kieruje `/api/*` do backendu, resztę do frontendu, więc wszystko działa na jednym originie —
CORS i `SameSite=Lax` przestają być problemem. Wymaga wolnych portów 80 i 443 oraz rekordu A domeny
wskazującego na serwer. Bez profilu `proxy` nic się nie zmienia i aplikacja nadal chodzi na `localhost:8080`.

Na koniec dane startowe (jednorazowo):

```bash
docker compose --profile seed run --rm seeder
```

### Zmiana adresów po wdrożeniu

`VITE_API_URL` jest **wkompilowywane w bundle podczas budowy obrazu**, a nie czytane przy starcie —
po każdej zmianie trzeba przebudować frontend:

```bash
docker compose up -d --build
```

`CORS_ORIGIN` musi być dokładnym originem frontendu (bez ukośnika na końcu), inaczej API
odrzuci logowanie i wszystkie zapisy (mechanizm anty-CSRF sprawdza nagłówek `Origin`).
