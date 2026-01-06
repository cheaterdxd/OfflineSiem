# Fix: Parameter Naming Mismatch Between TypeScript and Rust

## Root Cause

**Tauri requires EXACT parameter name matching between TypeScript and Rust.**

- TypeScript uses **camelCase** (e.g., `filePaths`, `logPath`)
- Rust uses **snake_case** (e.g., `file_paths`, `log_path`)
- Tauri does **NOT** automatically convert between naming conventions

## The Error

```
invalid args 'overwrite' for command 'import_multiple_rules': invalid type: map, expected a boolean
```

This error occurred because:
1. Frontend sent `{ filePaths: [...], overwrite: true }`
2. Rust expected `{ file_paths: [...], overwrite: bool }`
3. Tauri couldn't match `filePaths` → tried to deserialize entire object as `overwrite` → type mismatch error

## Files Fixed

### 1. `src/services/rules.ts`
**Before:**
```typescript
exportRule: async (ruleId: string, destPath: string) => {
    return await invoke("export_rule", { ruleId, destPath });
}
```

**After:**
```typescript
exportRule: async (ruleId: string, destPath: string) => {
    return await invoke("export_rule", { rule_id: ruleId, dest_path: destPath });
}
```

**All parameters fixed:**
- `ruleId` → `rule_id`
- `destPath` → `dest_path`
- `sourcePath` → `source_path`
- `zipPath` → `zip_path`
- `filePaths` → `file_paths`

### 2. `src/services/logService.ts`
**Fixed:**
- `sourcePath` → `source_path`

### 3. `src/services/config.ts`
**Fixed:**
- `configData` → `config_data`
- `filePath` → `file_path`

### 4. `src/services/scan.ts`
**Fixed:**
- `logPath` → `log_path`
- `logType` → `log_type`

## How to Verify

1. Restart the dev server (if running)
2. Try importing multiple YAML rules
3. You should see the confirm dialog FIRST
4. No more "invalid type: map" errors

## Prevention

When adding new Tauri commands:

1. **Check Rust parameter names** in `src-tauri/src/lib.rs`:
   ```rust
   #[tauri::command]
   async fn my_command(
       app_handle: tauri::AppHandle,
       my_param: String,  // ← Use this exact name
   )
   ```

2. **Match exactly in TypeScript**:
   ```typescript
   myCommand: async (myParam: string) => {
       return await invoke("my_command", { my_param: myParam });
       //                                   ^^^^^^^^ Must match Rust
   }
   ```

3. **Never use shorthand if names differ**:
   ```typescript
   // ❌ WRONG - if Rust uses snake_case
   { myParam }
   
   // ✅ CORRECT
   { my_param: myParam }
   ```

## Lesson Learned

Tauri is **NOT** like other frameworks that auto-convert naming conventions. It requires explicit, exact matching between frontend and backend parameter names.
