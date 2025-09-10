FROM node:18

# Set working directory
WORKDIR /app

# Create /tmp/log with full write permission
RUN mkdir -p /tmp/log && chmod -R 777 /tmp/log
# Copy package.json and package-lock.json
COPY package.json . 

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Install pm2 globally to manage the application
RUN npm install pm2 -g

# Run the application using pm2
CMD ["pm2-runtime", "dist/index.js"]

# Expose the port
EXPOSE 3000
