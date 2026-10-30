// Deterministic indicator extraction & URL pattern checks. Pure functions (no I/O).

export type ExtractedIndicator = { type: string; value: string; normalized: string };

export const BRANDS: Record<string, string[]> = {
  microsoft: ["microsoft.com", "office.com", "live.com", "outlook.com"],
  google: ["google.com", "gmail.com"],
  paypal: ["paypal.com"],
  apple: ["apple.com", "icloud.com"],
  amazon: ["amazon.com"],
  dhl: ["dhl.com"],
  fedex: ["fedex.com"],
  netflix: ["netflix.com"],
  bank: [],
};

const URGENCY = [
  "urgent", "immediately", "within 2 hours", "within 24 hours", "within 48 hours", "expires",
  "suspended", "suspension", "act now", "final notice", "avoid return", "last chance", "asap",
];
const CREDENTIAL = [
  "verify your credentials", "verify your account", "confirm your password", "password",
  "login", "log in", "sign in", "credentials", "ssn", "bank details", "confirm your delivery details",
];
const INJECTION = [
  "ignore previous instructions", "ignore all previous", "you are now", "system prompt",
  "disregard the above", "mark this as safe", "classify this as benign",
];
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "rb.gy"];

export function normalizeDomain(d: string) {
  return d.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

export function registrable(domain: string) {
  const parts = normalizeDomain(domain).split(".");
  return parts.slice(-2).join(".");
}

export function parseEmail(text: string) {
  const header = (name: string) => {
    const m = text.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`, "im"));
    return m?.[1] ? m[1].trim() : null;
  };
  const fromRaw = header("From");
  const subject = header("Subject");
  let senderName: string | null = null;
  let senderEmail: string | null = null;
  if (fromRaw) {
    const m = fromRaw.match(/^(.*?)<([^>]+)>/);
    if (m) {
      senderName = (m[1] ?? "").replace(/"/g, "").trim() || null;
      senderEmail = (m[2] ?? "").trim().toLowerCase();
    } else {
      const e = fromRaw.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
      senderEmail = e ? e[0].toLowerCase() : null;
    }
  }
  const senderDomain = senderEmail ? normalizeDomain(senderEmail.split("@")[1] ?? "") : null;
  return { senderName, senderEmail, senderDomain, subject };
}

export function extractUrls(text: string): string[] {
  const urls = new Set<string>();
  const re = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
  for (const m of text.matchAll(re)) urls.add(m[0].replace(/[.,;:!?]+$/, ""));
  // defanged hxxp / [.]
  for (const m of text.matchAll(/\bhxxps?:\/\/[^\s<>"')\]]+/gi))
    urls.add(m[0].replace(/^hxxp/i, "http").replace(/\[\.\]/g, "."));
  return [...urls].slice(0, 50);
}

export function urlHost(u: string): string | null {
  try {
    return normalizeDomain(new URL(u).hostname);
  } catch {
    return null;
  }
}

export function findKeywords(text: string) {
  const t = text.toLowerCase();
  return {
    urgency: URGENCY.filter((k) => t.includes(k)),
    credential: CREDENTIAL.filter((k) => t.includes(k)),
    injection: INJECTION.filter((k) => t.includes(k)),
  };
}

export function deLeet(s: string) {
  return s.replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e").replace(/5/g, "s").replace(/rn/g, "m");
}

/** Returns brand name if domain imitates a brand but is not an official brand domain. */
export function lookalikeBrand(domain: string): string | null {
  const d = normalizeDomain(domain);
  const reg = registrable(d);
  for (const [brand, official] of Object.entries(BRANDS)) {
    if (official.some((o) => reg === o)) return null;
    const label = deLeet(d);
    if (official.length && label.includes(brand) && !official.includes(reg)) return brand;
  }
  return null;
}

export function mentionedBrands(text: string) {
  const t = text.toLowerCase();
  return Object.keys(BRANDS).filter((b) => b !== "bank" && new RegExp(`\\b${b}\\b`).test(t));
}

export function urlPatternFlags(u: string): string[] {
  const flags: string[] = [];
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return ["unparseable_url"];
  }
  const host = url.hostname.toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) flags.push("ip_address_host");
  if (host.includes("xn--")) flags.push("punycode_domain");
  if (SHORTENERS.includes(normalizeDomain(host))) flags.push("url_shortener");
  if (host.split(".").length > 4) flags.push("excessive_subdomains");
  if (u.includes("@")) flags.push("userinfo_in_url");
  if (lookalikeBrand(host)) flags.push(`lookalike_of_${lookalikeBrand(host)}`);
  if (url.protocol === "http:" && /login|verify|account|password|signin/i.test(url.pathname))
    flags.push("credential_path_over_http");
  return flags;
}

export function extractIndicators(text: string, sourceType: string): ExtractedIndicator[] {
  const out: ExtractedIndicator[] = [];
  const seen = new Set<string>();
  const add = (type: string, value: string, normalized = value.toLowerCase()) => {
    const k = `${type}:${normalized}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ type, value: value.slice(0, 500), normalized: normalized.slice(0, 500) });
  };
  if (sourceType !== "url") {
    const e = parseEmail(text);
    if (e.senderEmail) add("sender_email", e.senderEmail);
    if (e.senderName) add("sender_name", e.senderName);
    if (e.senderDomain) add("domain", e.senderDomain, e.senderDomain);
    if (e.subject) add("subject", e.subject);
  }
  for (const u of extractUrls(text)) {
    add("url", u);
    const h = urlHost(u);
    if (h) add("domain", h, h);
  }
  if (sourceType === "url" && !out.some((i) => i.type === "url")) {
    const t = text.trim();
    const withProto = /^https?:\/\//i.test(t) ? t : `http://${t}`;
    const h = urlHost(withProto);
    if (h) {
      add("url", withProto);
      add("domain", h, h);
    }
  }
  const kw = findKeywords(text);
  kw.urgency.forEach((k) => add("urgency_phrase", k));
  kw.credential.forEach((k) => add("credential_phrase", k));
  kw.injection.forEach((k) => add("prompt_injection_phrase", k));
  return out;
}
