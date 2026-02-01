FROM node:22-alpine

WORKDIR /app

# Copy root package files and install
COPY package.json package-lock.json ./
RUN npm ci

# Copy everything
COPY . .

# Build the frontend (creates dist/)
RUN npm run build

# Install API dependencies
WORKDIR /app/api
RUN npm ci

# Copy dist into api/dist so server can find it
RUN cp -r /app/dist /app/api/dist

WORKDIR /app

EXPOSE 3001

CMD ["node", "api/server.js"]
