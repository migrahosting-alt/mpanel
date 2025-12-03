#!/usr/bin/env python3
"""
Fix TypeScript compilation errors systematically
"""
import re
import os
from pathlib import Path

def fix_controller_returns(file_path):
    """Add return statements before res.json() and res.status().json() calls"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    original = content
    
    # Fix patterns like: res.json( -> return res.json(
    # But avoid: return res.json( (already has return)
    content = re.sub(
        r'(\s+)(res\.json\()',
        lambda m: m.group(1) + 'return ' + m.group(2) if 'return' not in m.string[max(0, m.start()-20):m.start()] else m.group(0),
        content
    )
    
    # Fix patterns like: res.status(404).json( -> return res.status(404).json(
    content = re.sub(
        r'(\s+)(res\.status\([^)]+\)\.json\()',
        lambda m: m.group(1) + 'return ' + m.group(2) if 'return' not in m.string[max(0, m.start()-20):m.start()] else m.group(0),
        content
    )
    
    if content != original:
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    base_dir = Path('src/modules')
    
    print("Fixing controller return statements...")
    fixed_count = 0
    
    for controller_file in base_dir.rglob('*.controller.ts'):
        if fix_controller_returns(controller_file):
            fixed_count += 1
            print(f"  Fixed: {controller_file}")
    
    print(f"\nFixed {fixed_count} controller files")
    print("\nNote: Service file database access errors require manual review")
    print("The pattern 'prisma.table.method()' needs table models defined in Prisma schema")

if __name__ == '__main__':
    main()
