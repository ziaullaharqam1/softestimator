import { clearCookie, noStore } from "../_lib/estimates.js";

export default function handler(req, res) {
  noStore(res);
  res.setHeader("Set-Cookie", clearCookie);
  res.statusCode = 303;
  res.setHeader("Location", "/estimates/login");
  res.end();
}
