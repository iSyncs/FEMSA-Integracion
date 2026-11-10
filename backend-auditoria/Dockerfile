# Imagen de la API para Vercel (servicio tipo contenedor).
FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
