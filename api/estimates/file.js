import { FILES, isLoggedIn, noStore, readDecrypted } from "../_lib/estimates.js";

export default async function handler(req, res) {
  noStore(res);
  if (!isLoggedIn(req)) {
    res.statusCode = 303;
    res.setHeader("Location", "/estimates/login");
    return res.end();
  }
  const f = FILES.find((x) => x.id === req.query.name);
  if (!f) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  const pdf = await readDecrypted(f.file);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${f.file}"`);
  res.statusCode = 200;
  res.end(pdf);
}
