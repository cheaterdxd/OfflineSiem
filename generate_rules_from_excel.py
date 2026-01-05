#!/usr/bin/env python3
"""
Script to generate SIEM rule files from Excel threat model.
Reads threat cases from Excel and creates YAML rule files.
"""

import pandas as pd
import os
import re
from pathlib import Path

# Configuration
EXCEL_FILE = r"d:\root_folder\rieng\code\OfflineSiem\rules\Khách - Release - Threat model cho Kiến trúc Oncloud HDBank - Threat case final.xlsx"
OUTPUT_DIR = r"d:\root_folder\rieng\code\OfflineSiem\rules"

def sanitize_filename(text):
    """Convert text to valid filename by replacing special chars with underscore."""
    # Replace spaces and special characters with underscore
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s]+', '_', text)
    return text.lower()

def extract_query_from_description(query_text):
    """Extract and clean the query condition from the description."""
    if pd.isna(query_text) or not query_text:
        return ""
    
    # Remove extra whitespace
    query = str(query_text).strip()
    
    # Convert LIKE to CONTAINS if present
    if 'LIKE' in query.upper():
        # Replace LIKE '%pattern%' with CONTAINS 'pattern'
        query = re.sub(r"LIKE\s+'%([^%]+)%'", r"CONTAINS '\1'", query, flags=re.IGNORECASE)
        query = re.sub(r'LIKE\s+"%([^%]+)%"', r'CONTAINS "\1"', query, flags=re.IGNORECASE)
    
    return query

def create_rule_yaml(row_data, filename):
    """Create a YAML rule file from row data."""
    
    # Extract data from columns
    col1 = str(row_data.iloc[0]) if not pd.isna(row_data.iloc[0]) else ""
    col2 = str(row_data.iloc[1]) if not pd.isna(row_data.iloc[1]) else ""
    col3 = str(row_data.iloc[2]) if not pd.isna(row_data.iloc[2]) else "No description"
    col4 = str(row_data.iloc[3]) if not pd.isna(row_data.iloc[3]) else ""
    # col5 is JSON log - skip for now
    # col6 (index 6) - skip
    col8_query = str(row_data.iloc[7]) if len(row_data) > 7 and not pd.isna(row_data.iloc[7]) else ""
    
    # Create title from col3 or combination of col1 and col2
    title = col3 if col3 and col3 != "No description" else f"{col1} {col2}"
    title = title[:100]  # Limit title length
    
    # Create description from col3 and col4
    description = f"{col3}. {col4}" if col4 else col3
    description = description[:500]  # Limit description length
    
    # Extract and clean query
    condition = extract_query_from_description(col8_query)
    if not condition:
        condition = "eventName = 'UnknownEvent'"  # Default condition
    
    # Determine severity based on keywords
    severity = "medium"
    if any(word in title.lower() for word in ['critical', 'admin', 'root', 'delete', 'destroy']):
        severity = "high"
    elif any(word in title.lower() for word in ['create', 'modify', 'attach', 'policy']):
        severity = "medium"
    else:
        severity = "low"
    
    # Create YAML content
    yaml_content = f'''id: ""
title: "{title}"
description: "{description}"
author: "tuanlt26"
status: "active"
date: "2026-01-05"
tags:
  - aws
  - iam
  - threat-model
detection:
  severity: "{severity}"
  condition: "{condition}"
  aggregation:
    enabled: false
output:
  alert_title: "{title}"
'''
    
    # Write to file
    output_path = os.path.join(OUTPUT_DIR, filename)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(yaml_content)
    
    return output_path

def main():
    """Main function to process Excel and generate rule files."""
    
    print(f"Reading Excel file: {EXCEL_FILE}")
    
    try:
        # Read Excel file
        df = pd.read_excel(EXCEL_FILE, sheet_name=0, header=None)
        
        print(f"Found {len(df)} rows in Excel file")
        print(f"Columns: {len(df.columns)}")
        
        # Skip header row (assuming first row is header)
        data_rows = df.iloc[1:]
        
        created_files = []
        skipped_rows = []
        
        print(f"{'='*80}")
        print(f"{'ID':<25} | {'Vietnamese Title':<50} | {'Query'}")
        print(f"{'='*80}")
        
        cases_data = []

        for idx, row in data_rows.iterrows():
            try:
                # Get col1 and col2 for filename
                col1 = str(row.iloc[0]) if not pd.isna(row.iloc[0]) else ""
                col2 = str(row.iloc[1]) if not pd.isna(row.iloc[1]) else ""
                
                # Skip if both columns are empty
                if not col1 and not col2:
                    continue
                
                # Create filename base
                filename_base = f"{col1}_{col2}".strip('_')
                filename_base = sanitize_filename(filename_base)
                
                # Get Description info
                col3 = str(row.iloc[2]) if not pd.isna(row.iloc[2]) else "No description"
                col4 = str(row.iloc[3]) if not pd.isna(row.iloc[3]) else ""
                col8_query = str(row.iloc[7]) if len(row) > 7 and not pd.isna(row.iloc[7]) else ""

                
                print(f"{filename_base:<25} | {col3[:47]:<50}...")
                cases_data.append({
                    "id": filename_base,
                    "title_vn": col3,
                    "desc": col4,
                    "orig_query": col8_query
                })
                
            except Exception as e:
                print(f"✗ Error processing row {idx}: {e}")
                continue

        # Write detailed data to file for analysis
        with open('rule_analysis.txt', 'w', encoding='utf-8') as f:
            f.write("DETAILED CASE ANALYSIS FOR MAPPING:\n")
            for case in cases_data:
                f.write(f"\n--- CASE: {case['id']} ---\n")
                f.write(f"VN_TITLE: {case['title_vn']}\n")
                f.write(f"DESC: {case['desc']}\n")
                f.write(f"QUERY: {case['orig_query']}\n")
        
        print("Analysis written to rule_analysis.txt")


        
        # Summary
        print(f"\n{'='*60}")
        print(f"Summary:")
        print(f"  Total rows processed: {len(data_rows)}")
        print(f"  Rules created: {len(created_files)}")
        print(f"  Rows skipped: {len(skipped_rows)}")
        print(f"{'='*60}")
        
        if created_files:
            print(f"\nCreated files:")
            for f in created_files[:10]:  # Show first 10
                print(f"  - {f}")
            if len(created_files) > 10:
                print(f"  ... and {len(created_files) - 10} more")
        
    except FileNotFoundError:
        print(f"ERROR: Excel file not found: {EXCEL_FILE}")
        return 1
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
