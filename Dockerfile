FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
COPY server.js .
COPY start.sh .

# Ensure script has correct line endings and is executable
RUN dos2unix start.sh && \
    chmod +x start.sh

# Create data directory
RUN mkdir -p /app/data/todos-db

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000
CMD ["/bin/sh", "/app/start.sh"]