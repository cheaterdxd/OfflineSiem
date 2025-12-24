# Hướng dẫn Cấu hình - Offline SIEM

## Tổng quan

Hệ thống cấu hình cho phép bạn tùy chỉnh nơi lưu trữ detection rules và log files, giúp tổ chức dữ liệu theo cách phù hợp với môi trường làm việc của bạn.

---

## Truy cập Settings

1. Mở ứng dụng Offline SIEM
2. Click vào menu **"Settings"** ở sidebar bên trái
3. Bạn sẽ thấy 3 phần cấu hình chính

---

## 1. Rules Directory (Thư mục Rules)

### Mục đích
Chọn nơi lưu trữ các detection rules (file YAML). Mặc định, rules được lưu trong thư mục dữ liệu của ứng dụng.

### Cách sử dụng

**Đổi thư mục Rules:**
1. Click nút **"Change Directory"**
2. Chọn thư mục bạn muốn sử dụng
3. Tất cả rules sẽ được lưu/load từ thư mục này

**Reset về mặc định:**
1. Click nút **"Reset to Default"**
2. Rules sẽ trở về thư mục mặc định của app

### Ví dụ sử dụng
```
Thư mục tùy chỉnh: D:\SecurityRules
├── ssh-brute-force.yaml
├── failed-login.yaml
└── suspicious-activity.yaml
```

**Lưu ý:** Khi đổi thư mục, rules cũ KHÔNG tự động di chuyển. Bạn cần copy thủ công nếu muốn.

---

## 2. Default Logs Directory (Thư mục Logs mặc định)

### Mục đích
Đặt thư mục mặc định khi mở file picker để chọn log files. Giúp tiết kiệm thời gian nếu logs thường nằm ở một vị trí cố định.

### Cách sử dụng

**Đặt thư mục mặc định:**
1. Click nút **"Set Directory"**
2. Chọn thư mục chứa log files
3. Lần sau khi chọn logs, file picker sẽ mở tại đây

**Xóa cấu hình:**
1. Click nút **"Clear"**
2. File picker sẽ mở ở vị trí mặc định của hệ thống

### Ví dụ sử dụng
```
Thư mục logs: D:\Logs\CloudTrail
├── 2024-12-24.json
├── 2024-12-23.json
└── 2024-12-22.json
```

---

## 3. Recent Files (Files gần đây)

### Mục đích
Tự động lưu danh sách 10 log files gần nhất bạn đã scan. Giúp truy cập nhanh các files thường xuyên phân tích.

### Cách hoạt động
- **Tự động:** Mỗi khi bạn scan một log file, nó được thêm vào danh sách
- **Giới hạn:** Chỉ lưu 10 files gần nhất
- **Hiển thị:** Đường dẫn đầy đủ của từng file

### Xóa lịch sử
1. Click nút **"Clear Recent Files"**
2. Xác nhận trong dialog
3. Danh sách sẽ được xóa sạch

---

## File cấu hình

### Vị trí lưu trữ
Settings được lưu tự động vào file JSON:

```
Windows: C:\Users\<username>\AppData\Roaming\com.tuanle.offline-siem\config.json
```

### Cấu trúc file
```json
{
  "rules_directory": "D:\\SecurityRules",
  "default_logs_directory": "D:\\Logs\\CloudTrail",
  "recent_log_files": [
    "D:\\Logs\\CloudTrail\\2024-12-24.json",
    "D:\\Logs\\VPC\\flow-logs.json"
  ],
  "max_recent_files": 10,
  "ui_preferences": {
    "dark_mode": true,
    "auto_refresh_interval": 0
  }
}
```

### Backup & Restore
Bạn có thể:
- **Backup:** Copy file `config.json` ra nơi an toàn
- **Restore:** Paste file cũ vào để khôi phục settings
- **Share:** Chia sẻ config với đồng nghiệp

---

## Workflow khuyến nghị

### Cho môi trường doanh nghiệp

