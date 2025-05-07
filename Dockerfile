
FROM node:18.20.4-alpine
RUN apk update && apk upgrade
RUN apk add --no-cache git openssh
WORKDIR /cybersaucier
COPY package*.json ./
COPY *.js ./
RUN npm cache clean --force && npm install
COPY cybersaucier.json ./
COPY *.mjs ./
COPY static/ ./static/
EXPOSE 7000
CMD ["node", "main.mjs"]
