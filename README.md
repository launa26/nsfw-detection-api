# NSFW Detection API

  Node.js API server phát hiện nội dung nude/NSFW sử dụng `nsfwjs` (MobileNetV2). Dùng cho bot Discord, Telegram...

  ## Deploy lên Render

  1. Fork/clone repo này về GitHub của bạn
  2. Vào [render.com](https://render.com) → New → Web Service
  3. Connect GitHub repo `nsfw-detection-api`
  4. Render tự detect `render.yaml` và cấu hình sẵn
  5. Click **Deploy**

  ---

  ## API Endpoints

  ### Base URL (Render)
  ```
  https://nsfw-detection-api.onrender.com
  ```

  ---

  ### ✅ Health Check
  ```http
  GET /api/healthz
  ```
  **Response:**
  ```json
  { "status": "ok" }
  ```

  ---

  ### 🔍 Check ảnh từ URL
  ```http
  POST /api/nsfw/check-url
  Content-Type: application/json
  ```
  **Body:**
  ```json
  {
    "url": "https://example.com/image.jpg",
    "threshold": 0.6
  }
  ```
  - `url` (bắt buộc): Link ảnh cần kiểm tra
  - `threshold` (tuỳ chọn, 0-1, mặc định 0.6): Ngưỡng để xác định NSFW

  ---

  ### 📤 Check ảnh upload
  ```http
  POST /api/nsfw/check-file
  Content-Type: multipart/form-data
  ```
  **Form fields:**
  - `image` (bắt buộc): File ảnh (JPG, PNG, GIF, WebP, tối đa 20MB)
  - `threshold` (tuỳ chọn): Ngưỡng 0-1

  ---

  ### 📊 Response
  Cả hai endpoint đều trả về cùng format:
  ```json
  {
    "isNsfw": false,
    "score": 0.018,
    "category": "Neutral",
    "predictions": [
      { "className": "Neutral",  "probability": 0.5002 },
      { "className": "Drawing",  "probability": 0.4818 },
      { "className": "Hentai",   "probability": 0.0136 },
      { "className": "Porn",     "probability": 0.0024 },
      { "className": "Sexy",     "probability": 0.0019 }
    ],
    "threshold": 0.6
  }
  ```

  | Field | Ý nghĩa |
  |-------|---------|
  | `isNsfw` | `true` nếu ảnh có nội dung NSFW |
  | `score` | Tổng điểm NSFW (0-1) |
  | `category` | Phân loại chính xác nhất |
  | `predictions` | Chi tiết tất cả 5 loại |
  | `threshold` | Ngưỡng đã dùng |

  **Các category:**
  - `Neutral` — Ảnh bình thường
  - `Drawing` — Tranh/hình vẽ
  - `Porn` — Nội dung khiêu dâm
  - `Hentai` — Anime/hentai
  - `Sexy` — Gợi cảm (không explicit)

  ---

  ## Dùng với bot Discord/Telegram (ví dụ)

  ```js
  const res = await fetch('https://nsfw-detection-api.onrender.com/api/nsfw/check-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: imageUrl, threshold: 0.6 })
  });
  const data = await res.json();

  if (data.isNsfw) {
    // Xoá ảnh / cảnh báo user
    console.log(`NSFW detected! Score: ${data.score}, Category: ${data.category}`);
  }
  ```

  ---

  ## Cài local

  ```bash
  # Yêu cầu: Node.js >= 20, pnpm
  pnpm install
  pnpm --filter @workspace/api-server run dev
  ```

  Server chạy tại `http://localhost:8080`

  ---

  ## Tech Stack

  - **Runtime**: Node.js 24
  - **Framework**: Express 5
  - **AI Model**: nsfwjs (MobileNetV2)
  - **TensorFlow**: @tensorflow/tfjs (CPU)
  - **Image processing**: Jimp
  - **Build**: esbuild
  