FROM node:22-alpine

WORKDIR /app

# Copy root package files and install
COPY package.json package-lock.json ./
RUN npm ci

# Copy everything
COPY . .

# Pass Vite env vars as build args (Railway injects env vars as build args automatically)
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Build the frontend (creates dist/)
RUN npm run build

# Install API dependencies
WORKDIR /app/api
RUN npm ci

# Copy dist into api/dist so server can find it
RUN cp -r /app/dist /app/api/dist

# Verify dist exists
RUN ls -la /app/dist/index.html && ls -la /app/api/dist/index.html && echo "DIST OK"

WORKDIR /app

EXPOSE 3001

CMD ["node", "api/server.js"]
