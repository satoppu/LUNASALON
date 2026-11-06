// App-level login, replacing Apache's HTTP Basic Auth in front of the site.
// Basic Auth's credential prompt isn't reliably remembered by iOS's
// "ホーム画面に追加" standalone web-app mode (a known WebKit limitation — it
// doesn't share Safari's saved-credential cache the way a normal browser tab
// does), so every launch re-prompts. A plain cookie doesn't have that
// problem: the standalone app's own WKWebView keeps a persistent cookie jar
// tied to the site, so logging in once here really does stick.
import crypto from "node:crypto";

const COOKIE_NAME = "luna_session";
// 400 days is the longest any browser will actually honor for a cookie's
// Max-Age/Expires (Chrome/Safari both cap it there) — the practical ceiling
// for "ask once, never again".
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function sign(value) {
  const mac = crypto.createHmac("sha256", sessionSecret()).update(value).digest("hex");
  return `${value}.${mac}`;
}

function verify(token) {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const value = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expectedMac = crypto.createHmac("sha256", sessionSecret()).update(value).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expectedMac);
  return value === process.env.DASHBOARD_USER && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function requireAuth(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (verify(cookies[COOKIE_NAME])) return next();
  } catch {
    // SESSION_SECRET not configured — fail closed, same as no cookie.
  }
  res.status(401).json({ error: "ログインが必要です。" });
}

export function login(req, res) {
  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;
  if (!expectedUser || !expectedPassword || !process.env.SESSION_SECRET) {
    return res.status(500).json({ error: "サーバー側でDASHBOARD_USER/DASHBOARD_PASSWORD/SESSION_SECRETが設定されていません。" });
  }
  const { username, password } = req.body || {};
  if (username !== expectedUser || password !== expectedPassword) {
    return res.status(401).json({ error: "ユーザー名またはパスワードが違います。" });
  }
  // Not marked Secure: the site currently runs over plain HTTP, and a
  // Secure cookie is silently dropped by the browser on http:// — add
  // `secure: true` here if the site later moves to HTTPS.
  res.cookie(COOKIE_NAME, sign(expectedUser), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS * 1000,
  });
  res.json({ ok: true });
}
