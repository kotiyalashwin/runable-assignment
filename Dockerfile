# Use minimal Node image
FROM node:24-slim

# Install dependencies for Bun
RUN apt-get update && \
    apt-get install -y curl ca-certificates git unzip && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Bun (latest stable)
RUN curl -fsSL https://bun.sh/install | bash

# Add Bun to PATH
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

# Copy package.json / package-lock.json (optional if using npm)
COPY package.json bun.lock ./

# Install npm dependencies if any
RUN bun install

# Copy source code
COPY . .

# Expose Bun server port
EXPOSE 3000

# Start Bun server
CMD ["bun", "run", "index.ts"]
