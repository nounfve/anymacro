import { randomBytes } from "crypto";

const g_contentLength = 1000 * 1000 * 5;
const g_content = randomBytes(g_contentLength).toString();

(() => {
	console.log(`TS char scanner benchmark`);
  const start = process.hrtime();
  for (let i = 0; i < g_contentLength; i++) {
    // const ch = g_content.slice(i, i + 1);
    const ch = g_content.charAt(i);
    while (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      break;
    }
  }
  const stop = process.hrtime();
  const diff = [stop[0] - start[0], stop[1] - start[1]];
  console.log(`one pass through time: ${diff[0] * 1000 + diff[1] / 1000000} ms/op`);
})();
