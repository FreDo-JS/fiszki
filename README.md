# Fiszki — nauka słownictwa angielskiego

Produkcyjna aplikacja typu Anki do nauki angielskiego słownictwa, z algorytmem powtórek rozłożonych w czasie (spaced repetition, SM-2), zbudowana na 5000 najczęściej używanych słów języka angielskiego.

## Stack technologiczny

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Baza danych:** PostgreSQL + Prisma ORM
- **Autoryzacja:** JWT (access + refresh) w bezpiecznych httpOnly cookies, hashowanie haseł Argon2id
- **Audio:** Web Speech API (wymowa brytyjska/amerykańska)

## Struktura projektu

```
.
├── backend/
│   ├── prisma/            # schema.prisma, migracje, seed.ts, dane startowe
│   └── src/
│       ├── config/        # env, klient Prisma
│       ├── controllers/   # kontrolery HTTP
│       ├── services/      # logika biznesowa (w tym silnik SM-2)
│       ├── middleware/    # auth, role, walidacja, rate-limit, CSRF, błędy
│       ├── validators/    # schematy Zod
│       ├── routes/        # definicje REST API
│       └── utils/
├── frontend/
│   └── src/
│       ├── api/            # klient axios + typowane wywołania API
│       ├── components/     # komponenty wielokrotnego użytku
│       ├── context/        # Auth / Theme / Toast
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       └── styles/
└── docker-compose.yml
```

## Uruchomienie (Docker — najprostsza droga)

Wymaga zainstalowanego Dockera i Docker Compose.

```bash
git clone <adres-repozytorium>
cd Fiskzi
docker compose up --build
```

Po zbudowaniu obrazów:
- Backend API: http://localhost:4000/api
- Frontend: http://localhost:5173
- PostgreSQL: localhost:5432

Migracje bazy danych uruchamiają się automatycznie przy starcie kontenera backendu (`prisma migrate deploy`). Aby wypełnić bazę danymi startowymi (5000 słówek w 10 zestawach + konto administratora i demo), uruchom raz:

```bash
docker compose exec backend npm run seed
```

## Uruchomienie lokalnie (bez Dockera)

### 1. Baza danych

Uruchom samą bazę PostgreSQL w Dockerze (albo użyj lokalnej instalacji Postgresa):

```bash
docker compose up postgres -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Backend wystartuje na `http://localhost:4000`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend wystartuje na `http://localhost:5173`.

## Konta startowe (po `npm run seed`)

| Rola  | E-mail            | Hasło      |
|-------|--------------------|------------|
| Admin | admin@fiszki.app   | Admin1234  |
| User  | demo@fiszki.app    | Demo1234   |

Konto administratora ma dostęp do panelu `/admin`. Wszystkie 10 zestawów słownictwa (grupy 1–10, poziomy A1–C1) są publiczne — zwykły użytkownik musi je **zduplikować** do swojej kolekcji (przycisk „Duplikuj, aby się uczyć”), aby rozpocząć naukę z własnym, niezależnym postępem.

## Źródło słownictwa

Baza startowa zawiera wszystkie 5000 słów z listy frekwencyjnej języka angielskiego (10 grup po 500 słów), podzielonych na zestawy dokładnie tak, jak w źródłowym materiale.

**Każda z 5000 fiszek ma komplet: tłumaczenie polskie, definicję po angielsku i przykład użycia** (wymowa IPA: 4823/5000 — dla pozostałych działa syntezator mowy). Dane pochodzą z:

