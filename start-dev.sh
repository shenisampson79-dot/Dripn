#!/bin/bash
echo "Starting Dripn development environment..."

echo "Starting backend server on port 5000..."
cd backend-code && PORT=5000 node index.js &
BACKEND_PID=$!
cd ..

sleep 2

echo "Backend started (PID: $BACKEND_PID)"

echo "Starting Expo Metro bundler..."
EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN npx expo start --port 8081

wait
