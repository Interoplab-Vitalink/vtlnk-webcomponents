# Use an actively supported Node runtime
FROM node:20-alpine

# Create and change to the app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Copy application code (includes postinstall patch script)
COPY . .

# Install dependencies and apply vaccination date-filter patch
RUN npm install

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run the app
CMD ["node", "server.js"]