1. **Tạo thư mục tập trung:**
   ```
   D:\SIEM\
   ├── Rules\          (Đặt làm Rules Directory)
   └── Logs\           (Đặt làm Default Logs Directory)
       ├── CloudTrail\
       ├── VPC\
       └── WAF\
   ```

2. **Cấu hình trong Settings:**
   - Rules Directory: `D:\SIEM\Rules`
   - Default Logs Directory: `D:\SIEM\Logs`

3. **Lợi ích:**
   - Dễ backup toàn bộ dữ liệu SIEM
   - Đồng bộ qua network drive
   - Quản lý phân quyền tập trung

### Cho phân tích cá nhân

1. **Sử dụng mặc định:**
   - Để Rules Directory mặc định
   - Chỉ đặt Default Logs Directory nếu cần

2. **Tận dụng Recent Files:**
   - Không cần nhớ đường dẫn logs
   - Truy cập nhanh files thường dùng

---

## Câu hỏi thường gặp (FAQ)

### Q: Rules cũ có tự động chuyển sang thư mục mới không?
**A:** Không. Bạn cần copy thủ công các file `.yaml` từ thư mục cũ sang thư mục mới.

### Q: Thư mục Rules mặc định ở đâu?
**A:** `C:\Users\<username>\AppData\Roaming\com.tuanle.offline-siem\rules\`

### Q: Có thể dùng network drive không?
**A:** Có, bạn có thể chọn bất kỳ thư mục nào mà Windows có quyền truy cập, bao gồm network drives (\\server\share).

### Q: Settings có đồng bộ giữa các máy không?
**A:** Không tự động. Bạn cần copy file `config.json` giữa các máy.

### Q: Xóa Recent Files có ảnh hưởng gì không?
**A:** Không. Chỉ xóa danh sách hiển thị, không xóa file logs thật.

### Q: Có thể có nhiều Rules Directory không?
**A:** Hiện tại chỉ hỗ trợ 1 thư mục. Nhưng bạn có thể tạo sub-folders bên trong.

---

## Troubleshooting

### Không thể chọn thư mục
- **Nguyên nhân:** Không có quyền truy cập
- **Giải pháp:** Chọn thư mục khác hoặc chạy app với quyền Administrator

### Rules không hiển thị sau khi đổi thư mục
- **Nguyên nhân:** Thư mục mới trống hoặc không có file `.yaml`
- **Giải pháp:** Copy rules từ thư mục cũ hoặc tạo rules mới

### Settings không lưu
- **Nguyên nhân:** Không có quyền ghi vào AppData
- **Giải pháp:** Kiểm tra quyền folder hoặc chạy app với quyền Administrator

---

## Tips & Tricks

### 1. Tổ chức Rules theo loại
```
D:\SIEM\Rules\
├── Authentication\
│   ├── ssh-brute-force.yaml
│   └── failed-login.yaml
├── Network\
│   ├── port-scan.yaml
│   └── ddos-detection.yaml
└── Application\
    └── sql-injection.yaml
```

### 2. Đặt tên Logs theo ngày
```
D:\SIEM\Logs\
├── 2024-12-24_cloudtrail.json
├── 2024-12-24_vpc.json
└── 2024-12-23_cloudtrail.json
```

### 3. Backup định kỳ
Tạo script PowerShell tự động backup:
```powershell
# backup-siem.ps1
$source = "D:\SIEM"
$backup = "E:\Backups\SIEM_$(Get-Date -Format 'yyyy-MM-dd')"
Copy-Item -Path $source -Destination $backup -Recurse
```

---

## Kết luận

Hệ thống cấu hình giúp bạn:
- ✅ Tổ chức dữ liệu theo cách riêng
- ✅ Tích hợp với quy trình hiện tại
- ✅ Tăng hiệu suất làm việc
- ✅ Dễ dàng backup và chia sẻ

Nếu có thắc mắc, vui lòng liên hệ support hoặc tham khảo documentation đầy đủ.
