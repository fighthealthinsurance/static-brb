#!/usr/bin/env python3
"""Builds worker.js (what Cloudflare runs) from worker.template.js + page.html + timbit-404.jpg.
The photo is inlined as a data URI because nothing can load from the site while it is down.
Also writes preview.html, the page exactly as visitors would see it."""
import base64, json, pathlib
here = pathlib.Path(__file__).parent
img = "data:image/jpeg;base64," + base64.b64encode((here / "timbit-404.jpg").read_bytes()).decode()
page = (here / "page.html").read_text().replace('src="timbit-404.jpg"', f'src="{img}"')
assert img in page, "photo placeholder not found in page.html"
(here / "preview.html").write_text(page)
(here / "worker.js").write_text((here / "worker.template.js").read_text().replace("__PAGE__", json.dumps(page)))
print("worker.js", (here / "worker.js").stat().st_size, "bytes")
