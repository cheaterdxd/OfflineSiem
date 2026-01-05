# Sample Rules for OfflineSiem

This directory contains sample detection rules that demonstrate the proper YAML format for importing into OfflineSiem.

## Available Sample Rules

1. **aws_console_login.yaml** - Detects AWS console login events (Info severity)
2. **aws_brute_force.yaml** - Detects API brute force attempts with aggregation (High severity)
3. **s3_bucket_deletion.yaml** - Detects deletion of production S3 buckets (Critical severity)
4. **iam_policy_change.yaml** - Detects IAM policy modifications (Medium severity)
5. **root_account_usage.yaml** - Detects AWS root account usage (High severity)

## How to Use

### Import Individual Rule
1. Open OfflineSiem application
2. Navigate to **Rules** page
3. Click **📥 Import** button
4. Select one of the `.yaml` files from this directory
5. Confirm the import

### Import All Rules as ZIP
1. Create a ZIP file containing all `.yaml` files:
   ```powershell
   Compress-Archive -Path .\sample_rules\*.yaml -DestinationPath sample_rules.zip
   ```
2. In OfflineSiem, click **📥 Import**
3. Select the `sample_rules.zip` file
4. Choose whether to overwrite existing rules

## Testing Rules

After importing, you can test these rules:

1. Go to **Investigation** page
2. Load your CloudTrail JSON logs
3. Go back to **Rules** page
4. Click the **Preview** (▶) button on any rule
5. Use the **Test Rule** feature to see matches

## Customization

Feel free to modify these rules:
- Change severity levels
- Adjust conditions to match your environment
- Add more tags for better organization
- Modify aggregation thresholds
- Customize alert titles

## Documentation

For detailed information about rule format, see:
- **RULE_FORMAT_GUIDE.md** - Complete rule format specification
- **CONFIGURATION_GUIDE.md** - Application configuration
- **DEBUG_GUIDE.md** - Debugging and troubleshooting

## Best Practices

1. **Test before deploying**: Always test rules with sample data first
2. **Use appropriate severity**: Don't over-classify everything as critical
3. **Add meaningful tags**: Makes filtering and management easier
4. **Document your rules**: Good descriptions help future maintenance
5. **Version control**: Keep your rules in git for change tracking
