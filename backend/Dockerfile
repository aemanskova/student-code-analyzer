# public.ecr.aws — зеркало официальных образов, без лимита pull Docker Hub
FROM public.ecr.aws/docker/library/node:20-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium default-jre-headless python3 python3-venv unzip wget \
  && wget -qO /tmp/sonar-scanner.zip https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-6.2.1.4610.zip \
  && unzip -q /tmp/sonar-scanner.zip -d /opt \
  && ln -s /opt/sonar-scanner-6.2.1.4610/bin/sonar-scanner /usr/local/bin/sonar-scanner \
  && rm -f /tmp/sonar-scanner.zip \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/sklearn-venv \
  && /opt/sklearn-venv/bin/python -m pip install --no-cache-dir --upgrade pip \
  && /opt/sklearn-venv/bin/python -m pip install --no-cache-dir "scikit-learn>=1.5.2"

COPY package*.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

# На слабом VPS без swap `nest build` может падать по памяти (exit 1)
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Не делаем chown -R /app — обход node_modules очень долгий на VPS. node читает dist и node_modules с правами «другие».
RUN mkdir -p /app/data/sqlite /app/works

USER node

ENV PORT=3000
ENV SQLITE_DB_PATH=/app/data/sqlite/app.db
ENV WORKS_ROOT=/app/works
ENV CHROME_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium
ENV VNU_JAR=/app/node_modules/vnu-jar/build/dist/vnu.jar
ENV SKLEARN_PYTHON_PATH=/opt/sklearn-venv/bin/python

EXPOSE 3000

CMD ["node", "dist/main.js"]
