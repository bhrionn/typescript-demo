# Multi-stage Dockerfile for api

# Stage 1: Development
FROM node:25-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]

# Stage 2: Build
FROM node:25-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm install typescript @types/node

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:25-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from build stage
COPY --from=build /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/index.js"]
