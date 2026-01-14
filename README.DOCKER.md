# Docker Setup for SaloonMate Backend

This guide will help you run the SaloonMate Backend using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose installed (usually comes with Docker Desktop)

## Quick Start

1. **Create a `.env` file** (copy from `.env.example` and fill in your values):
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your actual configuration values.

2. **Build and run using Docker Compose**:
   ```bash
   docker-compose up -d
   ```

3. **View logs**:
   ```bash
   docker-compose logs -f
   ```

4. **Stop the container**:
   ```bash
   docker-compose down
   ```

## Alternative: Using Docker directly

1. **Build the Docker image**:
   ```bash
   docker build -t saloonmate-backend -f dockerfile .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name saloonmate-backend \
     -p 3002:3002 \
     --env-file .env \
     saloonmate-backend
   ```

3. **View logs**:
   ```bash
   docker logs -f saloonmate-backend
   ```

4. **Stop the container**:
   ```bash
   docker stop saloonmate-backend
   docker rm saloonmate-backend
   ```

## Environment Variables

Make sure to set all required environment variables in your `.env` file. See `.env.example` for reference.

## Port Configuration

The backend runs on port `3002` by default. You can change this by:
- Setting `PORT` in your `.env` file
- Updating the port mapping in `docker-compose.yml` (e.g., `"8080:3002"` to expose on port 8080)

## Troubleshooting

- **Container won't start**: Check logs with `docker-compose logs` or `docker logs saloonmate-backend`
- **Port already in use**: Change the port mapping in `docker-compose.yml` or stop the service using port 3002
- **Environment variables not loading**: Ensure `.env` file exists and is in the project root
