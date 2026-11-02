FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
# DATA_DIR não é fixado: no Railway o volume é detectado por RAILWAY_VOLUME_MOUNT_PATH.
# PORT é injetada pelo Railway; 3000 é apenas o padrão para docker run local.
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts/start.mjs ./scripts/start.mjs
COPY --from=builder /app/lib/persistence.mjs ./lib/persistence.mjs
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
