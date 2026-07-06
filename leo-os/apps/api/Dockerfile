FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/db ./packages/db
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @leo/api run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/db/node_modules ./packages/db/node_modules
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
