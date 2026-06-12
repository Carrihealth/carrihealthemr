# ── Stage 1: build the React frontend ──────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: production Node/Express backend ────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Install production backend deps only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built React app into backend/public so Express can serve it
COPY --from=frontend-build /build/dist ./public

# Fly.io injects PORT=8080 via env; server.js reads process.env.PORT
EXPOSE 8080

CMD ["node", "server.js"]
