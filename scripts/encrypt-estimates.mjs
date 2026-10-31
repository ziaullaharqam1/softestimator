// Encrypt the published estimate PDFs into estimates/*.enc (safe to commit).
// Usage: ESTIMATES_KEY=<base64 32 bytes> node scripts/encrypt-estimates.mjs <dir-with-pdfs>
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { FILES, encrypt } from "../api/_lib/estimates.js";

const src = process.argv[2];
if (!src) throw new Error("Pass the folder that holds the v1.0 PDFs");
await mkdir("estimates", { recursive: true });
for (const f of FILES) {
  const out = path.join("estimates", `${f.file}.enc`);
  await writeFile(out, encrypt(await readFile(path.join(src, f.file))));
  console.log("encrypted", out);
}
