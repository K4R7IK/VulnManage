FROM node:20 AS base

WORKDIR /app

# Install dependencies and build the app
FROM base AS builder
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1

# First compile the worker file as ES module
RUN npx tsc utils/csvProcessWorker.ts --outDir utils --esModuleInterop --module esnext --target es2020 --strict --moduleResolution node && \
    mv utils/csvProcessWorker.js utils/csvProcessWorker.mjs

# Then generate Prisma client and build Next.js app
RUN npx prisma generate && npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create necessary directories with proper permissions
RUN mkdir -p /app/tmp/progress /app/.next /app/prisma /app/utils

# Copy only necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# Copy the compiled worker file
COPY --from=builder /app/utils/csvProcessWorker.mjs ./utils/

# Create a non-root user with a proper home directory
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs --home /app/.next/cache nextjs && \
    mkdir -p /app/.next/cache && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Add Node.js flags for better memory management and garbage collection
ENV NODE_OPTIONS="--expose-gc --max-old-space-size=4096"

CMD sh -c "echo 'Running database migrations...' && \
  npx prisma migrate deploy && \
  if [ \"$SEED_DATABASE\" = \"true\" ]; then \
    echo 'Seeding database...' && \
    npx prisma db seed; \
  fi && \
  echo 'Starting Next.js application...' && \
  node server.js"