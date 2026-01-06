# Vấn đề: Lỗi "invalid type: map, expected a boolean"

## Nguyên nhân

Lỗi này xảy ra khi:
1. **Ứng dụng đang chạy code cũ** (trước khi thêm `import_multiple_rules` command)
2. Frontend gọi command `import_multiple_rules` nhưng backend chưa có command này
3. Tauri không tìm thấy command → trả về lỗi serialization

## Phân tích chi tiết

### Thứ tự thực thi (ĐÚNG):
```typescript
const overwrite: boolean = confirm('...'); // ← Chạy ĐỒNG BỘ, chặn UI
const summary = await ruleService.importMultipleRules(yamlFiles, overwrite); // ← Chạy SAU khi có overwrite
```

**Không có vấn đề về thứ tự thực thi!** Vì:
- `confirm()` là hàm đồng bộ → chặn UI cho đến khi user click
- `await` làm code chạy tuần tự, không song song
- `overwrite` được gán giá trị TRƯỚC khi `await` chạy

### Vấn đề thực sự:
Ứng dụng đang chạy **binary cũ** chưa có command `import_multiple_rules`

## Giải pháp

### Cách 1: Restart dev server
```powershell
# Dừng server hiện tại (Ctrl+C)
# Sau đó chạy lại:
.\start-dev.ps1
```

### Cách 2: Clean build (nếu vẫn lỗi)
```powershell
cd src-tauri
cargo clean
cd ..
.\start-dev.ps1
```

### Cách 3: Kiểm tra command đã được register
Mở `src-tauri/src/lib.rs` và kiểm tra:
```rust
.invoke_handler(tauri::generate_handler![
    // ...
    import_multiple_rules,  // ← Phải có dòng này
    // ...
])
```

## Xác nhận đã fix

Sau khi rebuild, thử import lại:
1. Click "Import" button
2. Chọn 2 file YAML
3. **Phải thấy confirm dialog TRƯỚC**
4. Sau khi click OK/Cancel → Import chạy
5. Không còn lỗi "invalid type: map"

## Ghi chú

Lỗi này KHÔNG phải do:
- ❌ Thứ tự thực thi async/await
- ❌ Kiểu dữ liệu của `overwrite`
- ❌ Cách gọi Tauri invoke

Mà là do:
- ✅ Ứng dụng chạy code cũ chưa có command mới
