import { credentialsMatch, isLoggedIn, noStore, page, sessionCookie } from "../_lib/estimates.js";

function form(error) {
  return page(
    "Sign in · Estimates",
    `<h1>Platform estimate v1.0</h1><p>These documents are private. Sign in to continue.</p>
${error ? `<div class="err">${error}</div>` : ""}
<form method="post" action="/estimates/login">
<label for="user">Username</label><input id="user" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
<label for="pw" style="margin-top:14px">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Sign in</button></form>
<p class="muted" style="margin-top:18px">SoftEstimator</p>`
  );
}

function readForm(req) {
  const b = req.body;
  if (b && typeof b === "object") return b;
  if (typeof b === "string") return Object.fromEntries(new URLSearchParams(b));
  return {};
}

export default async function handler(req, res) {
  noStore(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (req.method === "POST") {
    const { username, password } = readForm(req);
    if (credentialsMatch(username, password)) {
      res.setHeader("Set-Cookie", sessionCookie());
      res.statusCode = 303;
      res.setHeader("Location", "/estimates");
      return res.end();
    }
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    res.statusCode = 401;
    return res.end(form("Incorrect username or password."));
  }
  if (isLoggedIn(req)) {
    res.statusCode = 303;
    res.setHeader("Location", "/estimates");
    return res.end();
  }
  res.statusCode = 200;
  res.end(form());
}
