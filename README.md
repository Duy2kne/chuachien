# 🪷 Chùa Online 3D - Không Gian Viếng Chùa & Thiền Định Trực Tuyến Đa Người Chơi

> Website viếng chùa 3D trực tuyến nhiều người cùng lúc theo thời gian thực (Realtime Multiplayer).
> Người dùng tự do đặt tên/pháp danh, chọn áo tràng, chiêm bái khuôn viên chùa Việt Nam, thắp hương, dâng hoa, lạy Phật, thả đèn hoa đăng và thỉnh chuông trong thanh âm thiền tịnh.

---

## 🌟 Tính Năng Nổi Bật

1. **Không gian 3D chùa Việt Nam thuần chất**:
   - **Cổng tam quan** cổ kính với hoành phi *"TÂM AN TỰ"*.
   - **Đường lát đá granite** với hai hàng **đèn đá** phát sáng lung linh trong đêm.
   - **Sân chùa lát gạch gốm đỏ** nung cùng **Lư hương đồng lớn** tỏa khói hương nghi ngút.
   - **Chính điện (Đại Hùng Bảo Điện)** mái 2 tầng cong vút, đầu đao uốn lượn, cột sơn son thếp vàng, tượng **Đức Phật Thích Ca Mâu Ni** mạ vàng ngự trên đài sen cùng bàn thờ trang nghiêm.
   - **Lầu Chuông** với Đại Hồng Chung bằng đồng và chày gỗ đung đưa khi thỉnh.
   - **Lầu Trống** với Trống Bát Nhã trầm hùng.
   - **Hồ sen biếc** với lá sen, hoa sen hồng nở, tượng **Bồ Tát Quán Thế Âm** bạch ngọc giữa hồ.
   - **Cây Bồ Đề** cổ thụ rễ buông rủ cùng vòng ghế đá ngồi thiền thanh tịnh.
   - Hiệu ứng cánh hoa sen rơi, ánh nến lung linh, đom đóm lập lòe bên hồ, chế độ **Ngày / Đêm**.

2. **Đa người chơi thời gian thực (Socket.IO 4)**:
   - Thấy nhau đi lại mượt mà, tên hiển thị trên đầu nhân vật chibi dễ thương.
   - Trò chuyện với **bong bóng lời nói (speech bubble)** nổi trên đầu và các câu niệm Phật nhanh.
   - Tự động mở phòng mới khi phòng đầy (mặc định 50 người/phòng).
   - Đổi phòng trực tiếp trong HUD mà không cần tải lại trang.

3. **10 Hành động chiêm bái có tích lũy Công đức**:
   - 🙏 **Chắp tay**: Chắp hai tay trước ngực niệm Phật (+1 công đức).
   - 🙇 **Lạy Phật**: Quỳ lạy 3 lần trước tượng Phật (+3 công đức).
   - 🪔 **Thắp hương**: Cầm 3 nén hương vái trán, nén hương xuất hiện trong lư đồng cho cả phòng cùng thấy (+5 công đức).
   - 🪷 **Dâng hoa**: Dâng hoa sen tươi lên bàn thờ Phật (+5 công đức).
   - 🪵 **Gõ mõ**: Ngồi gõ mõ đều nhịp với âm thanh "cốc cốc" ấm áp (+2 công đức).
   - 🧘 **Ngồi thiền**: Ngồi kiết già tịnh tâm với vòng hào quang phát sáng (+3 công đức).
   - 🔔 **Thỉnh chuông**: Kéo chày gõ chuông, tiếng chuông đồng rền ngân 10 giây cho cả phòng (+3 công đức).
   - 🥁 **Đánh trống**: Đánh 3 tiếng trống Bát Nhã trầm vang (+3 công đức).
   - 🏮 **Thả đèn hoa đăng**: Nhập tâm nguyện cầu an/cầu siêu, thả đèn hoa đăng trôi trên hồ sen (+5 công đức). Người khác có thể bấm vào đèn để xem lời nguyện.
   - 👋 **Vẫy chào**: Vẫy tay chào đại chúng.

