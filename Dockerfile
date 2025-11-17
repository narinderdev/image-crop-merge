ARG FRONTEND_BUILD_SCRIPT=build
ARG APP_ENV=production

# -----------------------------
# Client builder (React/Vite)
# -----------------------------
FROM node:20-alpine AS client-builder

WORKDIR /app/client
ENV HUSKY=0

# Install client deps
COPY client/package*.json ./
RUN npm install

# Copy client source and build
COPY client ./
ARG FRONTEND_BUILD_SCRIPT
RUN npm run ${FRONTEND_BUILD_SCRIPT}

# -----------------------------
# Server dependencies
# -----------------------------
FROM node:20-alpine AS server-deps

RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
ENV HUSKY=0

# Install server deps (prod only)
COPY server/package*.json ./
RUN npm install --omit=dev

# -----------------------------
# Final runtime image
# -----------------------------
FROM node:20-alpine

RUN apk add --no-cache libc6-compat
WORKDIR /srv

# Environment
ARG APP_ENV
ENV NODE_ENV=staging
ENV APP_ENV=${APP_ENV}
ENV HOST=0.0.0.0
ENV PORT=8080

# Copy server runtime
COPY --from=server-deps /app/node_modules ./node_modules
COPY server ./

# Copy client build output (optional static hosting)
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 8080

# Start server
CMD ["node", "index.js"]
