// node test.mjs : exercises worker.js with a fake origin. No network.
// A Node mock cannot check WebSocket upgrades; confirm those on dev in the real runtime.
import worker from "./worker.js";
const ctx = { passThroughOnException() {} };
let mode, calls, originResponse;
globalThis.fetch = async (...args) => {
  calls.push(args);
  if (mode === "throw") throw new Error("connect failed");
  originResponse = new Response("origin body", { status: mode, headers: { "x-origin": "yes" } });
  return originResponse;
};
let bad = 0;
const check = (name, ok, note = "") => { if (!ok) bad++; console.log(ok ? "PASS" : "FAIL", name, note); };
const run = async (m, url, init = {}) => {
  mode = m; calls = []; originResponse = undefined;
  const request = new Request(url, { headers: { accept: "text/html" }, ...init });
  return { request, response: await worker.fetch(request, {}, ctx) };
};
const forwarded = (request) => calls.length === 1 && calls[0].length === 1 && calls[0][0] === request;
const WWW = "https://www.fighthealthinsurance.com";

// Healthy and app-error responses: the same Request object goes to the origin, and the
// origin's own Response object comes back.
for (const status of [200, 301, 404, 500]) {
  const { request, response } = await run(status, `${WWW}/x`);
  check(`origin ${status} is passed through untouched`, forwarded(request) && response === originResponse);
}
{
  const { request, response } = await run(200, `${WWW}/scan`, {
    method: "POST", body: "a=1",
    headers: { accept: "text/html", cookie: "sessionid=abc", authorization: "Bearer t", "content-type": "application/x-www-form-urlencoded" },
  });
  check("POST with body, cookie and authorization is forwarded as the same request", forwarded(request) && response === originResponse);
}

// Every failure status shows the page, with the headers that keep it out of caches and search.
const pageOk = (r, body, why) => r.status === 503 && body.includes("down for a moment")
  && r.headers.get("cache-control") === "no-store" && r.headers.get("retry-after") === "300"
  && r.headers.get("x-robots-tag") === "noindex" && r.headers.get("x-fhi-down-page") === why
  && r.headers.get("content-type").startsWith("text/html");
for (const status of [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530]) {
  const { response } = await run(status, `${WWW}/`);
  check(`origin ${status} shows the page`, pageOk(response, await response.text(), String(status)));
}
for (const status of [501, 505, 519, 531]) {
  const { response } = await run(status, `${WWW}/`);
  check(`origin ${status} is left alone`, response === originResponse);
}
for (const host of ["fighthealthinsurance.com", "dev.fighthealthinsurance.com"]) {
  const { response } = await run(522, `https://${host}/`);
  check(`${host} shows the page`, pageOk(response, await response.text(), "522"));
}
{
  const { response } = await run("throw", `${WWW}/scan`);
  check("unreachable shows the page", pageOk(response, await response.text(), "unreachable"));
}
{
  const { response } = await run(522, `${WWW}/api/x`, { headers: { accept: "application/json" } });
  const body = await response.text();
  check("script or API request gets a plain 503", response.status === 503 && body.includes("temporarily unavailable")
    && response.headers.get("content-type").startsWith("text/plain") && response.headers.get("cache-control") === "no-store");
}

// Preview never touches the origin, and only works on the page hosts.
{
  const { response } = await run(200, `${WWW}/?fhi-down-page-preview=1`);
  check("preview shows the page without calling the origin", calls.length === 0 && pageOk(response, await response.text(), "preview"));
}
{
  const { request, response } = await run(200, "https://api.fighthealthinsurance.com/?fhi-down-page-preview=1");
  check("preview is ignored on other hosts", forwarded(request) && response === originResponse);
}

// Other hosts: errors pass through; no connection gives a plain 502, never the page.
{
  const { request, response } = await run(522, "https://api.fighthealthinsurance.com/");
  check("other host error passes through", forwarded(request) && response === originResponse);
}
{
  const { response } = await run("throw", "https://api.fighthealthinsurance.com/");
  const body = await response.text();
  check("other host unreachable gets a plain 502", response.status === 502 && !body.includes("down for a moment") && !response.headers.get("x-fhi-down-page"));
}
console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
