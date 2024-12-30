FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
# Use environment variable for port with a default value
EXPOSE ${SERVICE_PORT}
CMD ["node", "index.js"]
