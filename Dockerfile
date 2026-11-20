# 3C Cloud Hub — Production Container Image (Cloud Run / Docker)
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* bun.lock* ./
COPY packages ./packages
COPY apps ./apps
COPY servers ./servers
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --no-audit --no-fund --ignore-scripts; fi

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/servers ./servers
COPY --from=builder /app/infrastructure ./infrastructure
COPY --from=builder /app/supabase ./supabase
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npx", "tsx", "server.ts"]
