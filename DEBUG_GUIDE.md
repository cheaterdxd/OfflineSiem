# Hướng Dẫn Khởi Chạy và Debug OfflineSiem

## Yêu Cầu Hệ Thống

### 1. Cài Đặt Công Cụ Cần Thiết

#### Node.js và npm
- **Phiên bản**: Node.js >= 18.x
- **Kiểm tra**: 
  ```bash
  node --version
  npm --version
  ```

#### Rust
- **Cài đặt Rust**: 
  ```bash
  # Tải và cài đặt từ https://rustup.rs/
  rustup --version
  cargo --version
  ```

#### Visual Studio C++ Build Tools (Windows)
- Tải và cài đặt từ: https://visualstudio.microsoft.com/downloads/
- Chọn "Desktop development with C++" workload

---

## Khởi Chạy Ứng Dụng

### Phương Pháp 1: Development Mode (Khuyến Nghị cho Debug)

#### Bước 1: Cài Đặt Dependencies
```bash
# Di chuyển vào thư mục dự án
cd d:\root_folder\rieng\code\OfflineSiem

# Cài đặt Node dependencies
npm install

# Cài đặt Rust dependencies (tự động khi chạy lần đầu)
```

#### Bước 2: Khởi Chạy Development Server
```bash
# Khởi chạy ứng dụng ở chế độ development
npm run tauri dev
```

**Lưu ý**: 
- Lần đầu tiên sẽ mất 5-10 phút để compile Rust code
- Các lần sau sẽ nhanh hơn nhờ caching
- Hot reload được bật tự động cho React code
- Rust code cần rebuild khi thay đổi

---

## Debug Ứng Dụng

### 1. Debug Frontend (React/TypeScript)

#### Sử dụng Browser DevTools
Khi ứng dụng đang chạy ở development mode:
1. Nhấn `F12` hoặc `Ctrl+Shift+I` để mở DevTools
2. Sử dụng tab **Console** để xem logs
3. Sử dụng tab **Sources** để đặt breakpoints
4. Sử dụng tab **Network** để theo dõi requests

#### Thêm Console Logs
```typescript
// Trong file .tsx hoặc .ts
console.log('Debug info:', variable);
console.error('Error:', error);
console.table(arrayData);
```

### 2. Debug Backend (Rust/Tauri)

#### Xem Rust Logs trong Console
Rust logs sẽ xuất hiện trong terminal nơi bạn chạy `npm run tauri dev`

#### Thêm Debug Logs trong Rust
```rust
// Trong file .rs
println!("Debug: {:?}", variable);
eprintln!("Error: {:?}", error);

// Hoặc sử dụng dbg! macro
dbg!(&variable);
```

#### Debug với VS Code

Tạo file `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Tauri Development Debug",
      "cargo": {
        "args": [
          "build",
          "--manifest-path=./src-tauri/Cargo.toml",
          "--no-default-features"
        ]
      },
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

**Yêu cầu**: Cài extension `CodeLLDB` trong VS Code

### 3. Debug DuckDB Queries

#### Kiểm tra SQL Queries
```rust
// Thêm logging cho queries
println!("Executing query: {}", query);
let result = conn.execute(&query, params)?;
println!("Query result: {:?}", result);
```

#### Sử dụng DuckDB CLI (Tùy chọn)
```bash
# Cài đặt DuckDB CLI
# Kết nối đến database file
duckdb path/to/your/database.db

# Chạy queries để kiểm tra
SELECT * FROM logs LIMIT 10;
```

---

## Các Lệnh Hữu Ích

### Development
```bash
# Khởi chạy dev mode
npm run tauri dev

# Chỉ chạy Vite dev server (frontend only)
npm run dev

# Build frontend
npm run build
```

### Production Build
```bash
# Build ứng dụng production
npm run tauri build

# File .exe sẽ được tạo tại:
# src-tauri/target/release/offline_siem.exe
```

### Rust Commands
```bash
# Check Rust code (không build)
cd src-tauri
cargo check

# Build Rust code
cargo build

# Build với optimizations
cargo build --release

# Chạy tests
cargo test

# Format code
cargo fmt

# Lint code
cargo clippy
```

---

## Xử Lý Lỗi Thường Gặp

### 1. Lỗi "Failed to resolve dependencies"
```bash
# Xóa node_modules và cài lại
rm -rf node_modules package-lock.json
npm install
```

### 2. Lỗi Rust Compilation
```bash
# Clean Rust build cache
cd src-tauri
cargo clean

# Rebuild
cd ..
npm run tauri dev
```

### 3. Lỗi "DuckDB bundled feature"
- Đảm bảo `Cargo.toml` có: `duckdb = { version = "1.0", features = ["bundled"] }`
- Clean và rebuild

### 4. Port đã được sử dụng
```bash
# Vite mặc định dùng port 1420
# Thay đổi trong vite.config.ts nếu cần:
server: {
  port: 1421
}
```

---

## Workflow Debug Khuyến Nghị

### Cho Frontend Issues:
1. Chạy `npm run tauri dev`
2. Mở DevTools (`F12`)
3. Kiểm tra Console tab cho errors
4. Đặt breakpoints trong Sources tab
5. Reload page (`Ctrl+R`) để test lại

### Cho Backend Issues:
1. Thêm `println!` hoặc `dbg!` trong Rust code
2. Chạy `npm run tauri dev`
3. Xem output trong terminal
4. Sửa code Rust
5. Ứng dụng sẽ tự động rebuild và reload

### Cho Database Issues:
1. Thêm logging cho SQL queries
2. Kiểm tra query syntax
3. Verify data với DuckDB CLI (nếu cần)
4. Check database file permissions

---

## Performance Profiling

### Frontend Performance
- Sử dụng React DevTools Profiler
- Chrome DevTools Performance tab

### Backend Performance
```bash
# Build với profiling
cd src-tauri
cargo build --release --features profiling

# Hoặc sử dụng cargo flamegraph
cargo install flamegraph
cargo flamegraph
```

---

## Tips và Best Practices

1. **Luôn chạy development mode khi debug** - Hot reload giúp tiết kiệm thời gian
2. **Sử dụng TypeScript strict mode** - Bắt lỗi sớm hơn
3. **Thêm error boundaries trong React** - Xử lý errors gracefully
4. **Log đầy đủ trong Rust** - Dễ dàng trace issues
5. **Test từng component riêng lẻ** - Isolate problems
6. **Sử dụng Git** - Dễ dàng rollback khi có vấn đề

---

## Tài Nguyên Tham Khảo

- [Tauri Documentation](https://tauri.app/v2/guides/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [React Documentation](https://react.dev/)
- [DuckDB Documentation](https://duckdb.org/docs/)
- [Vite Documentation](https://vitejs.dev/)

---

## Liên Hệ và Hỗ Trợ

Nếu gặp vấn đề không giải quyết được:
1. Check GitHub Issues của Tauri
2. Tham khảo Tauri Discord community
3. Review CONFIGURATION_GUIDE.md cho cấu hình chi tiết
