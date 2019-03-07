
FROM node:current-alpine
RUN apk update && apk upgrade
RUN apk add --no-cache git openssh
WORKDIR /cybersaucier
COPY package*.json ./
RUN npm install
COPY cybersaucier.json ./
COPY *.mjs ./
COPY *.htm ./
EXPOSE 7000
CMD ["node", "--experimental-modules", "main.mjs"]
