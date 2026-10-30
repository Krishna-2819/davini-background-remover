FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --package-lock-only && npm ci
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["node", "/app/server/index.js"]
