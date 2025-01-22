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

# Create data directory with correct permissions
RUN mkdir -p /app/data && \
    chown -R 1000:1000 /app/data && \
    chmod 755 /app/data

# Create a non-root user with specific UID/GID
RUN addgroup -g 1000 -S appgroup && \
    adduser -u 1000 -S appuser -G appgroup

USER appuser

EXPOSE 3000
CMD ["/bin/sh", "/app/start.sh"]