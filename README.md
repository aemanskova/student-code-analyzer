Веб-приложение для анализа качества кода студенческих работ. Система принимает архивы с работами, считает метрики по HTML и CSS, JavaScript, TypeScript, Vue, показывает результаты в таблицах и графиках, строит тепловые карты похожести и поддерживает кластеризацию работ по метрикам.

## Возможности

- загрузка архивов с работами студентов;
- анализ метрик кода и верстки;
- просмотр результатов анализа по запускам и архивам;
- графики метрик и распределений;
- построение тепловых карт похожести/плагиата;
- кластеризация работ;
- авторизация пользователей;
- глоссарий метрик;
- Swagger-документация API в режиме разработки.

## Стек

- Frontend: React, TypeScript, Vite, Mantine, Redux Toolkit.
- Backend: NestJS, TypeScript, TypeORM, SQLite.
- Хранилище файлов: MinIO, S3-compatible API.
- Анализ: SonarQube, ESLint, HTML/CSS/JS/TS/Vue анализаторы.
- Инфраструктура: Docker Compose, Caddy для production-сборки.

## Структура проекта

```text
backend/              NestJS API
frontend/             React/Vite приложение
data/                 локальные данные SQLite
works/                рабочая директория для распакованных/обрабатываемых работ
csv/                  CSV-файлы, если используются при обработке
scripts/              вспомогательные скрипты
docker-compose.yml    dev-инфраструктура
docker-compose.prod.yml production-инфраструктура
.env.example          пример переменных окружения
```

## Требования

- Node.js 20+
- npm
- Docker и Docker Compose

Рекомендуемый способ запуска для разработки - через Docker Compose, потому что backend зависит от MinIO и SonarQube.

## Настройка окружения

Скопируйте пример переменных окружения:

```bash
cp .env.example .env
```

Для локальной разработки значения из `.env.example` уже настроены на:

- frontend: `http://localhost:5173`
- backend API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- MinIO API: `http://localhost:9100`
- MinIO Console: `http://localhost:9101`
- SonarQube: `http://localhost:9000`

Перед production-запуском обязательно поменяйте секреты и пароли:

- `JWT_SECRET`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

## Запуск в Docker

Запуск dev-окружения:

```bash
docker compose up --build
```

После запуска откройте приложение:

```text
http://localhost:5173
```

Остановка контейнеров:

```bash
docker compose down
```

Остановка с удалением volume-данных MinIO/SonarQube:

```bash
docker compose down -v
```

## Локальный запуск без Docker

Этот вариант удобен для разработки отдельных частей, но для полного анализа все равно нужны MinIO и SonarQube.

Установка зависимостей backend:

```bash
cd backend
npm install
```

Запуск backend в dev-режиме:

```bash
npm run start:dev
```

Установка зависимостей frontend:

```bash
cd frontend
npm install
```

Запуск frontend:

```bash
npm run dev
```

Frontend будет доступен на `http://localhost:5173`, backend - на `http://localhost:3000/api`.

## Команды backend

Выполняются из директории `backend/`.

```bash
npm run start:dev      # запуск NestJS в watch-режиме
npm run build          # сборка backend
npm run start          # запуск собранного dist/main.js
npm test               # unit-тесты Jest
npm run format         # форматирование Prettier
npm run format:check   # проверка форматирования
```

## Команды frontend

Выполняются из директории `frontend/`.

```bash
npm run dev            # запуск Vite dev server
npm run build          # TypeScript build + Vite build
npm run preview        # preview production-сборки
npm run lint           # проверка ESLint
npm run lint:fix       # автоисправление ESLint
npm run format         # форматирование Prettier
npm run format:check   # проверка форматирования
```


## Лицензия

Условия использования проекта описаны в файле [LICENSE](LICENSE).
