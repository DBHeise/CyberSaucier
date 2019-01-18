
FROM node:current-alpine
RUN apk update && apk upgrade
RUN apk add --no-cache git openssh
WORKDIR /cybersaucier
COPY *.json ./
RUN npm install
COPY *.mjs ./
COPY *.htm ./
EXPOSE 7000
CMD ["node", "--experimental-modules", "index.mjs"]
