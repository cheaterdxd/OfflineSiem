# Import Multiple Rules Feature

## Overview
The OfflineSiem application now supports importing multiple rule files simultaneously, making it easier to manage large rule sets.

## Features

### 1. **Multiple File Selection**
- Users can now select multiple YAML rule files at once using Ctrl+Click or Shift+Click
- Previously limited to importing one file at a time

### 2. **Mixed File Type Support**
- Import multiple YAML files (`.yaml`, `.yml`)
- Import ZIP archives (`.zip`)
- Mix both types in a single import operation

### 3. **Batch Processing**
- All selected files are processed in a single operation
- Efficient handling of large rule sets
- Automatic error handling per file

### 4. **Detailed Import Summary**
The import process provides comprehensive feedback:
- ✅ **Success count**: Number of rules successfully imported
- ⏭️ **Skipped**: Rules that already exist (when overwrite is disabled)
- ❌ **Errors**: Detailed error messages for failed imports

## How to Use

### Import Multiple YAML Files

1. Click the **📥 Import** button on the Rules page
2. In the file dialog, select multiple YAML files:
   - **Windows**: Hold `Ctrl` and click files, or use `Shift` for range selection
   - **Mac**: Hold `Cmd` and click files
3. Choose whether to overwrite existing rules with the same ID
4. Review the import summary

### Import ZIP Archive

1. Click the **📥 Import** button
2. Select a ZIP file containing multiple YAML rule files
3. Choose whether to overwrite existing rules
4. Review the import summary

### Mixed Import

You can select both YAML files and ZIP archives in the same import operation. The system will:
1. Process all ZIP archives first
2. Then process individual YAML files
3. Combine results into a single summary

## Technical Details

### Backend (Rust)

**New Function**: `import_multiple_rules()`
- Location: `src-tauri/src/rule_manager.rs`
- Accepts a vector of file paths
- Returns an `ImportSummary` with detailed results
- Handles errors gracefully per file

**Tauri Command**: `import_multiple_rules`
- Exposed to frontend via Tauri IPC
- Registered in `src-tauri/src/lib.rs`

### Frontend (TypeScript/React)

**Service Method**: `ruleService.importMultipleRules()`
- Location: `src/services/rules.ts`
- Accepts array of file paths and overwrite flag
- Returns promise with import summary

**UI Handler**: `handleImportRules()`
- Location: `src/pages/RulesPage.tsx`
- Enables multiple file selection
- Separates ZIP and YAML files
- Displays formatted summary with emojis

## Error Handling

The system handles various error scenarios:

1. **Invalid YAML**: Files that cannot be parsed are reported in errors
2. **Duplicate IDs**: Existing rules are skipped unless overwrite is enabled
3. **File Read Errors**: Inaccessible files are reported with error details
4. **Non-YAML Files**: Files without `.yaml` or `.yml` extension are rejected

## Example Import Summary

```
✅ Import Complete!

📊 Summary:
  • Successfully imported: 15 rules
  • Skipped (already exist): 3 rules
  • Errors: 2 rules

❌ Error Details:
  • tm-001.yaml: Invalid YAML - missing required field 'detection'
  • tm-002.yaml: Cannot read file - Permission denied
```

## Benefits

1. **Time Saving**: Import dozens of rules in one operation
2. **Better UX**: No need to create ZIP files for multiple imports
3. **Transparency**: Clear feedback on what succeeded and what failed
4. **Flexibility**: Mix different file types in one import
5. **Error Recovery**: Failed imports don't stop the entire process

## Backward Compatibility

All existing import methods are preserved:
- ✅ Single YAML file import
- ✅ ZIP archive import
- ✅ New: Multiple YAML files import

## Future Enhancements

Potential improvements for future versions:
- Progress bar for large imports
- Drag-and-drop support
- Import from folder (recursive)
- Import preview before confirmation
- Undo import operation
