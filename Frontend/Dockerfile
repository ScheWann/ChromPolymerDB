FROM node:23.0.0-slim

WORKDIR /chromosome/frontend

COPY package*.json .
RUN npm install
COPY . .
# RUN npm run build
# RUN npm install -g serve
# EXPOSE 3000
# CMD ["npx", "serve", "-s", "build"]
EXPOSE 3000
CMD ["npm", "start"]
