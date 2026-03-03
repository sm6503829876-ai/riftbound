FROM node:20-alpine

WORKDIR /app

# 先复制 package 文件，利用 Docker 层缓存
COPY backend/package*.json ./backend/

# 仅安装生产依赖
RUN cd backend && npm install --omit=dev

# 复制全部应用文件（index.html, cards.json, manifest.json, sw.js, backend/…）
COPY . .

EXPOSE 2567

CMD ["node", "backend/server.js"]
