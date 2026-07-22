// worker/router.ts
var GITHUB_BASE = "https://api.github.com/repos/Nahyun-Park/hablo-content/contents/";
var ALLOWED_PATHS = [/^content\/core\.json$/, /^manifest\.json$/, /^packs\/[A-Za-z0-9.-]+\.json$/];
function isAllowedPath(path) {
  return ALLOWED_PATHS.some((re) => re.test(path));
}
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function passwordMatches(given, expected) {
  return await sha256Hex(given) === await sha256Hex(expected);
}
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "User-Agent": "hablo-admin",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}
async function handleApiRequest(request, env, githubFetch) {
  const url = new URL(request.url);
  if (url.pathname === "/api/login" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (typeof body.password === "string" && await passwordMatches(body.password, env.ADMIN_PASSWORD)) {
      return new Response(null, { status: 204 });
    }
    return json(401, { error: "\uC554\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" });
  }
  const auth = request.headers.get("Authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!await passwordMatches(given, env.ADMIN_PASSWORD)) {
    return json(401, { error: "\uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" });
  }
  if (url.pathname === "/api/file" && request.method === "GET") {
    const path = url.searchParams.get("path") ?? "";
    if (!isAllowedPath(path)) return json(403, { error: "\uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC740 \uACBD\uB85C\uC785\uB2C8\uB2E4" });
    const target = `${GITHUB_BASE}${path}?ref=main`;
    const metaRes = await githubFetch(target, { headers: githubHeaders(env) });
    if (metaRes.status === 404) return json(404, { error: "\uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4" });
    if (!metaRes.ok) return json(502, { error: `GitHub \uC624\uB958 ${metaRes.status}` });
    const meta = await metaRes.json();
    const rawRes = await githubFetch(target, {
      headers: { ...githubHeaders(env), Accept: "application/vnd.github.raw+json" }
    });
    if (!rawRes.ok) return json(502, { error: `GitHub \uC624\uB958 ${rawRes.status}` });
    return json(200, { sha: meta.sha ?? null, text: await rawRes.text() });
  }
  if (url.pathname === "/api/file" && request.method === "PUT") {
    let editorName = "";
    try {
      editorName = decodeURIComponent(request.headers.get("X-Editor-Name") ?? "").replace(/[\r\n]/g, "").slice(0, 30);
    } catch {
    }
    if (!editorName) return json(400, { error: "\uD3B8\uC9D1\uC790 \uC774\uB984\uC774 \uD544\uC694\uD569\uB2C8\uB2E4" });
    const body = await request.json().catch(() => null);
    if (!body?.path || !body.message || !body.contentBase64) {
      return json(400, { error: "path, message, contentBase64\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4" });
    }
    if (!isAllowedPath(body.path)) return json(403, { error: "\uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC740 \uACBD\uB85C\uC785\uB2C8\uB2E4" });
    const ghRes = await githubFetch(`${GITHUB_BASE}${body.path}`, {
      method: "PUT",
      headers: { ...githubHeaders(env), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `[\uC5B4\uB4DC\uBBFC] ${editorName}: ${body.message}`,
        content: body.contentBase64,
        branch: "main",
        ...body.sha ? { sha: body.sha } : {}
      })
    });
    if (ghRes.status === 409) return json(409, { error: "\uB2E4\uB978 \uAC80\uC218\uC790\uAC00 \uBA3C\uC800 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4" });
    if (!ghRes.ok) return json(502, { error: `GitHub \uC624\uB958 ${ghRes.status}` });
    const result = await ghRes.json();
    return json(200, { sha: result.content?.sha ?? null });
  }
  return json(404, { error: "\uC54C \uC218 \uC5C6\uB294 API \uACBD\uB85C\uC785\uB2C8\uB2E4" });
}

// worker/index.ts
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, fetch);
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  index_default as default
};
