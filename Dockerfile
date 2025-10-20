# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund

# Copy the rest of the app
COPY . .
# Drop npm cache to keep image slim
RUN npm cache clean --force

ENV NODE_ENV=production
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
