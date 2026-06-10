# ==============================================================================
# HostPanel Backend — Node.js/Express API
# nsenter (util-linux) host systemd servislerine erişim için gereklidir; container
# docker-compose'da `privileged: true` + `pid: host` ile çalışır.
# ==============================================================================
FROM node:20-alpine

WORKDIR /usr/src/app

# openssl: Prisma + sertifika işlemleri | util-linux: tam nsenter (host servis yönetimi)
RUN apk add --no-cache openssl util-linux

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 4000
CMD ["node", "src/server.js"]
