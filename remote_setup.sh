#!/bin/bash
set -e

echo "Updating system..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release nginx

echo "Installing Docker..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "Extracting backend..."
tar -xzf backend.tar.gz
cd sneral_backend

echo "Preparing environment..."
cp .env.example .env
sed -i 's/NODE_ENV=.*/NODE_ENV=production/' .env
sed -i 's/DATABASE_URL=.*/DATABASE_URL="postgresql:\/\/postgres:postgres@db:5432\/snearal?schema=public"/' .env
sed -i 's/REDIS_HOST=.*/REDIS_HOST=redis/' .env

echo "Starting Docker containers..."
sudo docker compose up -d --build

echo "Done!"
