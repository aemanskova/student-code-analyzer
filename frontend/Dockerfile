FROM public.ecr.aws/docker/library/node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmjs.org/ \
  && npm install --no-audit --no-fund --progress=false

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