4. **Thanh âm thiền tịnh (Web Audio API)**:
   - Nhạc thiền ngũ cung tổng hợp không bản quyền: Drone trầm ấm, sáo trúc ngân vang, đàn tranh gảy thánh thót và tiếng chuông xoay.
   - Hiệu ứng âm thanh procedural: Đại hồng chung nhiều bồi âm ngân dài, mõ gỗ rỗng, trống bát nhã, khánh đồng.
   - Tự do tinh chỉnh âm lượng nhạc nền và âm lượng hiệu ứng riêng biệt.

---

## 🚀 Hướng Dẫn Chạy Tại Máy Cục Bộ (Local)

### Yêu cầu:
- Node.js version 20 trở lên.
- npm version 9 trở lên.

### Các bước khởi động:
```bash
# 1. Cài đặt các gói thư viện
npm ci

# 2. Chạy chế độ phát triển (Development)
npm run dev

# Mở trình duyệt truy cập: http://localhost:3000
```

### Đóng gói và chạy thử Production:
```bash
# Đóng gói giao diện và server
npm run build

# Khởi động máy chủ Production
npm start

# Kiểm tra trạng thái hoạt động
curl http://localhost:3000/health
```

---

## 📦 Đưa Mã Nguồn Lên GitHub

1. Tạo một repository mới trên GitHub (ví dụ: `chua-online-3d`).
2. Khởi tạo Git và đẩy toàn bộ mã nguồn lên:
```bash
git init
git add .
git commit -m "Phát tâm khởi tạo Chùa Online 3D"
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/chua-online-3d.git
git push -u origin main
```
*Lưu ý:* File `package-lock.json` bắt buộc đã được commit lên Git để quy trình GitHub Actions chạy lệnh `npm ci` thành công.

---

## ☁️ Triển Khai Lên Render (Khuyên Dùng - Miễn Phí)

Render hỗ trợ WebSocket lâu dài và tương thích hoàn hảo với file cấu hình `render.yaml` đính kèm trong dự án.

