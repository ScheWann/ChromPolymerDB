FROM node:23.0.0-slim

WORKDIR /chromosome/frontend

COPY package*.json .
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
