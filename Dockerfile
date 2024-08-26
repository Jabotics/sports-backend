FROM node:20-alpine
WORKDIR /app
COPY package*.json .
COPY tsconfig.json .
RUN npm install
COPY . .
EXPOSE 5050
RUN npm run build
CMD [ "npm", "start" ]
