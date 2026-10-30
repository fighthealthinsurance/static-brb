# static-brb

The "be right back" page of [Fight Health Insurance](https://www.fighthealthinsurance.com),
as a static site, for when the web tier itself is going away (a server
migration, say) and Cloudflare is pointed here for the duration. While only
the models are down the app serves this page itself, from the `BRB` flag
(`fighthealthinsurance/brb.py` in the main repository); this is the copy
that needs no app at all.

## What is here

- `index.html` and `404.html`: the story the site tells. The 404 copy is
  what GitHub Pages and Cloudflare Pages serve for every other path, so
  a person who arrives at `/scan` sees the page too.
- `el-nino.html`, `migration.html`, `brb.html`: one page per story, to
  preview the others.
- `images/`: the pictures the pages use.
- `_headers`: no-cache and noindex headers, read by Cloudflare Pages
  (GitHub Pages ignores it; the pages say the same in their own `<head>`).
- `functions/_middleware.js`: on Cloudflare Pages, serves the pages with a
  503 and `Retry-After`, the status a site that is down on purpose should
  send, so search engines keep their copy of the real site and look again
  later. A 200 with noindex, which is all a static host can send on its
  own, would drop pages from the index if they were crawled while down.
  GitHub Pages ignores it and serves the page with 200 (404 for the
  fallback), noindex and no-cache; that is fine for a few hours.

Everything but this README, `_headers` and `functions/` is generated.

## Changing the story

The pages are rendered from the main repository's templates, so the copy
lives there (`fighthealthinsurance/templates/brb/`). From its root, with
this checkout beside it:

```bash
python manage.py render_brb_static --out ../static-brb --story MIGRATION
```

`--story` is one of `EL_NINO`, `MIGRATION` or `BRB`; spelling is forgiven.
Commit and push the result; the host redeploys from `main`.

## Pointing Cloudflare here

The steps as of writing (check the host's docs if the UI has moved):

1. Once, ahead of time: in the Cloudflare dashboard, Workers & Pages,
   create a Pages project from this repository, production branch `main`,
   no build command, output directory `/`. The project gets a
   `*.pages.dev` address: open it and check the page, the 503 (in the
   browser's network tab) and the pictures.
2. When the site goes down: on the Pages project, Custom domains, add
   `www.fighthealthinsurance.com` (and `fighthealthinsurance.com` if the
   apex should show it too). Cloudflare replaces the zone's DNS record for
   it with one pointing at the project; note what the record pointed at
   before, so it can be put back.
3. When the site is back: remove the custom domain from the Pages project
   and restore the DNS record. Nothing here was cached, so there is
   nothing to purge.

GitHub Pages works as well (Settings, Pages, deploy from `main`, root, then
set the custom domain there and change the DNS record by hand), without
the 503.
