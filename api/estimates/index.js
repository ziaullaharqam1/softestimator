import { FILES, isLoggedIn, noStore, page } from "../_lib/estimates.js";

export default function handler(req, res) {
  noStore(res);
  if (!isLoggedIn(req)) {
    res.statusCode = 303;
    res.setHeader("Location", "/estimates/login");
    return res.end();
  }
  const rows = FILES.map(
    (f) => `<li><span>${f.title}</span><span><a href="/estimates/files/${f.id}">View</a><a href="/estimates/files/${f.id}?download=1">Download</a></span></li>`
  ).join("");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    page(
      "Estimates",
      `<div class="top"><h1>Platform estimate v1.0</h1><a href="/estimates/logout">Sign out</a></div>
<p>Prices dated 31 Oct 2026 · AED · excl. VAT</p><ul>${rows}</ul><p class="muted">Session expires after 8 hours.</p>`
    )
  );
}
