// Cloudflare Workers entry point (wrangler.jsonc). Every request comes here
// first, because the assets are configured with run_worker_first.
//
// - A story page asked for by name (/brb.html, /migration.html,
//   /el-nino.html) is served as is, so each one can be previewed.
// - Any other existing file that is not HTML (the pictures) is served as is.
// - Everything else, "/" and /scan alike, gets the page named by STORY.
//
// The story is served at whatever path was asked for, /scan/ included, so a
// <base href="/"> goes into its <head>: the pages' relative image URLs then
// resolve from the site root instead of under /scan/.
//
// HTML goes out as 503 Service Unavailable with Retry-After: a site that is
// down on purpose should say so, so search engines keep their copy of the
// real site and come back later, where a 200 with noindex would drop pages
// crawled meanwhile. Nothing is cached or indexed, so the page is gone the
// moment Cloudflare points back at the site.

const STORIES = ["brb", "migration", "el-nino"];
const DEFAULT_STORY = "brb";

const NO_CACHE = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Robots-Tag": "noindex, nofollow",
};

// "EL_NINO", "El Nino", "el-nino.html" all mean el-nino.
function storyName(value) {
  const name = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.html$/, "")
    .replace(/[\s_]+/g, "-")
    .replace(/ñ/g, "n");
  return STORIES.includes(name) ? name : DEFAULT_STORY;
}

function withHeaders(response, status) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(NO_CACHE)) {
    headers.set(key, value);
  }
  if (status === 503) {
    headers.set("Retry-After", "3600");
  }
  return new Response(response.body, { status: status ?? response.status, headers });
}

function isHtml(response) {
  return (response.headers.get("Content-Type") || "").startsWith("text/html");
}

function rootRelative(response) {
  return new HTMLRewriter()
    .on("head", {
      element(head) {
        head.prepend('<base href="/">', { html: true });
      },
    })
    .transform(response);
}

async function fetchAsset(env, request, path) {
  const url = new URL(path, request.url);
  return env.ASSETS.fetch(new Request(url, { method: request.method === "HEAD" ? "HEAD" : "GET" }));
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    const asked = path.replace(/^\//, "").replace(/\.html$/, "");
    if (path.endsWith(".html") && STORIES.includes(asked)) {
      return withHeaders(rootRelative(await fetchAsset(env, request, path)), 503);
    }

    if (path !== "/" && !path.endsWith(".html")) {
      const asset = await fetchAsset(env, request, path);
      // By Content-Type, not the path: /brb.htm%6c can still reach an HTML
      // file, and HTML always goes out as the story, with its 503.
      if (asset.ok && !isHtml(asset)) {
        return withHeaders(asset);
      }
    }

    const page = await fetchAsset(env, request, `/${storyName(env.STORY)}.html`);
    return withHeaders(rootRelative(page), 503);
  },
};
