FROM oven/bun:1.3.14-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 bunjs && \
    adduser --system --uid 1001 bunjs

COPY --chown=bunjs:bunjs backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --chown=bunjs:bunjs backend/ ./

RUN mkdir -p /app/uploads && \
    chown -R bunjs:bunjs /app/uploads && \
    chmod +x /app/docker-entrypoint.sh

USER bunjs

EXPOSE 3001

ENV NODE_ENV=production \
    PORT=3001 \
    LOG_PRETTY=false

CMD ["./docker-entrypoint.sh"]
