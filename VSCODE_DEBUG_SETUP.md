# Cấu Hình VS Code để Debug

## Cài Đặt Extensions

Cài đặt các extension sau trong VS Code:

1. **CodeLLDB** - Debug Rust code
   - ID: `vadimcn.vscode-lldb`
   - Link: https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb

2. **rust-analyzer** - Rust language support
   - ID: `rust-lang.rust-analyzer`
   - Link: https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer

3. **Tauri** - Tauri framework support
   - ID: `tauri-apps.tauri-vscode`
   - Link: https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode

4. **ES7+ React/Redux/React-Native snippets** - React development
   - ID: `dsznajder.es7-react-js-snippets`

## Tạo File Launch Configuration

Tạo file `.vscode/launch.json` trong thư mục dự án với nội dung sau:

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
    },
    {
      "type": "lldb",
      "request": "launch",
      "name": "Tauri Production Debug",
      "cargo": {
        "args": [
          "build",
          "--release",
          "--manifest-path=./src-tauri/Cargo.toml"
        ]
      },
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

## Tạo File Settings (Tùy chọn)

Tạo file `.vscode/settings.json` để cấu hình workspace:

```json
{
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.checkOnSave.command": "clippy",
  "editor.formatOnSave": true,
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Cách Sử Dụng Debug trong VS Code

### Debug Rust Backend

1. Mở file Rust cần debug (ví dụ: `src-tauri/src/main.rs`)
2. Đặt breakpoint bằng cách click vào lề trái (hoặc nhấn F9)
3. Nhấn `F5` hoặc vào menu **Run > Start Debugging**
4. Chọn configuration **"Tauri Development Debug"**
5. Chương trình sẽ dừng tại breakpoint, bạn có thể:
   - Xem giá trị biến
   - Step over (F10)
   - Step into (F11)
   - Continue (F5)

### Debug React Frontend

1. Chạy ứng dụng: `npm run tauri dev`
2. Khi ứng dụng mở, nhấn `F12` để mở DevTools
3. Vào tab **Sources**
4. Tìm file TypeScript/React cần debug
5. Đặt breakpoint trong DevTools
6. Thực hiện action để trigger code

### Debug Đồng Thời Frontend và Backend

1. Chạy `npm run tauri dev` trong terminal
2. Mở DevTools (`F12`) cho frontend debugging
3. Trong VS Code, attach debugger cho Rust:
   - Nhấn `Ctrl+Shift+P`
   - Chọn **"LLDB: Attach to Process"**
   - Tìm process `offline_siem`

## Keyboard Shortcuts Hữu Ích

| Shortcut | Chức năng |
|----------|-----------|
| `F5` | Start/Continue debugging |
| `F9` | Toggle breakpoint |
| `F10` | Step over |
| `F11` | Step into |
| `Shift+F11` | Step out |
| `Ctrl+Shift+F5` | Restart debugging |
| `Shift+F5` | Stop debugging |
| `Ctrl+K Ctrl+I` | Show hover info |

## Troubleshooting

### "LLDB not found"
- Cài đặt extension CodeLLDB
- Restart VS Code

### "Cannot find cargo"
- Đảm bảo Rust đã được cài đặt
- Thêm Rust vào PATH
- Restart VS Code

### Breakpoints không hoạt động
- Đảm bảo build ở chế độ debug (không phải `--release`)
- Check rằng source maps được enable
- Rebuild project

### Performance chậm khi debug
- Sử dụng conditional breakpoints
- Tắt "Break on all exceptions"
- Debug chỉ phần code cần thiết
