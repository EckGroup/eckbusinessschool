#!/bin/bash

# Eck School of Business - Setup Script
echo "🎓 Setting up Eck School of Business platform..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    echo "❌ Docker Compose is not available. Please install Docker Compose and try again."
    exit 1
fi

# Create .env files if they don't exist
echo "📝 Creating environment files..."

# Backend .env
cat > backend/.env << EOF
# Database
DATABASE_URL=postgresql://eck_user:secure_password_123@postgres:5432/eck_school_db

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_secure_$(date +%s)
JWT_EXPIRES_IN=7d

# Server
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:3000

# WhatsApp (optional)
WHATSAPP_PHONE=05741768196

# File uploads
MAX_FILE_SIZE=5000000
UPLOAD_PATH=./uploads

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
EOF

# Frontend .env
cat > .env << EOF
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=Eck School of Business
VITE_WHATSAPP_PHONE=05741768196
EOF

echo "✅ Environment files created successfully!"

# Create uploads directory
mkdir -p backend/uploads

echo "🚀 Setup complete! Run ./deploy.sh to start the application."
