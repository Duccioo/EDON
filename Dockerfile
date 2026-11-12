FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
LABEL org.opencontainers.image.title="EDON" \
      org.opencontainers.image.description="Private local-first desktop made of tiles" \
      org.opencontainers.image.source="https://github.com/Duccioo/EDON" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATA_DIR=/app/data
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/packages ./packages
USER node
EXPOSE 3001
VOLUME /app/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT??3001}/api/auth`).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "--import", "tsx", "apps/server/src/index.ts"]
