# Hướng Dẫn Định Dạng Rule - OfflineSiem

## Tổng Quan

Tài liệu này mô tả chuẩn định dạng YAML cho detection rules trong OfflineSiem. Tuân thủ đúng format này đảm bảo rules được import thành công vào ứng dụng.

---

## Cấu Trúc Rule Cơ Bản

Mỗi rule là một file YAML với cấu trúc sau:

```yaml
id: "unique-uuid-v4"
title: "Rule Title"
description: "Detailed description of what this rule detects"
author: "Author Name"
status: "active"
date: "2026-01-05"
tags:
  - tag1
  - tag2
detection:
  severity: "high"
  condition: "SQL WHERE clause"
  aggregation:
    enabled: true
    window: "5m"
    threshold: "> 5"
output:
  alert_title: "Custom Alert: {{field_name}}"
```

---

## Trường Bắt Buộc (Required Fields)

### 1. `id` (string)
- **Mô tả**: Unique identifier cho rule
- **Format**: UUID v4 (ví dụ: `"550e8400-e29b-41d4-a716-446655440000"`)
- **Lưu ý**: 
  - Nếu để trống `""`, hệ thống sẽ tự động generate UUID mới khi import
  - Nếu import rule có ID đã tồn tại, cần chọn `overwrite=true`

**Ví dụ**:
```yaml
id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### 2. `title` (string)
- **Mô tả**: Tên ngắn gọn, dễ hiểu của rule
- **Yêu cầu**: Không được để trống
- **Best Practice**: Sử dụng tên mô tả rõ ràng về mối đe dọa

**Ví dụ**:
```yaml
title: "SSH Brute Force Detection"
```

### 3. `description` (string)
- **Mô tả**: Mô tả chi tiết về rule phát hiện gì, tại sao quan trọng
- **Yêu cầu**: Không được để trống
- **Best Practice**: Giải thích rõ ràng về threat scenario

**Ví dụ**:
```yaml
description: "Detects multiple failed SSH login attempts from the same source IP within a short time window, indicating potential brute force attack"
```

### 4. `author` (string)
- **Mô tả**: Tên tác giả hoặc team tạo rule
- **Yêu cầu**: Không được để trống

**Ví dụ**:
```yaml
author: "Security Operations Team"
```

### 5. `status` (string)
- **Mô tả**: Trạng thái hoạt động của rule
- **Giá trị hợp lệ**: 
  - `"active"` - Rule đang hoạt động, sẽ được sử dụng khi scan
  - `"disabled"` - Rule tạm dừng
  - `"experimental"` - Rule đang thử nghiệm
  - `"deprecated"` - Rule lỗi thời, không nên dùng
- **Mặc định**: Nên dùng `"active"`

**Ví dụ**:
```yaml
status: "active"
```

### 6. `date` (string)
- **Mô tả**: Ngày tạo hoặc cập nhật rule
- **Format**: ISO 8601 date (`YYYY-MM-DD`)
- **Lưu ý**: Hệ thống sẽ tự động cập nhật khi save rule

**Ví dụ**:
```yaml
date: "2026-01-05"
```

### 7. `detection` (object)
- **Mô tả**: Core logic của rule
- **Bắt buộc**: Phải có object `detection` với các trường con

#### 7.1. `detection.severity` (string)
- **Mô tả**: Mức độ nghiêm trọng của alert
- **Giá trị hợp lệ**:
  - `"critical"` - Nghiêm trọng nhất, cần xử lý ngay
  - `"high"` - Mức độ cao
  - `"medium"` - Mức độ trung bình
  - `"low"` - Mức độ thấp
  - `"info"` - Chỉ thông tin

**Ví dụ**:
```yaml
detection:
  severity: "high"
```

#### 7.2. `detection.condition` (string)
- **Mô tả**: SQL WHERE clause để match log entries
- **Syntax**: DuckDB SQL WHERE clause (không bao gồm từ khóa `WHERE`)
- **Quan trọng**: 
  - Sử dụng single quotes `'` cho string literals
  - Có thể dùng các operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `IN`, `AND`, `OR`
  - Có thể truy cập nested JSON fields với dot notation hoặc arrow operator

**Ví dụ đơn giản**:
```yaml
detection:
  condition: "eventName = 'ConsoleLogin' AND responseElements.ConsoleLogin = 'Success'"
```

**Ví dụ phức tạp**:
```yaml
detection:
  condition: "eventName IN ('DeleteBucket', 'DeleteObject') AND userIdentity.type != 'AWSService'"
```

**Ví dụ với nested fields**:
```yaml
detection:
  condition: "userIdentity.principalId LIKE '%AIDAI%' AND errorCode IS NOT NULL"
```

---

