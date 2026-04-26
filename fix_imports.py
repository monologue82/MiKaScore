
import os
import re

def fix_imports(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Regex to find import statements without .js extension
    # Matches: import { ... } from "./module" or import * as ... from "./module"
    def replace_func(match):
        path = match.group(2)
        if not path.endswith('.js') and '.' in path and not path.endswith('.css') and not path.endswith('.json'):
            return f'{match.group(1)}{path}.js{match.group(3)}'
        return match.group(0)
    
    # Fix import statements
    content = re.sub(r'(import\s+.*?from\s+["\'])([^"\']+)(["\'])', replace_func, content)
    # Fix export statements
    content = re.sub(r'(export\s+.*?from\s+["\'])([^"\']+)(["\'])', replace_func, content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Fixed: {file_path}')

# Process all .js files in app/static/js/reze-engine
reze_engine_dir = r'd:\MiKaScore\app\static\js\reze-engine'
for root, dirs, files in os.walk(reze_engine_dir):
    for file in files:
        if file.endswith('.js'):
            file_path = os.path.join(root, file)
            fix_imports(file_path)

