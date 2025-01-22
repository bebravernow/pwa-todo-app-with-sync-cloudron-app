#!/bin/bash

# Set environment variables
export PORT=3000
export NODE_ENV=production

# Create data directory if it doesn't exist
mkdir -p /app/data/todos-db

# Start the application
exec node server.js