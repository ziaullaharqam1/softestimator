import { isLoggedIn, noStore, page, passwordMatches, sessionCookie } from "../_lib/estimates.js";

function form(error) {
  return page(
    "Sign in · Estimates",
    `<h1>Platform estimate v1.0</h1><p>These documents are private. Enter the access password to continue.</p>
${error ? `<div class="err">${error}</div>` : ""}
<form method="post" action="/estimates/login">
<label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Sign in</button></form>
<p class="muted" style="margin-top:18px">SoftEstimator</p>`
  );
}

function readPassword(req) {
  const b = req.body;
  if (b && typeof b === "object") return b.password;
  if (typeof b === "string") return new URLSearchParams(b).get("password");
  return "";
}

export default async function handler(req, res) {
  noStore(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (req.method === "POST") {
    if (passwordMatches(readPassword(req))) {
      res.setHeader("Set-Cookie", sessionCookie());
      res.statusCode = 303;
      res.setHeader("Location", "/estimates");
      return res.end();
    }
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    res.statusCode = 401;
    return res.end(form("Incorrect password."));
  }
  if (isLoggedIn(req)) {
    res.statusCode = 303;
    res.setHeader("Location", "/estimates");
    return res.end();
  }
  res.statusCode = 200;
  res.end(form());
}
