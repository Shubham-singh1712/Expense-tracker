import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('class="card-icon" style="background: rgba(99,102,241,0.1); color: #818cf8;"', 'class="card-icon icon-cyan"')
html = html.replace('class="card-icon" style="background: rgba(16,185,129,0.1); color: #34d399;"', 'class="card-icon icon-emerald"')
html = html.replace('class="card-icon" style="background: rgba(245,158,11,0.1); color: #fbbf24;"', 'class="card-icon icon-violet"')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated index.html")
