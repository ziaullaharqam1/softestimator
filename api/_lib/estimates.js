import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Published estimate files. Only names listed here can be served.
export const FILES = [
  { id: "deck-with-logo", title: "Estimate deck (with client logo)", file: "Platform-Estimate-Deck-v1.0-with-logo.pdf" },
  { id: "deck-no-logo", title: "Estimate deck (no logo)", file: "Platform-Estimate-Deck-v1.0-no-logo.pdf" },
  { id: "solution-package", title: "Solution package (HLD, SOW, security, BoQ, RFC, RFP, SDLC)", file: "Platform-Solution-Package-v1.0.pdf" },
];

const COOKIE = "est_session";
const SESSION_SECONDS = 8 * 60 * 60;

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const sha256 = (s) => createHash("sha256").update(s).digest();

export function passwordMatches(candidate) {
  // Hash both sides so the comparison is constant-time regardless of length.
  return timingSafeEqual(sha256(String(candidate ?? "")), sha256(env("ESTIMATES_PASSWORD")));
}

function sign(exp) {
  return createHmac("sha256", env("ESTIMATES_SESSION_SECRET")).update(`v1:${exp}`).digest("base64url");
}

export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/estimates; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearCookie = `${COOKIE}=; Path=/estimates; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export function isLoggedIn(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const want = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

// Encrypted file layout: 12-byte IV | ciphertext | 16-byte GCM tag. Key: ESTIMATES_KEY (base64, 32 bytes).
function key() {
  const k = Buffer.from(env("ESTIMATES_KEY"), "base64");
  if (k.length !== 32) throw new Error("ESTIMATES_KEY must be 32 bytes (base64)");
  return k;
}

export function encrypt(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([iv, c.update(plain), c.final(), c.getAuthTag()]);
}

export async function readDecrypted(file) {
  const blob = await readFile(path.join(process.cwd(), "estimates", `${file}.enc`));
  const d = createDecipheriv("aes-256-gcm", key(), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(blob.length - 16));
  return Buffer.concat([d.update(blob.subarray(12, blob.length - 16)), d.final()]);
}

export function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title}</title><style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#0B1F3B;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px}
.card{width:100%;max-width:520px;border:1px solid #E3E8EE;border-top:4px solid #4CB819;border-radius:10px;padding:28px}
h1{font-size:22px;margin:0 0 6px}p{color:#3D4B5E;line-height:1.5;margin:0 0 18px}
label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
input{width:100%;font-size:16px;padding:11px 12px;border:1px solid #C9D2DC;border-radius:7px}
input:focus{outline:2px solid #2A9FC6;border-color:#2A9FC6}
button,.btn{display:inline-block;margin-top:14px;background:#0B1F3B;color:#fff;border:0;border-radius:7px;padding:11px 18px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none}
.err{background:#FDECEC;color:#9B1C1C;border-radius:6px;padding:9px 12px;font-size:14px;margin-bottom:14px}
ul{list-style:none;padding:0;margin:0 0 8px}li{border-bottom:1px solid #E3E8EE;padding:12px 0;display:flex;justify-content:space-between;gap:12px;align-items:center}
li span{font-size:14px;color:#3D4B5E}li a{color:#2A9FC6;font-weight:600;font-size:14px;white-space:nowrap;margin-left:10px}
.muted{font-size:12px;color:#6B7685}.top{display:flex;justify-content:space-between;align-items:baseline}.top a{font-size:13px;color:#6B7685}
</style></head><body><main class="card">${body}</main></body></html>`;
}

export function noStore(res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
}
