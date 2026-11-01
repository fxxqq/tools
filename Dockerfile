FROM node:20-alpine

WORKDIR /app

# 只复制运行所需文件，镜像保持极小
COPY server.js ./
COPY index.html 404.html README.md ./
COPY css ./css
COPY js ./js
COPY vendor ./vendor

ENV NODE_ENV=production \
    PORT=3100 \
    HOST=0.0.0.0

EXPOSE 3100

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3100/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
