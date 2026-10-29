// Preserve timing evidence without publishing browser credentials or request bodies.
export function sanitizeEvidence(value, key = "") {
  if (/headers?|authorization|cookie|postdata|requestbody|password|secret|token|assertion|payload/i.test(key)) return "[redacted]";
  if (typeof value === "string") {
    if (/^data:(?!image\/)/i.test(value)) return "[redacted data]";
    return value.replace(/(?:https?|wss?):\/\/[^\s"'<>]+/g, (raw) => {
      try { const url = new URL(raw); url.username = ""; url.password = ""; url.search = ""; url.hash = ""; return url.toString(); }
      catch { return "[redacted URL]"; }
    }).replace(/\b(?:dvb_|sk_live_|sk_test_)[A-Za-z0-9_-]+/g, "[redacted credential]");
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeEvidence(entry));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, sanitizeEvidence(entry, name)]));
  return value;
}
