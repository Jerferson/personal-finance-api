FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build
RUN npx tsc prisma/seed.ts --outDir dist --module commonjs --target ES2020 --esModuleInterop --moduleResolution node --skipLibCheck --resolveJsonModule

# ── Production image ──────────────────────────────────────────────────────────
FROM node:24-alpine AS production

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN apk add --no-cache openssl && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed.js && node dist/src/main"]