- **FreeDict eng-pol** (słownik Piotrowski+Saloni, GNU FDL) — tłumaczenia polskie, wymowa IPA, część mowy
- **Wiktionary** via [kaikki.org](https://kaikki.org) — definicje angielskie i przykłady użycia
- **dictionaryapi.dev** — uzupełnienia

Wiktionary porządkuje znaczenia historycznie, więc pierwsze znaczenie popularnego słowa bywa archaiczne lub specjalistyczne (`lake` jako „strumyk”, `charging` jako faul w koszykówce). Skrypt wyboru odfiltrowuje sensy oznaczone jako przestarzałe, gwarowe czy dziedzinowe i dopasowuje część mowy do podpowiedzi z FreeDict. Definicje i przykłady dla całej Grupy 1 (500 najczęstszych słów) oraz ok. 700 dalszych haseł napisano ręcznie, ponieważ dla nich automat dawał zbyt niską jakość.

Brakujące pola można w każdej chwili uzupełnić ręcznie lub przyciskiem „Generuj” w formularzu fiszki.

### Aktualizacja słownictwa bez utraty postępu

`npm run seed` podmienia publiczne zestawy startowe. Aby jedynie **uzupełnić lub poprawić treść istniejących fiszek** — również w taliach, które użytkownicy zduplikowali do własnych kolekcji — użyj:

```bash
npm run enrich              # uzupełnia wyłącznie puste pola
npm run enrich -- --overwrite   # nadpisuje też istniejącą treść danymi z pliku
```

Skrypt nigdy niczego nie usuwa i nie rusza stanu algorytmu powtórek, historii ani statystyk.

## Testy backendu

Testy integracyjne wymagają działającej bazy PostgreSQL (**nie** używaj bazy z prawdziwymi danymi — tabele są czyszczone przed każdym testem).

```bash
cd backend
docker compose up postgres -d   # z katalogu głównego, jeśli baza nie działa
cp .env.example .env            # DATABASE_URL powinien wskazywać na testową bazę
npm run test
```

Zestaw testów obejmuje m.in.: rejestrację i logowanie, walidację danych wejściowych, ochronę przed IDOR (dostęp do cudzych fiszek/zestawów), ochronę przed mass assignment (np. próba nadania sobie roli ADMIN lub oszukania algorytmu powtórek), sanityzację przed XSS, odporność na SQL injection oraz poprawność matematyczną algorytmu SM-2 (interwały, ease factor, warunki opanowania fiszki).

## Bezpieczeństwo — najważniejsze mechanizmy

- Hasła hashowane Argon2id, nigdy nie przechowywane ani nie logowane jawnie
- Tokeny JWT (access + refresh) w cookies `httpOnly`, `secure` (produkcja), `SameSite=Lax`; refresh tokeny są rotowane i przechowywane w bazie jako hash SHA-256
- Ochrona CSRF poprzez weryfikację nagłówka `Origin`/`Referer` na każdym żądaniu modyfikującym stan
- Rate limiting globalny oraz zaostrzony na `/auth/login` i `/auth/register`; blokada konta po 5 nieudanych próbach logowania na 15 minut
- Walidacja i sanityzacja wszystkich danych wejściowych (Zod + usuwanie znaczników HTML z pól tekstowych fiszek)
- Wszystkie zapytania do bazy przez Prisma (parametryzowane zapytania — brak SQL injection)
- Middleware autoryzacji sprawdzający właściciela zasobu przy każdej operacji na zestawie/fiszce (ochrona przed IDOR) oraz middleware roli dla endpointów administracyjnych
- Nagłówki bezpieczeństwa przez Helmet (CSP, brak `X-Powered-By`, itd.), limit rozmiaru żądania (1 MB / 2 MB dla importu)
- CORS ograniczony do jawnie skonfigurowanej listy originów

## Algorytm powtórek (SM-2)

Zaimplementowany w `backend/src/services/sm2.service.ts` jako czysty, w pełni testowalny moduł (patrz `backend/tests/sm2.test.ts`), niezależny od bazy danych i warstwy HTTP. Trzy oceny (Nie pamiętam / Trudne / Pamiętam) odpowiadają jakościom SM-2 0/3/5.

Fiszka otrzymuje status „opanowana” dopiero po **3 kolejnych** ocenach „Pamiętam” i osiągnięciu interwału ≥ 7 dni — w praktyce oznacza to trzy udane przypomnienia w trzech różnych dniach (ok. tygodnia nauki). Pojedyncze kliknięcie „Pamiętam” nigdy tego nie wywołuje, a każda odpowiedź „Nie pamiętam” lub „Trudne” natychmiast cofa ten status, nawet jeśli fiszka była już opanowana. Próg interwału jest celowo niższy niż 21-dniowa granica „dojrzałej karty” z Anki: przy 21 dniach najwcześniejsze możliwe opanowanie wypadało dopiero przy 4. powtórce, czyli po ok. 24 dniach kalendarzowych, przez co licznik opanowanych fiszek przez pierwsze tygodnie zawsze pokazywał zero.

## Zmienne środowiskowe

Zobacz `backend/.env.example` i `frontend/.env.example`. Sekrety (`JWT_SECRET`, `JWT_REFRESH_SECRET`) muszą zostać wygenerowane na nowo przed wdrożeniem produkcyjnym:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