## Trường Tùy Chọn (Optional Fields)

### 8. `tags` (array of strings)
- **Mô tả**: Danh sách tags để phân loại và filter rules
- **Mặc định**: `[]` (empty array nếu không có)
- **Best Practice**: Sử dụng tags nhất quán để dễ quản lý

**Ví dụ**:
```yaml
tags:
  - ssh
  - brute-force
  - authentication
  - linux
```

### 9. `detection.aggregation` (object)
- **Mô tả**: Cấu hình cho threshold-based detection (phát hiện dựa trên số lượng events trong time window)
- **Khi nào dùng**: Khi cần phát hiện pattern dựa trên tần suất (ví dụ: brute force, DDoS)

#### 9.1. `aggregation.enabled` (boolean)
- **Giá trị**: `true` hoặc `false`

#### 9.2. `aggregation.window` (string)
- **Mô tả**: Time window để đếm events
- **Format**: `<number><unit>` 
  - Units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days)
- **Ví dụ**: `"5m"`, `"1h"`, `"30s"`

#### 9.3. `aggregation.threshold` (string)
- **Mô tả**: Điều kiện threshold
- **Format**: `<operator> <number>`
- **Operators**: `>`, `>=`, `<`, `<=`, `=`

**Ví dụ đầy đủ**:
```yaml
detection:
  severity: "high"
  condition: "eventName = 'ConsoleLogin' AND errorCode = 'Failed authentication'"
  aggregation:
    enabled: true
    window: "5m"
    threshold: "> 5"
```

### 10. `output` (object)
- **Mô tả**: Cấu hình format output của alert
- **Tùy chọn**: Có thể bỏ qua nếu dùng default format

#### 10.1. `output.alert_title` (string)
- **Mô tả**: Template cho alert title với variable substitution
- **Syntax**: Sử dụng `{{field_name}}` để insert giá trị từ matched event

**Ví dụ**:
```yaml
output:
  alert_title: "Suspicious login from {{sourceIPAddress}} to user {{userIdentity.userName}}"
```

---

## Ví Dụ Rule Hoàn Chỉnh

### Ví Dụ 1: Simple Detection Rule

```yaml
id: "12345678-1234-1234-1234-123456789012"
title: "AWS Console Login Success"
description: "Detects successful AWS console login events for monitoring purposes"
author: "Cloud Security Team"
status: "active"
date: "2026-01-05"
tags:
  - aws
  - cloudtrail
  - authentication
  - console
detection:
  severity: "info"
  condition: "eventName = 'ConsoleLogin' AND responseElements.ConsoleLogin = 'Success'"
```

### Ví Dụ 2: Threshold-Based Detection

```yaml
id: "87654321-4321-4321-4321-210987654321"
title: "AWS API Brute Force Attempt"
description: "Detects multiple failed API calls from the same source IP, indicating potential credential stuffing or brute force attack"
author: "SOC Team"
status: "active"
date: "2026-01-05"
tags:
  - aws
  - brute-force
  - api
  - authentication
detection:
  severity: "high"
  condition: "errorCode = 'AccessDenied' OR errorCode = 'UnauthorizedOperation'"
  aggregation:
    enabled: true
    window: "5m"
    threshold: "> 10"
output:
  alert_title: "Brute force detected from {{sourceIPAddress}}"
```

### Ví Dụ 3: Complex Condition

```yaml
id: "abcdef12-3456-7890-abcd-ef1234567890"
title: "Sensitive S3 Bucket Deletion"
description: "Detects deletion of S3 buckets by non-service accounts, which could indicate data destruction attack"
author: "Data Protection Team"
status: "active"
date: "2026-01-05"
tags:
  - aws
  - s3
  - data-destruction
  - critical-asset
detection:
  severity: "critical"
  condition: "eventName IN ('DeleteBucket', 'DeleteBucketPolicy', 'DeleteBucketWebsite') AND userIdentity.type != 'AWSService' AND requestParameters.bucketName LIKE '%prod%'"
output:
  alert_title: "CRITICAL: Bucket {{requestParameters.bucketName}} deleted by {{userIdentity.userName}}"
```

### Ví Dụ 4: Minimal Rule (Chỉ Required Fields)

```yaml
id: ""
title: "Test Rule"
description: "A minimal test rule"
author: "Test User"
status: "experimental"
date: "2026-01-05"
tags: []
detection:
  severity: "low"
  condition: "eventName = 'TestEvent'"
```

---

## Quy Tắc Validation

### ✅ Rules Hợp Lệ

