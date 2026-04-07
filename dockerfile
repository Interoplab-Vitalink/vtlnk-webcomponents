# Use an actively supported Node runtime
FROM node:20-alpine

# Create and change to the app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run the app
CMD ["node", "server.js"]