#!/bin/bash

# Eck School of Business - Deployment Script
echo "🎓 Deploying Eck School of Business platform..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Docker
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check Docker Compose
if command_exists docker-compose; then
    COMPOSE_CMD="docker-compose"
elif docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Run setup if .env files don't exist
if [ ! -f "backend/.env" ] || [ ! -f ".env" ]; then
    echo "🔧 Running initial setup..."
    chmod +x setup.sh
    ./setup.sh
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
$COMPOSE_CMD down

# Build and start services
echo "🏗️  Building and starting services..."
$COMPOSE_CMD up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."

# Check PostgreSQL
if ! $COMPOSE_CMD exec postgres pg_isready -U eck_user -d eck_school_db > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not ready"
    $COMPOSE_CMD logs postgres
    exit 1
fi

# Run database migrations and seed
echo "🗄️  Setting up database..."
$COMPOSE_CMD exec backend npx prisma migrate deploy
$COMPOSE_CMD exec backend npx prisma db seed

# Check backend health
echo "🔍 Checking backend health..."
if ! curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "❌ Backend is not responding"
    $COMPOSE_CMD logs backend
    exit 1
fi

# Check frontend health
echo "🔍 Checking frontend health..."
if ! curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ Frontend is not responding"
    $COMPOSE_CMD logs frontend
    exit 1
fi

echo ""
echo "🎉 Deployment successful!"
echo ""
echo "📚 Eck School of Business is now running:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Admin:    admin@eckschool.com / admin123"
echo ""
echo "📊 Management commands:"
echo "   View logs:    $COMPOSE_CMD logs -f"
echo "   Stop:         $COMPOSE_CMD down"
echo "   Restart:      $COMPOSE_CMD restart"
echo "   Status:       $COMPOSE_CMD ps"
echo ""
