import re

with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Add success and fix danger buttons
btn_styles = '''
.success-button { background: rgba(110, 231, 183, 0.15); color: #a7f3d0; border: 1px solid rgba(110, 231, 183, 0.2); }
.success-button:hover:not(:disabled) { background: rgba(110, 231, 183, 0.22); }

.danger-button { background: rgba(251, 113, 133, 0.12); color: #ffe4e6; border: 1px solid rgba(251, 113, 133, 0.2); }
.danger-button:hover:not(:disabled) { background: rgba(251, 113, 133, 0.20); }
'''
css = re.sub(r'\.danger-button\s*\{.*?(?=\n\.danger-text)', btn_styles.strip() + '\n', css, flags=re.DOTALL)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('family=JetBrains+Mono', 'family=Inter:wght@400;500;600;700&family=JetBrains+Mono')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Updated buttons and fonts")
