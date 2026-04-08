# ── Stage 1: Install deps ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: Production runtime ──────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules     ./node_modules
COPY server.js                         ./server.js
COPY evaluator.js                      ./evaluator.js
COPY package.json                      ./package.json
COPY coding-combat-host.html           ./coding-combat-host.html
COPY coding-combat-player.html         ./coding-combat-player.html
COPY coding-combat-player2.html        ./coding-combat-player2.html

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health > /dev/null || exit 1

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
