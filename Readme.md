# 🛒 Backend E-Commerce Shop API

Hệ thống Backend RESTful API hoàn chỉnh cho nền tảng thương mại điện tử (E-Commerce), được xây dựng trên nền tảng **Node.js**, **Express 5**, **TypeScript**, **MongoDB (Mongoose)** và **Redis**.

Hệ thống hỗ trợ toàn diện các nghiệp vụ bán hàng: Quản lý sản phẩm biến thể đa cấp (Product Variants/Options), kiểm soát tồn kho (Inventory Logs), giỏ hàng thông minh (Guest & User Cart), đặt hàng tự động trừ kho (Order State Machine), và cổng thanh toán đa phương thức (COD, VNPay, MoMo).

---

## 📑 Mục lục

- [1. Công nghệ sử dụng](#1-công-nghệ-sử-dụng)
- [2. Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
- [3. Hướng dẫn cài đặt & Khởi chạy](#3-hướng-dẫn-cài-đặt--khởi-chạy)
- [4. Biến môi trường (.env)](#4-biến-môi-trường-env)
- [5. Chi tiết các Module & Logic nghiệp vụ](#5-chi-tiết-các-module--logic-nghiệp-vụ)
  - [5.1. Authentication & User](#51-authentication--user-auth)
  - [5.2. Product, Option & Variant](#52-product-option--variant-product)
  - [5.3. Category](#53-category-category)
  - [5.4. Inventory Management](#54-inventory-management-inventory)
  - [5.5. Cart](#55-cart-cart)
  - [5.6. Order & State Machine](#56-order--state-machine-order)
  - [5.7. Payment & Gateways](#57-payment--gateways-payment)
- [6. Bảng danh mục API (API Reference)](#6-bảng-danh-mục-api-api-reference)
- [7. Chuẩn hoá Response & Xử lý lỗi](#7-chuẩn-hoá-response--xử-lý-lỗi)
- [8. Kiểm thử (Testing)](#8-kiểm-thử-testing)

---

## 1. Công nghệ sử dụng

| Công nghệ | Vai trò / Mục đích |
| :--- | :--- |
| **Node.js (>= 18)** & **TypeScript** | Ngôn ngữ & runtime định kiểu an toàn, hiện đại |
| **Express 5** | Web framework xử lý định tuyến và middleware |
| **MongoDB & Mongoose 9** | Cơ sở dữ liệu NoSQL chính, mô hình hoá quan hệ và Transaction |
| **Redis (ioredis)** | Caching dữ liệu sản phẩm, phân trang, phiên làm việc (in-memory fallback) |
| **Zod** | Validation dữ liệu đầu vào (Request body, params, query) ở tầng middleware |
| **JWT & Bcrypt** | Xác thực phân quyền, Access Token & Refresh Token, bảo mật mật khẩu |
| **Cloudinary & Multer** | Lưu trữ và xử lý tối ưu hình ảnh sản phẩm trên cloud |
| **Vitest** | Framework kiểm thử Unit Test tốc độ cao |

---

## 2. Cấu trúc thư mục

```
Backend-shop/
├── src/
│   ├── app.ts                         # Cấu hình Express app, middlewares chung, CORS, Helmet
│   ├── server.ts                      # Khởi chạy HTTP server & kết nối Database
│   ├── common/                        # Tiện ích dùng chung
│   │   ├── api.responsitory.ts        # Helper ApiResponse chuẩn hoá dữ liệu trả về
│   │   ├── appError.ts                # Custom Exception AppError định danh mã lỗi & HTTP status
│   │   ├── asycn.handel.ts            # Wrapper bắt lỗi bất đồng bộ asyncHandler
│   │   ├── base-responsitory.ts       # Base Repository pattern cho Mongoose
│   │   └── http-status.ts             # Định nghĩa mã trạng thái HTTP chuẩn
│   ├── config/                        # Cấu hình môi trường và dịch vụ
│   │   ├── connect-database.config.ts # Kết nối MongoDB
│   │   ├── env.config.ts              # Validate biến môi trường bằng Zod
│   │   ├── jwt.config.ts              # Ký/giải mã Access & Refresh Token
│   │   ├── redis.config.ts            # Quản lý kết nối Redis Cache
│   │   └── cloudinary.config.ts       # Cấu hình lưu trữ ảnh Cloudinary
│   ├── middlewares/                   # Middlewares hệ thống
│   │   ├── authentication.middelware.ts # Xác thực JWT Bearer token
│   │   ├── validate.middleware.ts     # Middleware kiểm tra schema bằng Zod
│   │   ├── upload.middleware.ts       # Upload file với Multer
│   │   └── AppError.middleware.ts     # Global Error Handler xử lý ngoại lệ tập trung
│   ├── modules/                       # Các module nghiệp vụ chính
│   │   ├── auth/                      # Đăng ký, đăng nhập, OTP, đổi mật khẩu
│   │   ├── user/                      # Mongoose Model người dùng
│   │   ├── product/                   # Quản lý sản phẩm, Option, Variant, SKU
│   │   ├── category/                  # Danh mục sản phẩm
│   │   ├── inventory/                 # Xuất / Nhập kho, lịch sử tồn kho
│   │   ├── cart/                      # Giỏ hàng Khách/User, tính giá, validate tồn kho
│   │   ├── order/                     # Đặt hàng, đổi trạng thái, trừ/hoàn tồn kho
│   │   └── payment/                   # Điều phối thanh toán (COD, VNPay, MoMo)
│   │       └── providers/             # Các Adapter cổng thanh toán độc lập
│   └── routes/
│       └── index.route.ts             # Khai báo và tiền tố các API routes (/api/v1)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Hướng dẫn cài đặt & Khởi chạy

### Yêu cầu tiên quyết
- **Node.js**: phiên bản `>= 18.0.0`
- **MongoDB**: Đã cài đặt cục bộ hoặc chuỗi kết nối MongoDB Atlas
- **Redis** *(Tuỳ chọn)*: Nếu không có Redis, hệ thống tự động chuyển sang chế độ in-memory cache dự phòng.

### Các bước cài đặt

1. **Clone repository và cài đặt dependencies:**
   ```bash
   cd d:/Backend-shop
   npm install
   ```

2. **Cấu hình biến môi trường:**
   Tạo file `.env` tại thư mục gốc của dự án (xem mẫu cấu hình bên dưới).

3. **Khởi chạy môi trường phát triển (Development):**
   ```bash
   npm start
   ```
   *Hệ thống sẽ chạy với `tsx watch` và tự động reload khi phát hiện thay đổi code.*

4. **Kiểm tra kiểu dữ liệu TypeScript:**
   ```bash
   npx tsc --noEmit
   ```

5. **Chạy kiểm thử (Unit Tests):**
   ```bash
   npm test
   ```

6. **Build cho môi trường Production:**
   ```bash
   npm run build
   node dist/server.js
   ```

---

## 4. Biến môi trường (.env)

Tạo file `.env` tại thư mục gốc với các thông số cấu hình sau:

```env
# Ứng dụng & Cổng dịch vụ
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Cơ sở dữ liệu MongoDB
MONGO_URL=mongodb://localhost:27017/shop-ecommerce

# Cấu hình Redis (Nếu có)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secrets
JWT_ACCESS_SECRET=your_jwt_access_secret_key_minimum_32_characters
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_minimum_32_characters
JWT_RESET_PASSWORD_SECRET=your_jwt_reset_password_secret_key

# Cloudinary (Upload ảnh)
CLOUD_NAME=your_cloudinary_cloud_name
API_KEY=your_cloudinary_api_key
API_SECRET=your_cloudinary_api_secret

# Cấu hình Email gửi OTP (Nodemailer)
USER_EMAIL=your_email@gmail.com
USER_PASSWORD=your_app_password

# Cổng thanh toán VNPay (Sandbox)
VNPAY_TMN_CODE=VNPAYDEMO
VNPAY_HASH_SECRET=SECRETKEYDEMO1234567890ABCDEFGH
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html

# Cổng thanh toán MoMo (Sandbox)
MOMO_PARTNER_CODE=MOMOBKUN20180529
MOMO_ACCESS_KEY=klm05TvNBzhg7hqa
MOMO_SECRET_KEY=at67qH6mk8w5Y1nAyMoYKMWACiEi2Aca
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
```

---

## 5. Chi tiết các Module & Logic nghiệp vụ

### 5.1. Authentication & User (`auth/`)
- **JWT Kép**: Cấp phát `accessToken` (thời hạn ngắn, lưu thông tin phiên và định danh) và `refreshToken` (thời hạn dài, lưu trong database session).
- **Session Tracking**: Lưu trữ thông tin thiết bị (User-Agent, IP), hỗ trợ đăng xuất theo phiên hoặc đăng xuất toàn bộ thiết bị.
- **Quên mật khẩu & OTP**: Gửi mã OTP xác thực qua email với thời hạn 5 phút. Khi xác minh thành công sẽ cấp `resetToken` dùng 1 lần để đổi mật khẩu.

### 5.2. Product, Option & Variant (`product/`)
- **Kiến trúc biến thể đa cấp**:
  - `Product`: Thông tin chung (tên, slug, danh mục, giá sàn, tổng kho, mô tả, ảnh đại diện, thương hiệu, tags).
  - `ProductOption`: Các thuộc tính tùy biến (ví dụ: Size: S, M, L; Màu sắc: Đen, Trắng, Đỏ).
  - `ProductVariant`: Bản ghi tồn kho thực tế cho từng tổ hợp (SKU độc lập, giá riêng, giá gốc, tồn kho riêng, ảnh biến thể).
- **Tối ưu hóa Caching**: Danh sách sản phẩm được cache trên Redis (`products:*`). Khi có thay đổi về sản phẩm hoặc kho hàng, cache sẽ tự động bị huỷ (invalidation).

### 5.3. Category (`category/`)
- Quản lý cây danh mục sản phẩm (Hỗ trợ danh mục cha `parentId` và danh mục con).
- Tự động sinh `slug` chuẩn SEO, hỗ trợ kích hoạt/ẩn danh mục.

### 5.4. Inventory Management (`inventory/`)
- **Quản lý điều chỉnh kho (`adjustStock`)**:
  - Hỗ trợ các loại giao dịch: `IMPORT` (nhập hàng), `EXPORT` (xuất hàng/bán hàng), `SALE`, `RETURN` (hoàn trả), `ADJUSTMENT` (kiểm kê).
  - Đảm bảo tính toán nhất quán giữa tồn kho của Variant và tổng tồn kho của Product cha.
  - Tự động ghi nhận `InventoryLog` lưu vết số lượng thay đổi, tồn kho trước, tồn kho sau, người thực hiện và mã tham chiếu (Mã đơn hàng, Phiếu nhập).

### 5.5. Cart (`cart/`)
- **Cơ chế danh tính lai (Hybrid Identity)**:
  - Hỗ trợ cả **User đã đăng nhập** (theo `userId`) và **Khách vãng lai** (theo header/cookie `x-guest-id`).
- **Gộp giỏ hàng thông minh (`mergeCart`)**:
  - Khi khách vãng lai đăng nhập, toàn bộ sản phẩm trong giỏ hàng tạm được tự động gộp vào tài khoản chính thức.
- **Kiểm định tồn kho & Biến động giá (`validateCart`)**:
  - So sánh giỏ hàng với trạng thái thực tế trong kho trước khi thanh toán.
  - Báo động tức thì nếu sản phẩm bị xoá, hết hàng, không đủ số lượng tồn hoặc vừa có đợt thay đổi giá.
- **Tính toán chi phí tự động**:
  - Tách bạch `subtotal` (chỉ tính các item được chọn `selected: true`).
  - Phí vận chuyển: Miễn phí với đơn hàng từ 500.000₫, mặc định 30.000₫ cho đơn thấp hơn.

### 5.6. Order & State Machine (`order/`)
- **Tạo đơn hàng (`createOrder`)**:
  - Có thể tạo từ các sản phẩm được tích chọn trong giỏ hàng hoặc truyền trực tiếp danh sách items.
  - Tự động sinh mã đơn duy nhất định dạng `ORD-{TIMESTAMP}-{RANDOM}`.
  - Kiểm tra tồn kho lần cuối, tự động trừ kho thông qua `inventoryService.adjustStock(type: 'EXPORT')`.
  - Tăng số lượt đã bán (`sold`) của sản phẩm.
  - Tự động dọn dẹp các sản phẩm đã mua khỏi giỏ hàng của người dùng.
- **State Machine vòng đời đơn hàng**:
  ```mermaid
  stateDiagram-v2
      [*] --> PENDING: Khách tạo đơn
      PENDING --> CONFIRMED: Thanh toán xong / Xác nhận
      PENDING --> CANCELLED: Khách huỷ / Hết hạn
      CONFIRMED --> PROCESSING: Đang đóng gói
      CONFIRMED --> CANCELLED: Huỷ đơn
      PROCESSING --> SHIPPING: Bàn giao vận chuyển
      PROCESSING --> CANCELLED: Huỷ đơn
      SHIPPING --> DELIVERED: Giao hàng thành công
      SHIPPING --> RETURNED: Giao thất bại / Trả hàng
      DELIVERED --> RETURNED: Đổi trả hàng
      DELIVERED --> [*]
      CANCELLED --> [*]: Tự động hoàn lại tồn kho
      RETURNED --> [*]: Tự động hoàn lại tồn kho
  ```
- **Tự động hoàn kho (Restock)**: Khi đơn hàng bị chuyển sang trạng thái `CANCELLED` hoặc `RETURNED`, hệ thống lập tức hoàn lại số lượng sản phẩm vào kho (`adjustStock` với `type: 'IMPORT'`) và giảm lại chỉ số `sold`.

### 5.7. Payment & Gateways (`payment/`)
Áp dụng mẫu thiết kế **Strategy Pattern**:

```
           ┌──────────────────────┐
           │    PaymentService    │
           └──────────┬───────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  ┌───────────┐ ┌───────────┐ ┌───────────┐
  │    COD    │ │   VNPay   │ │   MoMo    │
  │  Provider │ │  Provider │ │  Provider │
  └───────────┘ └───────────┘ └───────────┘
```

- **COD (Cash on Delivery)**:
  - Khởi tạo thanh toán trực tiếp, khi giao hàng thành công (`DELIVERED`) thì hệ thống tự động đổi `paymentStatus = 'PAID'`.
- **VNPay Gateway (v2.1.0)**:
  - Sắp xếp thứ tự các tham số theo chuẩn alphabet.
  - Mã hoá tạo chữ ký bảo mật **HMAC-SHA512** với Secret Key.
  - Xác thực hai chiều: Khách hàng redirect về (`/vnpay/return`) và Webhook IPN giữa hai máy chủ (`/vnpay/webhook`).
- **MoMo Gateway (All-in-One API)**:
  - Sinh chữ ký điện tử **HMAC-SHA256**.
  - Tích hợp API tạo giao diện thanh toán (Web & QR MoMo).
  - Xác thực chữ ký phản hồi và xử lý IPN.
- **Tính Idempotent (Chống lặp giao dịch)**:
  - Cổng thanh toán có thể gọi lại IPN nhiều lần khi mạng chậm, hệ thống nhận diện nếu đơn hàng đã được cập nhật `PAID` sẽ lập tức trả về phản hồi thành công mà không chạy lại logic cộng dồn hoặc chuyển trạng thái đơn.

---

## 6. Bảng danh mục API (API Reference)

Tất cả các API đều có tiền tố `/api/v1`.

### 🔐 1. Authentication (`/api/v1/auth`)

| Phương thức | Đường dẫn | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Đăng ký tài khoản người dùng mới |
| `POST` | `/auth/login` | Public | Đăng nhập hệ thống (nhận Access & Refresh Token) |
| `POST` | `/auth/refresh` | Public | Cấp mới Access Token bằng Refresh Token |
| `POST` | `/auth/forgot-password` | Public | Yêu cầu gửi mã OTP đặt lại mật khẩu qua Email |
| `POST` | `/auth/verify-otp` | Public | Xác thực mã OTP |
| `POST` | `/auth/reset-password` | Public | Đổi mật khẩu mới kèm mã reset token |

### 📁 2. Categories (`/api/v1/categories`)

| Phương thức | Đường dẫn | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/categories` | Public | Lấy danh sách tất cả danh mục (dạng cây / phẳng) |
| `GET` | `/categories/:id` | Public | Lấy thông tin chi tiết một danh mục |
| `POST` | `/categories` | Admin | Tạo danh mục mới |
| `PUT` | `/categories/:id` | Admin | Cập nhật danh mục |
| `DELETE` | `/categories/:id` | Admin | Xoá danh mục |

### 📦 3. Products & Variants (`/api/v1/products`)

| Phương thức | Đường dẫn | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/products` | Public | Lấy danh sách sản phẩm (hỗ trợ phân trang, lọc, sắp xếp) |
| `GET` | `/products/detail/:idOrSlug`| Public | Lấy chi tiết sản phẩm kèm danh sách Options & Variants |
| `GET` | `/products/:id` | Public | Lấy sản phẩm theo ObjectId |
| `POST` | `/products` | Admin | Thêm sản phẩm mới |
| `PUT` | `/products/:id` | Admin | Chỉnh sửa thông tin sản phẩm |
| `DELETE` | `/products/:id` | Admin | Xoá mềm sản phẩm |
| `PATCH` | `/products/:id/restore` | Admin | Khôi phục sản phẩm đã xoá |
| `POST` | `/products/upload-images` | Admin | Tải nhiều hình ảnh lên Cloudinary |
| `POST` | `/products/:productId/options` | Admin | Thêm thuộc tính Option (Size, Màu sắc...) |
| `POST` | `/products/:productId/variants`| Admin | Thêm biến thể SKU mới cho sản phẩm |

### 📊 4. Inventory (`/api/v1/inventory`)

| Phương thức | Đường dẫn | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/inventory/adjust` | Admin | Điều chỉnh số lượng tồn kho (Nhập/Xuất/Kiểm kê) |
| `GET` | `/inventory/logs/:productId` | Admin | Xem lịch sử biến động kho của một sản phẩm |

### 🛒 5. Cart (`/api/v1/cart`)

*(Sử dụng Bearer token nếu đã đăng nhập, hoặc gửi header `x-guest-id` nếu là khách)*

| Phương thức | Đường dẫn | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/cart` | Guest / User | Lấy thông tin giỏ hàng hiện tại (kèm giá & tồn kho mới nhất) |
| `POST` | `/cart/items` | Guest / User | Thêm sản phẩm hoặc biến thể vào giỏ hàng |
| `PUT` | `/cart/items/:itemId` | Guest / User | Cập nhật số lượng hoặc trạng thái chọn (selected) |
| `DELETE` | `/cart/items/:itemId` | Guest / User | Xoá 1 sản phẩm khỏi giỏ hàng |
| `DELETE` | `/cart` | Guest / User | Xoá toàn bộ giỏ hàng |
| `PATCH` | `/cart/select` | Guest / User | Chọn hoặc bỏ chọn nhiều sản phẩm cùng lúc |
| `POST` | `/cart/validate` | Guest / User | Kiểm tra tính hợp lệ của giỏ hàng với tồn kho thực tế |
| `POST` | `/cart/coupon` | Guest / User | Áp dụng mã giảm giá |
| `DELETE` | `/cart/coupon` | Guest / User | Gỡ bỏ mã giảm giá |
| `POST` | `/cart/merge` | Đã đăng nhập | Gộp giỏ hàng khách vãng lai vào tài khoản sau khi login |

### 🧾 6. Orders (`/api/v1/orders`)

| Phương thức | Đường dẫn | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/orders` | Guest / User | Tạo đơn hàng mới từ giỏ hàng (Tự động trừ kho) |
| `GET` | `/orders` | Guest / User | Lấy danh sách đơn hàng đã mua (có phân trang) |
| `GET` | `/orders/:id` | Guest / User | Xem chi tiết đơn hàng theo `_id` hoặc mã `orderCode` |
| `PATCH` | `/orders/:id/cancel` | Guest / User | Huỷ đơn hàng (khi ở trạng thái PENDING hoặc CONFIRMED) |
| `PATCH` | `/orders/:id/status` | Admin | Cập nhật trạng thái đơn (State Machine) |

### 💳 7. Payments (`/api/v1/payments`)

| Phương thức | Đường dẫn | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/payments/create` | Guest / User | Khởi tạo giao dịch thanh toán (Lấy URL VNPay, MoMo hoặc xác nhận COD) |
| `GET` | `/payments/vnpay/return` | Public | Điểm tiếp nhận khách hàng chuyển hướng về từ VNPay |
| `GET` | `/payments/vnpay/webhook`| Public | Server-to-Server IPN Webhook đồng bộ giao dịch từ VNPay |
| `GET` | `/payments/momo/return` | Public | Điểm tiếp nhận khách hàng chuyển hướng về từ MoMo |
| `POST` | `/payments/momo/webhook` | Public | Server-to-Server IPN Webhook đồng bộ giao dịch từ MoMo |
| `GET` | `/payments/order/:orderId`| Guest / User | Tra cứu trạng thái giao dịch thanh toán của một đơn hàng |

---

## 7. Chuẩn hoá Response & Xử lý lỗi

### Cấu trúc phản hồi thành công (`ApiResponse`)
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "orderCode": "ORD-M1B8Z3-A7K2",
    "orderStatus": "PENDING",
    "paymentStatus": "PENDING",
    "pricing": {
      "subtotal": 400000,
      "shippingFee": 30000,
      "totalAmount": 430000
    }
  }
}
```

Đối với danh sách phân trang:
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

### Cấu trúc phản hồi lỗi (`AppError`)
Tất cả các lỗi nghiệp vụ hoặc hệ thống đều được bắt qua `AppError.middleware.ts` và trả về cấu trúc thống nhất:
```json
{
  "success": false,
  "message": "Insufficient stock for \"Áo Thun Cotton\". Only 2 left.",
  "errorCode": "INSUFFICIENT_STOCK",
  "statusCode": 400
}
```

---

## 8. Kiểm thử (Testing)

Dự án sử dụng **Vitest** để viết unit test độc lập với tốc độ thực thi cao, mock toàn bộ database và dịch vụ bên thứ ba để đảm bảo kiểm thử chính xác không phụ thuộc môi trường mạng:

```bash
# Chạy toàn bộ các bộ kiểm thử
npm test

# Chạy kiểm thử ở chế độ theo dõi (Watch mode)
npx vitest

# Chạy kiểm thử riêng cho từng module
npx vitest src/modules/cart/cart.test.ts
npx vitest src/modules/order/order.test.ts
npx vitest src/modules/payment/payment.test.ts
```

### Hiện trạng kiểm thử:
- **100% Passed (40/40 tests)**:
  - `cart.test.ts`: 26 tests (Thêm, bớt, cập nhật, tính giá subtotal/shipping, validation tồn kho).
  - `order.test.ts`: 8 tests (Tạo mã đơn ngẫu nhiên, xác thực tồn kho, trừ kho, đồng bộ giỏ hàng, state machine, hoàn kho khi huỷ đơn).
  - `payment.test.ts`: 6 tests (Provider registry, tạo link VNPay có mã băm SHA512, xác thực chữ ký return và webhook).

---

## 👨‍💻 Thông tin phát triển
- **Dự án**: Backend Shop E-Commerce Platform
- **Môi trường**: Node.js & TypeScript
- **Giấy phép**: MIT License