1. **Tất cả required fields phải có giá trị**
2. **Severity phải là một trong**: `critical`, `high`, `medium`, `low`, `info`
3. **Status phải là một trong**: `active`, `disabled`, `experimental`, `deprecated`
4. **Date phải theo format**: `YYYY-MM-DD`
5. **Condition phải là SQL WHERE clause hợp lệ**
6. **Nếu có aggregation, phải có đủ 3 fields**: `enabled`, `window`, `threshold`

### ❌ Lỗi Thường Gặp

1. **Missing required fields**
   ```yaml
   # ❌ SAI - thiếu description
   id: "123"
   title: "Test"
   author: "Me"
   ```

2. **Invalid severity**
   ```yaml
   # ❌ SAI - severity không hợp lệ
   detection:
     severity: "super-critical"  # Phải là: critical, high, medium, low, info
   ```

3. **Invalid SQL condition**
   ```yaml
   # ❌ SAI - syntax SQL sai
   detection:
     condition: "WHERE eventName = ConsoleLogin"  # Không cần WHERE, thiếu quotes
   
   # ✅ ĐÚNG
   detection:
     condition: "eventName = 'ConsoleLogin'"
   ```

4. **Incomplete aggregation**
   ```yaml
   # ❌ SAI - thiếu threshold
   detection:
     aggregation:
       enabled: true
       window: "5m"
   
   # ✅ ĐÚNG
   detection:
     aggregation:
       enabled: true
       window: "5m"
       threshold: "> 5"
   ```

---

## Import Rules Vào Ứng Dụng

### Cách 1: Import Single Rule File

1. Lưu rule dưới dạng file `.yaml` hoặc `.yml`
2. Trong ứng dụng, vào **Rules** page
3. Click nút **📥 Import**
4. Chọn file YAML
5. Chọn có overwrite nếu rule ID đã tồn tại

### Cách 2: Import Multiple Rules (ZIP)

1. Tạo file ZIP chứa nhiều file `.yaml`
2. Cấu trúc ZIP:
   ```
   rules.zip
   ├── rule1.yaml
   ├── rule2.yaml
   └── rule3.yaml
   ```
3. Click **📥 Import** và chọn file `.zip`
4. Chọn overwrite option nếu cần

### Xử Lý Lỗi Import

Nếu import thất bại, kiểm tra:

1. **File format**: Đảm bảo là YAML hợp lệ (không phải JSON)
2. **Required fields**: Tất cả trường bắt buộc đều có
3. **Syntax**: SQL condition phải hợp lệ
4. **Encoding**: File phải là UTF-8
5. **Duplicate ID**: Nếu rule ID đã tồn tại, chọn overwrite

---

## Tips và Best Practices

### 1. Naming Conventions

- **Title**: Ngắn gọn, mô tả chính xác (< 80 ký tự)
- **Description**: Chi tiết, giải thích context và impact
- **Tags**: Lowercase, dùng dấu gạch ngang thay vì space

### 2. SQL Conditions

- **Test trước**: Dùng Investigation page để test SQL query trước khi tạo rule
- **Performance**: Tránh dùng `LIKE '%pattern%'` (slow), ưu tiên `=` hoặc `IN`
- **Indexes**: Điều kiện trên indexed fields sẽ nhanh hơn

### 3. Severity Guidelines

- **Critical**: Immediate threat, potential data breach, system compromise
- **High**: Serious security issue, requires prompt action
- **Medium**: Notable security event, should be investigated
- **Low**: Minor security concern, informational
- **Info**: Audit trail, compliance logging

### 4. Aggregation Usage

Chỉ dùng aggregation khi:
- Phát hiện brute force / credential stuffing
- Phát hiện DDoS / flooding
- Phát hiện scanning activities
- Threshold-based anomalies

**Không dùng** aggregation cho:
- Single critical events (ví dụ: root login)
- Policy violations
- Configuration changes

### 5. Testing Rules

Trước khi deploy rule:

1. **Test với sample data**: Dùng Rule Testing UI
2. **Verify false positives**: Đảm bảo không quá nhiều false alerts
3. **Check performance**: Rule không làm chậm scan
4. **Document exceptions**: Ghi chú các trường hợp đặc biệt

---

## Tham Khảo Thêm

- **DuckDB SQL Syntax**: https://duckdb.org/docs/sql/introduction
- **JSON Path Expressions**: Để truy cập nested fields trong logs
- **Sigma Rules**: Tham khảo format tương tự từ Sigma project

---

## Changelog

- **2026-01-05**: Tạo tài liệu ban đầu
- **Version**: 1.0

---

## Hỗ Trợ

Nếu gặp vấn đề khi import rules:

1. Kiểm tra logs trong terminal (khi chạy `npm run tauri dev`)
2. Xem CONFIGURATION_GUIDE.md để biết thêm về cấu hình
3. Tham khảo DEBUG_GUIDE.md để debug issues
