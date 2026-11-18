# Lightweight Node.js LTS image
FROM node:20-alpine

# Working directory
WORKDIR /app

# Copy dependencies definitions
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy source code and static assets
COPY . .

# Expose default port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["node", "server/index.js"]
