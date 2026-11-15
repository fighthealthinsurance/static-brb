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
- `el-nino.html`, `migration.html`, `brb-pbs.html`: one page per story, to
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

- `wrangler.jsonc`, `src/worker.js`, `.assetsignore`: the same site as a
  Cloudflare Worker with static assets (see below). The Worker serves the
  page named by the `STORY` variable (default `el-nino`) for every path, with
  a 503 and `Retry-After`; `/el-nino.html`, `/migration.html` and
  `/brb-pbs.html` still show their own story, for previews.
  `.assetsignore` keeps the repository's own files (this README, the
  config, `.git`) from being uploaded as public assets.

Everything but this README, `_headers`, `functions/` and the Worker files
is generated.

## Changing the story

The pages are rendered from the main repository's templates, so the copy
lives there (`fighthealthinsurance/templates/brb/`). From its root, with
this checkout beside it:

```bash
python manage.py render_brb_static --out ../static-brb --story MIGRATION
```

`--story` is one of `EL_NINO`, `MIGRATION` or `BRB`; spelling is forgiven.
The command writes the PBS story as `brb.html`; here it lives at
`brb-pbs.html`, so rename it (and delete `brb.html`) before committing.
Commit and push the result; the host redeploys from `main`.

## Deploying as a Cloudflare Worker

In the dashboard, Workers & Pages, Create, import this repository, with:

- Worker name: `static-brb` (must match `name` in `wrangler.jsonc`)
- Build command: empty
- Deploy command: `npx wrangler deploy`
- Preview command (non-production branches): `npx wrangler preview`,
  with Enable Preview Builds checked (Settings, Build, Branch control)
- Root directory: `/`

Pushes to `main` deploy; other branches get a Preview with its own URL.
Previews read the `previews` block of `wrangler.jsonc` rather than the
production settings, so they show the default story, `el-nino`, whatever
`STORY` says. To change which
story every path shows, set `STORY` in `wrangler.jsonc` (`el-nino`,
`migration` or `brb-pbs`; `EL_NINO`, `BRB` and the like are forgiven) and push,
or override it in the dashboard under the Worker's Settings, Variables and
Secrets. A dashboard override lasts only until the next deploy, which puts
back the value in `wrangler.jsonc`. Locally, `npx wrangler dev` (add `--var STORY:migration` to try
another) serves it on `localhost:8787`.

To point the site at it:

1. In the zone's DNS, note the record for `www.fighthealthinsurance.com`
   (type, target, proxied or not), so it can be put back. If it is a
   CNAME, delete it: Cloudflare won't add a custom domain over one.
2. On the Worker's Settings, Domains & Routes, add
   `www.fighthealthinsurance.com` as a custom domain (and the apex too if
   it should show the page; each hostname is added on its own). Cloudflare
   creates the DNS record for it.
3. When the site is back: remove the custom domain, check the zone's DNS,
   and recreate the record noted in step 1. Removing the domain doesn't
   bring the old record back. Its certificate stays behind too; delete it
   under SSL/TLS, Edge Certificates if it isn't wanted.

## Pointing Cloudflare here (Pages)

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
