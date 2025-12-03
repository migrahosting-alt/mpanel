#!/usr/bin/env python3
import re
from pathlib import Path

def fix_catch_blocks(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    original = content
    
    # Fix: } catch (error) { next(error); } -> } catch (error) { return next(error); }
    # Look for next(error) without return
    content = re.sub(
        r'(\s+)(next\(error\);)',
        lambda m: m.group(1) + 'return ' + m.group(2) if 'return' not in m.string[max(0, m.start()-30):m.start()] else m.group(0),
        content
    )
    
    if content != original:
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    base_dir = Path('src/modules')
    fixed = 0
    
    for controller_file in base_dir.rglob('*.controller.ts'):
        if fix_catch_blocks(controller_file):
            fixed += 1
            print(f"Fixed: {controller_file}")
    
    print(f"\nFixed {fixed} files")

if __name__ == '__main__':
    main()
