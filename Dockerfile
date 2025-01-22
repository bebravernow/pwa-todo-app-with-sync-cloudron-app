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

# Install dos2unix
RUN apk add --no-cache dos2unix

# Ensure script has correct line endings and is executable
RUN dos2unix start.sh && \
    chmod +x start.sh

# Create data directory
RUN mkdir -p /app/data

# Create user and set permissions
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app/data && \
    chmod 755 /app/data

USER appuser

EXPOSE 3000
CMD ["/bin/sh", "/app/start.sh"]