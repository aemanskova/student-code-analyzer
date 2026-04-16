# public.ecr.aws — зеркало официальных образов, без лимита pull Docker Hub
FROM public.ecr.aws/docker/library/node:20-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium default-jre-headless \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

# На слабом VPS без swap `nest build` может падать по памяти (exit 1)
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Не делаем chown -R /app — обход node_modules очень долгий на VPS. node читает dist и node_modules с правами «другие».
RUN mkdir -p /app/data/sqlite /app/data/duckdb /app/csv /app/works

USER node

ENV PORT=3000
ENV SQLITE_DB_PATH=/app/data/sqlite/app.db
ENV DUCKDB_PATH=/app/data/duckdb/analysis.duckdb
ENV CSV_ROOT=/app/csv
ENV WORKS_ROOT=/app/works
ENV CHROME_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium
ENV VNU_JAR=/app/node_modules/vnu-jar/build/dist/vnu.jar

EXPOSE 3000

CMD ["node", "dist/main.js"]
