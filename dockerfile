
FROM node:current-alpine

WORKDIR /cybersaucier
COPY package*.json ./
RUN npm install
COPY *.mjs ./
COPY *.htm ./
EXPOSE 7000
CMD ["node", "--experimental-modules", "index.mjs"]