### Bước 1: Kết nối Repo với Render
1. Đăng nhập vào [Render.com](https://render.com).
2. Chọn **New +** → Chọn **Blueprint**.
3. Kết nối với GitHub repository `chua-online-3d` bạn vừa tạo.
4. Render sẽ tự động đọc file `render.yaml` để thiết lập cấu hình dịch vụ.

### Bước 2: Thiết lập Tự Động Triển Khai qua GitHub Actions
1. Trên bảng điều khiển của dịch vụ Render vừa tạo, vào tab **Settings**.
2. Cuộn xuống phần **Deploy Hook**, bấm **Create Deploy Hook** và sao chép URL hook đó.
3. Quay trở lại GitHub: Vào repository của bạn → **Settings** → **Secrets and variables** → **Actions** → Chọn **New repository secret**.
4. Tạo secret tên: `RENDER_DEPLOY_HOOK_URL` và dán URL hook vừa copy vào.
5. Tạo thêm secret (tùy chọn): `APP_URL` với giá trị là link trang web Render của bạn (ví dụ: `https://chua-online-3d.onrender.com`).

Từ nay, mỗi khi bạn push code lên nhánh `main`, GitHub Actions sẽ tự động kiểm tra cú pháp, build và kích hoạt Render cập nhật phiên bản mới nhất!

---

## 🖥️ Triển Khai Lên Máy Chủ Riêng (VPS Ubuntu)

### Bước 1: Cài đặt môi trường trên VPS
```bash
# Cập nhật hệ thống và cài đặt Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

# Cài đặt PM2 để quản lý tiến trình nền
sudo npm install -g pm2
```

### Bước 2: Tải code và khởi chạy với PM2
```bash
cd /var/www
git clone https://github.com/<tai-khoan-cua-ban>/chua-online-3d.git
cd chua-online-3d

npm ci
npm run build

# Khởi chạy bằng PM2
pm2 start server.js --name "chua-online"
pm2 save
pm2 startup
```

### Bước 3: Cấu hình Nginx Reverse Proxy hỗ trợ WebSocket
Tạo file cấu hình `/etc/nginx/sites-available/chua-online`:
```nginx
server {
    listen 80;
    server_name yourdomain.com; # Thay bằng tên miền của bạn

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Bắt buộc cho Socket.IO / WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```
Kích hoạt trang và cấp chứng chỉ SSL miễn phí bằng Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/chua-online /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Cài đặt HTTPS
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🐳 Triển Khai Bằng Docker

Dự án có sẵn `Dockerfile` multi-stage tối ưu:

```bash
# Build image Docker
docker build -t chua-online-3d .

# Chạy container trên cổng 3000
docker run -d --name chua-online -p 3000:3000 --restart always chua-online-3d

# Kiểm tra container đang chạy
docker ps
```

---

## 🎵 Bổ Sung Nhạc Vào Chùa

Thư mục `public/music/` được cấu hình để tự động quét danh sách nhạc khi khởi động:
- Bạn có thể đặt các file nhạc thiền hoặc bài tụng kinh có định dạng `.mp3` hoặc `.ogg` vào thư mục `public/music/`.
- Khi người dùng bấm vào biểu tượng 🎵, danh sách bài hát sẽ tự động hiển thị trong menu để lựa chọn.
- *Lưu ý:* Chỉ sử dụng các bản nhạc đã được cấp phép hoặc thuộc phạm vi công cộng.

---

## ☸️ Cấu Trúc Dự Án

```
chua-online/
├── .github/workflows/
│   ├── ci.yml               # Kiểm tra lỗi & smoke test tự động
│   └── deploy.yml           # Triển khai tự động lên Render / VPS
├── data/
│   ├── stats.json           # Dữ liệu công đức & lượt viếng
│   └── .gitkeep
├── src/
│   ├── audio/
│   │   └── soundEngine.ts   # Bộ tổng hợp âm thanh thiền Web Audio API
│   ├── components/
│   │   ├── ActionBar.tsx    # Thanh 10 hành động chiêm bái
│   │   ├── ChatPanel.tsx    # Khung đàm thoại & câu niệm Phật
│   │   ├── EntranceScreen.tsx# Chọn nhân vật, màu áo, phòng
│   │   ├── RoomModal.tsx    # Chuyển phòng & danh sách phật tử
│   │   ├── LanternDialog.tsx# Nguyện ước & chiêm bái hoa đăng
│   │   ├── VirtualJoystick.tsx # Cần điều khiển cảm ứng điện thoại
│   │   └── AudioSettingsModal.tsx
│   ├── scene/
│   │   ├── templeWorld.ts   # Dựng khuôn viên 3D chùa Việt Nam
│   │   ├── playerAvatar.ts  # Mô hình chibi & hoạt ảnh nội suy
│   │   └── proceduralTextures.ts # Texture gạch, ngói, gỗ, hoành phi
│   ├── network/
│   │   └── networkClient.ts # Kết nối Socket.IO client
│   ├── server/
│   │   └── profanity.ts     # Lọc từ ngữ thanh tịnh
│   ├── types.ts             # Kiểu dữ liệu toàn hệ thống
│   ├── App.tsx              # Component trung tâm ứng dụng
│   ├── index.css            # Tailwind CSS & Typography
│   └── main.tsx
├── server.ts                # Máy chủ Express & Socket.IO 4
├── build.mjs                # Script đóng gói bằng esbuild
├── Dockerfile               # Docker multi-stage container
├── render.yaml              # Cấu hình Render Cloud Blueprint
└── package.json
```

---

## 🕊️ Lời Kết

Kính chúc quý Phật tử cùng đại chúng viếng chùa an lạc, thân tâm thường tịnh, phước huệ trang nghiêm! 🙏
