#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d "node_modules" ]; then
  echo "Installing backend dependencies..."
  npm install
fi
echo "Starting backend server on port 3000..."
node index.js
