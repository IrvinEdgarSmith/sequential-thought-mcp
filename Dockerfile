FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Create production image
FROM node:20-alpine

WORKDIR /app

# Only copy production dependencies and compiled output
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Install supergateway globally in the production image
RUN npm install -g supergateway

EXPOSE 8000

# Wrap the stdio MCP server in Supergateway to expose it as an SSE HTTP endpoint
ENTRYPOINT ["npx", "-y", "supergateway", "--stdio", "node dist/index.js", "--port", "8000"]
