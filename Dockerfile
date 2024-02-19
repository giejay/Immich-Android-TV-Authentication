FROM node:20.11-alpine

RUN mkdir /app

WORKDIR /app

COPY . ./

RUN npm install

EXPOSE 5000

CMD [ "node", "app.js" ]