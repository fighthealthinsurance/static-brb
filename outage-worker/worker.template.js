/**
 * Fight Health Insurance: a real "we are down" page.
 *
 * Cloudflare sits in front of the site. When the origin cannot be reached it
 * returns a bare 52x error code, and on 2026-09-25 that is what visitors saw
 * for nine hours. This Worker passes every request through to the origin
 * unchanged and, only when the origin fails (a 52x/53x from Cloudflare, or no
 * connection at all), answers with the page below instead.
 *
 * It changes nothing for a healthy origin: same request, same response,
 * headers and status untouched. Static assets and the API go through as well;
 * only the failure branch differs, where a browser page request gets HTML and
 * anything else gets a plain 503 so scripts and fetches fail cleanly.
 */

const RETRY_AFTER_SECONDS = 300;

// Only these hosts get the page. Anything else that reaches the Worker (api, staging, a
// wildcard route by mistake) is passed through untouched, errors included. dev is listed so
// the Worker can be tried there before it is routed on the live hosts.
const PAGE_HOSTS = new Set(["www.fighthealthinsurance.com", "fighthealthinsurance.com", "dev.fighthealthinsurance.com"]);

export default {
  async fetch(request, env, ctx) {
    // If this Worker itself throws, Cloudflare sends the request to the origin as if the
    // Worker were not there.
    ctx.passThroughOnException();
    const url = new URL(request.url);
    const pageHost = PAGE_HOSTS.has(url.hostname);
    // Preview: add ?fhi-down-page-preview=1 to any page on these hosts to see the down page
    // without an outage. It never reaches the origin.
    if (pageHost && url.searchParams.get("fhi-down-page-preview") === "1") {
      return downPage(request, "preview");
    }
    let response;
    try {
      response = await fetch(request);
    } catch (err) {
      if (!pageHost) throw err;
      return downPage(request);
    }
    // 520-530 are Cloudflare's "origin unreachable / misbehaving" family;
    // 502-504 are the same story told by a gateway in between.
    // A plain 500 is the app's own error page and is left alone.
    const originDown = (response.status >= 520 && response.status <= 530) || [502, 503, 504].includes(response.status);
    if (pageHost && originDown) {
      return downPage(request, response.status);
    }
    return response;
  },
};

function downPage(request, originStatus) {
  const wantsHtml = (request.headers.get("accept") || "").includes("text/html");
  const headers = {
    "cache-control": "no-store",
    "retry-after": String(RETRY_AFTER_SECONDS),
    "x-robots-tag": "noindex",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    // Lets us tell this page apart from a real origin 503 when debugging.
    "x-fhi-down-page": originStatus ? String(originStatus) : "unreachable",
  };
  if (!wantsHtml) {
    return new Response("Fight Health Insurance is temporarily unavailable.\n", {
      status: 503,
      headers: { ...headers, "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(PAGE, {
    status: 503,
    headers: { ...headers, "content-type": "text/html; charset=utf-8" },
  });
}

const PAGE = __PAGE__;
