FROM node:20-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium default-jre-headless \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY nest-cli.json tsconfig.json ./
COPY src ./src

RUN npm run build

RUN mkdir -p /app/data/sqlite /app/data/duckdb /app/csv /app/works

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
