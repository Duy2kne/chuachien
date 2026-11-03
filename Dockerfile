# Stage 1: Build ứng dụng
FROM node:20-alpine AS builder

WORKDIR /app

# Sao chép package.json và package-lock.json để cache layer npm
COPY package*.json ./

RUN npm ci

# Sao chép toàn bộ mã nguồn
COPY . .

# Build Vite client và esbuild server
RUN npm run build

# Stage 2: Runtime image tối ưu, gọn nhẹ và bảo mật
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Chỉ cài đặt dependencies production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Sao chép thành phẩm build từ builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/data ./data
COPY --from=builder /app/public ./public

# Tạo thư mục dữ liệu với quyền ghi cho user non-root
RUN chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
