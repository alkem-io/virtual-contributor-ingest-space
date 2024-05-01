FROM node:21.7.3-alpine3.18

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY src/ ./src
COPY tsconfig* ./

RUN npm run build

CMD [ "npm", "run", "start"]

