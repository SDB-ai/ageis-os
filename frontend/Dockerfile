FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

EXPOSE 3000

ENV REACT_APP_BACKEND_URL=http://localhost:8000

CMD ["npm", "start"]
