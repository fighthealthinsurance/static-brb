// Cloudflare Pages runs this on every request (GitHub Pages ignores it).
//
// The pages are served with 503 Service Unavailable, the status a site that
// is down on purpose should send: search engines then keep their copy of the
// real site and look again after Retry-After, where a 200 with noindex (all a
// static host can send on its own) would drop any page crawled meanwhile from
// the index. Only the HTML changes status; the pictures keep their own, so
// browsers show them.
export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get("Content-Type") || "";
  if (!type.includes("text/html")) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Retry-After", "3600");
  return new Response(response.body, { status: 503, headers });
}
