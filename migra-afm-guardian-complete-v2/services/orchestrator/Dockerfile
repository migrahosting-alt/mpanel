FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install && npx tsc || true
EXPOSE 8090
CMD ["node","dist/index.js"]
