# OfflineSiem - High-Performance Offline Desktop SIEM

Ứng dụng SIEM desktop hiệu năng cao, hoạt động offline với Rust, Tauri, React và DuckDB.

## 🚀 Quick Start

### Khởi Chạy Development Mode

#### Cách 1: Sử dụng Script (Khuyến nghị)
```powershell
# Chạy script PowerShell
.\start-dev.ps1
```

#### Cách 2: Chạy Trực Tiếp
```bash
# Cài đặt dependencies (chỉ lần đầu)
npm install

# Khởi chạy ứng dụng
npm run tauri dev
```

### Build Production
```bash
npm run tauri build
```

## 📚 Tài Liệu

- **[DEBUG_GUIDE.md](./DEBUG_GUIDE.md)** - Hướng dẫn chi tiết về cách debug ứng dụng
- **[VSCODE_DEBUG_SETUP.md](./VSCODE_DEBUG_SETUP.md)** - Cấu hình VS Code để debug
- **[CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md)** - Hướng dẫn cấu hình ứng dụng
- **[RULE_FORMAT_GUIDE.md](./RULE_FORMAT_GUIDE.md)** - Chuẩn định dạng rule để import
- **[sample_rules/](./sample_rules/)** - Các rule mẫu để tham khảo

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Rust + Tauri 2
- **Database**: DuckDB (embedded)
- **UI**: Custom CSS with modern design

## 📋 Yêu Cầu Hệ Thống

- Node.js >= 18.x
- Rust (latest stable)
- Visual Studio C++ Build Tools (Windows)

## 🎯 Tính Năng Chính

- ✅ Quản lý Rules (CRUD, Import Sigma)
- ✅ Scanning Engine cho JSON logs
- ✅ Ad-hoc Investigation với DuckDB
- ✅ Dashboard và Visualization
- ✅ Auto-load JSON log files
- ✅ Rule Testing UI
- ✅ Alert Deduplication

## 🐛 Debug và Troubleshooting

Xem [DEBUG_GUIDE.md](./DEBUG_GUIDE.md) để biết chi tiết về:
- Cách khởi chạy và debug frontend/backend
- Xử lý lỗi thường gặp
- Performance profiling
- Best practices

## 💡 Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- Extensions:
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
  - [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)

## 📝 License

GPL-3.0 License - See [LICENSE](./LICENSE) for details
