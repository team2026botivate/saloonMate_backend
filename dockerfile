# ---------- Builder stage ----------
FROM node:20-alpine AS builder

# If your dependencies need native builds (rare here), uncomment the next line:
# RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and tsconfig first to leverage Docker cache
COPY package.json package-lock.json* tsconfig.json ./

# Install all deps (dev + prod) so tsc and any build-time tools work
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove devDeps to keep node_modules production-only
RUN npm prune --production

# ---------- Runner stage ----------
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Create non-root user for safety
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only production artifacts from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Adjust ownership and switch to non-root user
RUN chown -R appuser:appgroup /app
USER appuser


# Start your app (matches "start" in package.json)
CMD ["node", "dist/app.js"]
