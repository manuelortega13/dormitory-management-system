FROM node:20-slim

WORKDIR /app

COPY server/package*.json ./
RUN npm install

COPY server/ ./

EXPOSE 3000

CMD ["node", "src/index.js"]
