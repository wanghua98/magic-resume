FROM node:20-alpine

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apk add --no-cache chromium nss freetype harfbuzz font-liberation font-noto font-noto-cjk \
  && mkdir -p /usr/local/share/fonts/magic-resume

WORKDIR /app

COPY pdf-service/package.json ./package.json
RUN npm install --omit=dev --ignore-scripts

COPY pdf-service/server.mjs ./server.mjs
COPY pdf-service/fonts.conf /etc/fonts/local.conf
COPY public/fonts/ /usr/local/share/fonts/magic-resume/
RUN fc-cache -f

USER node

EXPOSE 3333

CMD ["node", "server.mjs"]
