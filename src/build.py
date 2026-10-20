"""把 src/ 里的文件拼成单文件网页。

输出两个版本：
  index.html          完整 HTML 文档，给 GitHub Pages 用
  minke-academy.html  不带 <html>/<head> 外壳的片段，给 claude.ai Artifact 用（发布时会自动补外壳）
"""
from pathlib import Path
from urllib.parse import quote

here = Path(__file__).resolve().parent
root = here.parent
read = lambda name: (here / name).read_text(encoding="utf-8")

SITE = "https://polaris-aeterna.github.io/minke-academy/"
DESC = "一栋永远在筹备中的民间科学院：36 份理论档案，16 个能乱点的房间，8 种世界观，44 个隐藏成就。"

page = read("shell.html")
page = page.replace("/*__CSS__*/", read("style.css"))
page = page.replace("/*__DATA__*/", read("data.js"))
page = page.replace("/*__APP__*/", read("app.js"))
head, body = page.split("<!--__BODY__-->", 1)

# Artifact 版本：直接拼起来
fragment = head + body
(root / "minke-academy.html").write_text(fragment, encoding="utf-8")

# GitHub Pages 版本：补上文档外壳、基础 reset、描述与图标
icon_svg = (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
    "<circle cx='32' cy='32' r='27' fill='none' stroke='#d0121a' stroke-width='5'/>"
    "<text x='32' y='43' font-size='30' font-weight='900' text-anchor='middle' fill='#d0121a' font-family='serif'>民</text>"
    "</svg>"
)
icon = "data:image/svg+xml," + quote(icon_svg)
full = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#d0121a">
<meta property="og:type" content="website">
<meta property="og:title" content="互联网民间科学院（筹）">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{SITE}">
<link rel="icon" href="{icon}">
<style>
:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}
body{{margin:0}}
img{{max-width:100%}}
[hidden]{{display:none!important}}
</style>
{head.strip()}
</head>
<body>
{body.strip()}
</body>
</html>
"""
(root / "index.html").write_text(full, encoding="utf-8")

for name in ("index.html", "minke-academy.html"):
    print(f"wrote {name}: {(root / name).stat().st_size / 1024:.1f} KB")
