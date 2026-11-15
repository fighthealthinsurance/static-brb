# Outage Worker

The page a visitor sees when the site goes down without warning.

The rest of this repository is the planned "be right back" site: someone points Cloudflare
at it by hand before a migration. This folder is the unplanned case. A small Cloudflare
Worker sits in front of the site, passes every request through, and answers with a page
of its own only when the site cannot be reached. Without it, visitors get Cloudflare's
bare error screen (on 2026-09-25, for nine hours).

## What it does

| The site answers | The visitor gets |
|---|---|
| anything normal, including the app's own 404 and 500 pages | exactly that, untouched |
| 502, 503, 504, Cloudflare's 520 to 530, or no connection at all | the "We're down for a moment" page, status 503 |
| the same failures, but the request is a script or API call (no `text/html` in Accept) | a one-line plain 503 |
| any failure on a host other than `www`, the bare domain or `dev` | passed through as is |

The 503 carries `Retry-After: 300`, `Cache-Control: no-store` and `X-Robots-Tag: noindex`,
so nothing caches or indexes the outage page. The `x-fhi-down-page` header says why it was
shown (the status the site returned, `unreachable`, or `preview`). If the Worker itself
throws, `passThroughOnException` sends the request on to the site as if the Worker were
not there.

Adding `?fhi-down-page-preview=1` to any address on those hosts shows the page without an
outage. That request never reaches the site.

## Files

- `page.html`: the page. Edit this.
- `timbit-404.jpg`: the photo, the same one the site's 404 page uses.
- `worker.template.js`: the logic.
- `build.py`: run `python3 build.py` after any edit. It writes `worker.js` (the photo is
  inlined, because nothing can load from the site while it is down) and `preview.html`
  (open it to look; not committed).
- `worker.js`: generated, and committed so the deploy needs no build step. Do not edit it.
- `test.mjs`: `node test.mjs` runs the Worker against a fake site. No network.
- `wrangler.jsonc`: deploy settings. No routes, on purpose.

## Setting it up

The steps as of writing (check Cloudflare's docs if the dashboard has moved). Creating
a Worker needs a login with Workers permission on the Cloudflare account.

1. Workers & Pages, Create application, import this repository a second time (the
   `static-brb` Worker at the repository root is the planned be-right-back site and is
   a different thing). Worker name `fhi-down-page` (it must match `name` in this
   folder's `wrangler.jsonc`), root directory `outage-worker`, no build command, deploy
   command `npx wrangler deploy`, production branch `main`. It has no route yet, so
   nothing changes for visitors.
2. Test on dev first. On the Worker, Settings, Domains & Routes, add the route
   `dev.fighthealthinsurance.com/*`. Open `https://dev.fighthealthinsurance.com/?fhi-down-page-preview=1`:
   the page should show. Open dev without that ending: it should load as normal. Then
   take dev down on purpose and load it: the page should show, and `curl -I` should
   show `503` and `x-fhi-down-page`. This is also where to confirm what the docs leave
   unclear: that the Worker still runs for every 52x, that a route works on a host that
   only exists through the wildcard DNS record, and that a later deploy from this
   repository leaves dashboard routes in place.
3. Go live: routes `www.fighthealthinsurance.com/*` and `fighthealthinsurance.com/*`.
   Set each route's failure mode to **Fail open (proceed)**, so that running out of the
   daily request allowance bypasses the Worker and does not show an error.
4. Save requests: add the route `www.fighthealthinsurance.com/static/*` with the Worker
   set to **None**. Static files then skip the Worker and do not count.

## Limits (Workers free plan, from Cloudflare's docs on 2026-11-14)

- 100,000 requests a day, reset at midnight UTC. Every routed request counts, bots
  included. With fail open, going over means the outage page is not available for the
  rest of that day; the site itself is fine. Check the Worker's request graph after a
  few days.
- It cannot help when Cloudflare itself is down, or for hosts with no route.
- A 503 the app returns on purpose is replaced by this page too.
