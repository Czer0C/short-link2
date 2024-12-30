# Use Node.js 20 as the base image
FROM node:20

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json files to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# ENV DATABASE_URL=postgresql://postgres:changeme@postgres:5432/postgres
# ENV NODE_ENV=production

# Expose the port that the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]
