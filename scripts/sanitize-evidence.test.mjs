import { expect, it } from "vitest";
import { sanitizeEvidence } from "./sanitize-evidence.mjs";

it("retains trace timing while removing URL credentials, query strings, headers and bodies", () => {
  const result = sanitizeEvidence({ dur: 8300, args: { data: { url: "https://user:pass@example.com/a?__clerk_db_jwt=private#secret", requestHeaders: { authorization: "Bearer private" }, postData: "private", stackTrace: [{ functionName: "move", url: "http://localhost/app.js?v=1" }] } } });
  expect(result.dur).toBe(8300);
  expect(result.args.data.url).toBe("https://example.com/a");
  expect(result.args.data.requestHeaders).toBe("[redacted]");
  expect(result.args.data.postData).toBe("[redacted]");
  expect(result.args.data.stackTrace[0]).toEqual({ functionName: "move", url: "http://localhost/app.js" });
  expect(sanitizeEvidence("browser dvb_example-session")).not.toContain("dvb_");
});
