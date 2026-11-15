// node test.mjs : exercises worker.js with a fake origin. No network.
import worker from "./worker.js";
const ctx = { passThroughOnException() {} };
const req = (url, accept = "text/html") => new Request(url, { headers: { accept } });
let mode;
globalThis.fetch = async () => { if (mode === "throw") throw new Error("connect failed"); return new Response("origin body", { status: mode }); };
const cases = [
  ["healthy page passes through", 200, "https://www.fighthealthinsurance.com/", "text/html", 200, "origin body"],
  ["app 500 is left alone", 500, "https://www.fighthealthinsurance.com/", "text/html", 500, "origin body"],
  ["404 is left alone", 404, "https://www.fighthealthinsurance.com/x", "text/html", 404, "origin body"],
  ["522 shows the page", 522, "https://www.fighthealthinsurance.com/", "text/html", 503, "down for a moment"],
  ["502 on bare domain shows the page", 502, "https://fighthealthinsurance.com/", "text/html", 503, "down for a moment"],
  ["unreachable shows the page", "throw", "https://www.fighthealthinsurance.com/scan", "text/html", 503, "down for a moment"],
  ["script/fetch request gets plain 503", 522, "https://www.fighthealthinsurance.com/api/x", "application/json", 503, "temporarily unavailable"],
  ["api host error passes through", 522, "https://api.fighthealthinsurance.com/", "text/html", 522, "origin body"],
  ["preview flag shows the page on a healthy site", 200, "https://www.fighthealthinsurance.com/?fhi-down-page-preview=1", "text/html", 503, "down for a moment"],
  ["preview flag ignored on other hosts", 200, "https://api.fighthealthinsurance.com/?fhi-down-page-preview=1", "text/html", 200, "origin body"],
];
let bad = 0;
for (const [name, m, url, accept, status, text] of cases) {
  mode = m;
  const r = await worker.fetch(req(url, accept), {}, ctx);
  const body = await r.text();
  const ok = r.status === status && body.includes(text);
  if (!ok) bad++;
  console.log(ok ? "PASS" : "FAIL", name, "->", r.status, r.headers.get("x-fhi-down-page") || "");
}
mode = "throw";
try { await worker.fetch(req("https://api.fighthealthinsurance.com/"), {}, ctx); console.log("FAIL api unreachable should rethrow"); bad++; } catch { console.log("PASS api host unreachable rethrows (Cloudflare shows its own error)"); }
console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
