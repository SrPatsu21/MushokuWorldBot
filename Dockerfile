# ==========================================
# 1: BUILD
# ==========================================
FROM oven/bun:1-alpine AS build

WORKDIR /app

ENV BUN_INSTALL_NO_SCRIPTS=1

COPY package.json ./

RUN bun install --ignore-scripts

COPY . .

ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN bunx prisma generate

# ==========================================
# 2: RUN
# ==========================================
FROM oven/bun:1-alpine AS run

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src

CMD ["sh", "-c", "export DATABASE_URL=\"postgresql://${POSTGRES_USER}:$(cat /run/secrets/db_password)@${DB_HOST}:${DB_PORT}/${DB_NAME}\" && bunx prisma db push && bun run src/index.ts"]