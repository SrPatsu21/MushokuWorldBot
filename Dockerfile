# ==========================================
# 1: BUILD
# ==========================================
FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

COPY . .

# ==========================================
# 2: RUN
# ==========================================
FROM oven/bun:1-alpine AS run

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/src ./src

USER bun

CMD ["bun", "run", "src/index.ts"]