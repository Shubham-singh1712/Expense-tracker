import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Update dash-header to match Figma ScreenShell styling
new_header = '''<div class="dash-header" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
            <div>
              <p style="display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); padding: 4px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.18em; color: var(--brand); margin-bottom: 8px;">✦ Live backend</p>
              <h1 class="screen-title" style="margin-bottom: 4px;">Good morning, <span id="dashProfileName">User</span></h1>
              <p style="color: var(--text-muted); font-size: 0.875rem; line-height: 1.5; margin-top: 4px;">Financial overview • <span id="dashMonthLabel">May 2026</span></p>
            </div>
          </div>'''

html = re.sub(r'<div class="dash-header">\s*<div>\s*<h1 class="login-heading"[^>]*>Good morning, <span id="dashProfileName">User</span></h1>\s*<p[^>]*>Financial overview • <span id="dashMonthLabel">May 2026</span></p>\s*</div>\s*<span class="status-pill saved"[^>]*>✦ AI Active</span>\s*</div>', new_header, html)

# Update sidebar styling
html = html.replace('style="color: #6366f1;"', 'style="color: var(--brand);"')

# Fix auth screen gradient text and glow
html = html.replace('linear-gradient(135deg, #a5b4fc, #6366f1)', 'linear-gradient(135deg, var(--brand), #a5f3fc)')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Updated index.html headers')
