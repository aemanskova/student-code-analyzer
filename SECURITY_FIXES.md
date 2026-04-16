# Документация по исправлениям безопасности

Краткое описание изменений, связанных с усилением защиты приложения и подготовкой к продакшену.

## 1. Хеширование паролей (bcrypt)

**Проблема:** при регистрации во второй аргумент `bcrypt.hash()` передавалась фиксированная строка в формате соли, из‑за чего все пароли хешировались с одним и тем же префиксом соли (слабее, чем индивидуальная соль на пользователя).

**Исправление:** используется число раундов (`BCRYPT_ROUNDS`, по умолчанию 12, допустимо 10–15). Хеши refresh-токенов используют те же раунды.

**Файлы:** `backend/src/apps/auth/auth.service.ts`

**Переменные окружения:** `BCRYPT_ROUNDS` (см. `.env.example`).

---

## 2. Проверки при `NODE_ENV=production`

**Добавлено:** перед стартом HTTP-сервера выполняется проверка:

- `JWT_SECRET` не короче 32 символов и не содержит очевидных шаблонов (`change_me`, `secret`, и т. п.).
- задан `CORS_ORIGIN` (точный origin фронтенда).

**Файлы:** `backend/src/bootstrap-security.ts`, вызов из `backend/src/main.ts` после `NestFactory.create` (чтобы подтянулся `.env` через `ConfigModule`).

---

## 3. Helmet и доверие reverse proxy

**Добавлено:**

- middleware **Helmet** с `crossOriginResourcePolicy: cross-origin` и отключённым CSP для JSON API (чтобы не ломать клиент).
- для Express включён **`trust proxy`**, если `NODE_ENV=production` или `TRUST_PROXY=true` / `1` — корректные IP клиента за Caddy/nginx для лимитов запросов.

**Файлы:** `backend/src/main.ts`

**Переменные:** `TRUST_PROXY`

---

## 4. Swagger в продакшене

**Поведение:** в production документация Swagger **не подключается**, пока явно не задано `SWAGGER_ENABLED=true`. В разработке по умолчанию Swagger включён; отключить можно `SWAGGER_ENABLED=false`.

**Файлы:** `backend/src/main.ts` (функция `shouldEnableSwagger`).

---

## 5. Ограничение частоты запросов (throttling)

**Добавлено:** глобальный guard `@nestjs/throttler` и ужесточённые лимиты на эндпоинтах аутентификации:

| Маршрут        | Лимит (по умолчанию)   |
|----------------|-------------------------|
| Глобально      | `THROTTLE_GLOBAL_LIMIT` запросов в минуту на IP (по умолчанию 400) |
| `POST /auth/login`    | 25 в минуту   |
| `POST /auth/refresh`  | 60 в минуту   |
| `POST /auth/register` | 10 за 3 часа  |

**Файлы:** `backend/src/app.module.ts`, `backend/src/apps/auth/auth.controller.ts`

**Примечание:** счётчики хранятся в памяти процесса; при горизонтальном масштабировании нужен общий storage (например Redis).

---

## 6. Публичная регистрация

**Добавлено:** если `NODE_ENV=production` и `ALLOW_PUBLIC_REGISTRATION=false`, регистрация через API возвращает **403 Forbidden**.

**Файлы:** `backend/src/apps/auth/auth.service.ts`

---

## 7. Nginx (контейнер `web`, продакшен)

**Добавлено:** `server_tokens off`, заголовки `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

**Файлы:** `frontend/nginx/default.conf`

---

## 8. Docker (backend и продакшен-compose)

**Backend Dockerfile:** после сборки каталог `/app` принадлежит пользователю `node` (`USER node`). На хосте каталоги `data`, `csv`, `works` должны быть доступны пользователю с **uid 1000** (см. `DEPLOY_TIMEWEB.md`).

**docker-compose.prod.yml:** порты контейнеров `web` и MinIO привязаны к **127.0.0.1**, чтобы не светить сервисы напрямую в интернет; наружу — через reverse proxy (Caddy) на 80/443.

---

## 9. Документация деплоя

Подробности по VPS Timeweb, домену **aemanskova.ru**, DNS для поддомена MinIO, Caddy, фаерволу и переменным окружения — в **`DEPLOY_TIMEWEB.md`**.

Полный список переменных — в **`.env.example`**.

---

## 10. Ограничение путей к файловой системе (CSV, works, zip)

**Проблема:** для `csvFile`, `rootPath` и путей из CSV при абсолютном значении путь мог выходить за пределы настроенных каталогов `CSV_ROOT` / `WORKS_ROOT`, что открывало риск чтения произвольных файлов на хосте при скомпрометированном или злоупотребляющем аккаунте.

**Исправление:**

- Вынесена общая функция **`resolvePathUnderRoot`** с проверкой через `path.relative` (путь не должен начинаться с `..` и не должен быть «вне» корня).
- В **`AnalysisService`** все соответствующие операции проходят через **`requirePathUnderRoot`** и при нарушении возвращают **`400 Bad Request`** с пояснением поля (`csvFile`, `rootPath`, `CSV path`, `zipPath`).

**Файлы:** `backend/src/common/path-security.ts`, `backend/src/apps/analysis/analysis.service.ts`

---

## 11. Воспроизводимая сборка образа и смоук-тесты

**Docker (backend):** в **`backend/Dockerfile`** зависимости ставятся через **`npm ci`** по lock-файлу, а не `npm install` — одинаковые версии пакетов между сборками.

**Сборка TypeScript:** добавлен **`tsconfig.build.json`** (исключает `**/*.spec.ts` из прод-сборки), в **`nest-cli.json`** указан `tsConfigPath` на него.

**Тесты:** добавлены **Jest** + **ts-jest**, скрипты `npm test` / `npm test:watch`. Юнит-тесты для логики путей — **`backend/src/common/path-security.spec.ts`** (проверки допустимых относительных/абсолютных путей внутри корня и отказ при выходе за пределы).

**Файлы:** `backend/Dockerfile`, `backend/tsconfig.build.json`, `backend/nest-cli.json`, `backend/package.json`, `backend/src/common/path-security.spec.ts`

---

## Связанные файлы (справочно)

| Область        | Файлы |
|----------------|--------|
| Bootstrap API  | `backend/src/main.ts`, `backend/src/bootstrap-security.ts` |
| Модули         | `backend/src/app.module.ts` |
| Auth           | `backend/src/apps/auth/auth.service.ts`, `auth.controller.ts` |
| Пути / анализ  | `backend/src/common/path-security.ts`, `backend/src/apps/analysis/analysis.service.ts` |
| Сборка / тесты | `backend/tsconfig.build.json`, `backend/nest-cli.json`, `backend/package.json` |
| Зависимости    | `backend/package.json` (`helmet`, `@nestjs/throttler`, `jest`, `ts-jest`) |
| Frontend nginx | `frontend/nginx/default.conf` |
| Compose prod   | `docker-compose.prod.yml` |
| Образ backend  | `backend/Dockerfile` |
