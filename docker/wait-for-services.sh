#!/bin/bash

# Script to wait for all Docker services to be healthy

echo "Waiting for services to be ready..."

# Function to check service health
check_service() {
    local service=$1
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        status=$(docker-compose ps -q $service | xargs docker inspect -f '{{.State.Health.Status}}' 2>/dev/null)
        
        if [ "$status" = "healthy" ]; then
            echo "✓ $service is healthy"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "  Waiting for $service... ($attempt/$max_attempts)"
        sleep 2
    done
    
    echo "✗ $service failed to become healthy"
    return 1
}

# Check each service
check_service postgres
check_service localstack

# Check if web and api are running (they don't have health checks)
if docker-compose ps web | grep -q "Up"; then
    echo "✓ web is running"
else
    echo "✗ web is not running"
    exit 1
fi

if docker-compose ps api | grep -q "Up"; then
    echo "✓ api is running"
else
    echo "✗ api is not running"
    exit 1
fi

echo ""
echo "All services are ready!"
echo ""
echo "Access the application:"
echo "  Web:        http://localhost:3000"
echo "  API:        http://localhost:4000"
echo "  PostgreSQL: localhost:5432"
echo "  LocalStack: http://localhost:4566"
echo ""
echo "Test credentials:"
echo "  Email:    test@example.com"
echo "  Password: TestPass123!"
