const HOURLY = [0.05,0.04,0.03,0.03,0.04,0.08,0.2,0.45,0.8,1.0,1.0,0.95,0.75,0.9,1.0,0.95,0.85,0.65,0.4,0.3,0.22,0.15,0.1,0.07];
const HOURLY_SUM = HOURLY.reduce((a, b) => a + b, 0);
const WEEKEND_FACTOR = 0.2;
const MAX_PER_RUN = 25;
const CONCURRENCY = 6;
const HTTP_TIMEOUT_MS = 8000;
const TCP_TIMEOUT_MS = 5000;
const TCP_BANNER_MS = 1500;

const UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];
const TERMS = ["quarterly report template", "vpn not connecting", "expense policy", "python read csv", "flight to london", "best crm software", "zero trust security", "kubernetes ingress", "weather tomorrow", "how to pivot table", "sso login error", "gdpr checklist"];
const TOPICS = ["Cloud_computing", "Zero_trust_architecture", "Supply_chain", "Machine_learning", "Project_management", "Data_loss_prevention_software", "Balance_sheet", "Transport_Layer_Security"];
const TEST_CARDS = ["4111 1111 1111 1111", "5555 5555 5555 4444", "3782 822463 10005", "6011 1111 1111 1117", "4012 8888 8888 1881"];
const FILE_NAMES = ["customer-export.csv", "payments-q3.csv", "card-reconciliation.csv", "refunds.csv"];

function rnd(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function digits(n) { return Array.from({ length: n }, () => rnd(0, 9)).join(""); }

// Synthetic identifiers in valid formats, so detectors that reject famous example values still match.
// Generated at random and posted only to this Worker's own /sink, which discards them.
function fakeSsn() {
  let area; do { area = rnd(1, 899); } while (area === 666);
  return `${String(area).padStart(3, "0")}-${String(rnd(1, 99)).padStart(2, "0")}-${String(rnd(1, 9999)).padStart(4, "0")}`;
}
function fakeNino() {
  const first = "ABCEGHJKLMNOPRSTWXYZ", second = "ABCEGHJKLMNPRSTWXYZ", banned = ["BG", "GB", "KN", "NK", "NT", "TN", "ZZ"];
  let p; do { p = pick([...first]) + pick([...second]); } while (banned.includes(p));
  return `${p} ${digits(2)} ${digits(2)} ${digits(2)} ${pick(["A", "B", "C", "D"])}`;
}
function fakeNhs() {
  for (;;) {
    const d = Array.from({ length: 9 }, () => rnd(0, 9));
    const check = 11 - (d.reduce((s, x, i) => s + x * (10 - i), 0) % 11);
    if (check === 10) continue;
    const s = d.join("") + (check === 11 ? 0 : check);
    return `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6)}`;
  }
}

const DLP_EXTRAS = [
  // Credentials and Secrets profile (AWS's documented example key pair).
  () => ({ name: "deploy.env", type: "text/plain", body: "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nAWS_DEFAULT_REGION=eu-west-2\n" }),
  // Social Security, Insurance, Tax and Identifier Numbers profile.
  () => {
    const rows = ["name,ssn,ni_number,nhs_number"];
    for (let i = 1; i <= 5; i++) rows.push(`Test User ${i},${fakeSsn()},${fakeNino()},${fakeNhs()}`);
    return { name: pick(["hr-onboarding.csv", "payroll-starters.csv", "staff-records.csv"]), type: "text/csv", body: rows.join("\n") };
  },
  // Source Code profile (ML-based, so the samples are a realistic size).
  () => ({ name: "billing_service.py", type: "text/x-python", body: `import os
import json
import logging
from dataclasses import dataclass
from decimal import Decimal

log = logging.getLogger(__name__)


@dataclass
class Invoice:
    customer_id: str
    amount: Decimal
    currency: str = "GBP"


class BillingClient:
    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.key = os.environ["BILLING_KEY"]

    def charge(self, invoice: Invoice) -> dict:
        if invoice.amount <= 0:
            raise ValueError("amount must be positive")
        payload = {"customer": invoice.customer_id, "amount": str(invoice.amount), "currency": invoice.currency}
        log.info("charging %s", invoice.customer_id)
        return json.loads(json.dumps(payload))


def main():
    client = BillingClient("https://billing.internal")
    for line in open("invoices.csv"):
        cid, amount = line.strip().split(",")
        print(client.charge(Invoice(cid, Decimal(amount))))


if __name__ == "__main__":
    main()
` }),
  () => ({ name: "sessionStore.js", type: "application/javascript", body: `"use strict";
const crypto = require("crypto");

class SessionStore {
  constructor(ttlSeconds = 3600) {
    this.ttl = ttlSeconds * 1000;
    this.sessions = new Map();
  }

  create(userId) {
    const id = crypto.randomBytes(16).toString("hex");
    this.sessions.set(id, { userId, expires: Date.now() + this.ttl });
    return id;
  }

  get(id) {
    const s = this.sessions.get(id);
    if (!s) return null;
    if (s.expires < Date.now()) {
      this.sessions.delete(id);
      return null;
    }
    return s;
  }

  purge() {
    for (const [id, s] of this.sessions) {
      if (s.expires < Date.now()) this.sessions.delete(id);
    }
  }
}

module.exports = { SessionStore };
` }),
];

const BASE_GROUPS = [
  { name: "business-apps", weight: 22, urls: ["https://www.office.com/", "https://www.microsoft.com/en-us/microsoft-365", "https://login.microsoftonline.com/", "https://www.google.com/", "https://docs.google.com/", "https://drive.google.com/", "https://mail.google.com/", "https://www.salesforce.com/", "https://slack.com/", "https://zoom.us/", "https://www.atlassian.com/software/jira", "https://www.notion.so/", "https://www.dropbox.com/", "https://www.box.com/", "https://www.workday.com/", "https://www.servicenow.com/"] },
  { name: "developer", weight: 12, urls: ["https://github.com/", "https://github.com/cloudflare/workers-sdk", "https://stackoverflow.com/questions", "https://www.npmjs.com/package/react", "https://pypi.org/project/requests/", "https://hub.docker.com/", "https://developer.mozilla.org/en-US/docs/Web/JavaScript", "https://aws.amazon.com/", "https://cloud.google.com/", "https://azure.microsoft.com/", "https://developers.cloudflare.com/"] },
  { name: "search-reference", weight: 10, urls: ["https://www.google.com/search?q={q}", "https://www.bing.com/search?q={q}", "https://duckduckgo.com/?q={q}", "https://en.wikipedia.org/wiki/{topic}"] },
  { name: "news", weight: 9, urls: ["https://www.bbc.com/news", "https://www.reuters.com/", "https://www.nytimes.com/", "https://www.theguardian.com/international", "https://edition.cnn.com/", "https://techcrunch.com/", "https://www.theverge.com/", "https://www.bloomberg.com/"] },
  { name: "social", weight: 8, urls: ["https://www.linkedin.com/", "https://www.facebook.com/", "https://x.com/", "https://www.instagram.com/", "https://www.reddit.com/", "https://www.tiktok.com/", "https://www.pinterest.com/"] },
  { name: "video-music", weight: 6, urls: ["https://www.youtube.com/", "https://www.netflix.com/", "https://www.twitch.tv/", "https://vimeo.com/", "https://open.spotify.com/"] },
  { name: "shopping", weight: 6, urls: ["https://www.amazon.com/", "https://www.ebay.com/", "https://www.walmart.com/", "https://www.etsy.com/", "https://www.ikea.com/"] },
  { name: "ai-tools", weight: 5, urls: ["https://chatgpt.com/", "https://claude.ai/", "https://gemini.google.com/", "https://www.perplexity.ai/", "https://copilot.microsoft.com/", "https://huggingface.co/"] },
  { name: "finance", weight: 5, urls: ["https://www.paypal.com/", "https://www.chase.com/", "https://finance.yahoo.com/", "https://www.nasdaq.com/", "https://stripe.com/"] },
  { name: "travel", weight: 4, urls: ["https://www.booking.com/", "https://www.expedia.com/", "https://www.airbnb.com/", "https://www.tripadvisor.com/", "https://www.uber.com/"] },
  { name: "learning-health-jobs", weight: 4, urls: ["https://www.coursera.org/", "https://www.khanacademy.org/", "https://www.who.int/", "https://www.webmd.com/", "https://www.espn.com/", "https://www.indeed.com/"] },
  { name: "file-sharing", weight: 3, urls: ["https://wetransfer.com/", "https://www.mediafire.com/", "https://mega.nz/", "https://pastebin.com/"] },
  { name: "gambling", weight: 1.5, urls: ["https://www.bet365.com/", "https://www.pokerstars.com/", "https://www.draftkings.com/"] },
  { name: "gaming", weight: 2.5, urls: ["https://store.steampowered.com/", "https://www.epicgames.com/", "https://www.roblox.com/", "https://www.ign.com/", "https://www.minecraft.net/"] },
  { name: "dating", weight: 1.5, urls: ["https://tinder.com/", "https://bumble.com/", "https://www.match.com/", "https://www.okcupid.com/", "https://hinge.co/"] },
  { name: "radio", weight: 1.5, urls: ["https://www.iheart.com/", "https://tunein.com/", "https://www.radio.net/", "https://www.siriusxm.com/"] },
  { name: "hacking", weight: 1, urls: ["https://www.exploit-db.com/", "https://www.kali.org/", "https://www.hackthissite.org/", "https://hacking.testcategory.com/"] },
  { name: "drugs", weight: 1, urls: ["https://www.leafly.com/", "https://weedmaps.com/", "https://www.erowid.org/", "https://drugs.testcategory.com/"] },
  { name: "adult-themes", weight: 1.5, urls: ["https://adultthemes.testcategory.com/"] },
  { name: "security-test", weight: 3, urls: ["https://malware.testcategory.com/", "https://phishing.testcategory.com/", "https://spyware.testcategory.com/", "https://cryptomining.testcategory.com/", "https://anonymizer.testcategory.com/", "https://commandandcontrolandbotnet.testcategory.com/", "https://spam.testcategory.com/", "https://newdomains.testcategory.com/", "https://parkedandforsaledomains.testcategory.com/"] },
  { name: "dlp", weight: 1.5, kind: "dlp" },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// EXTRA_GROUPS in wrangler.jsonc adds account-specific groups (private networks, policy lists,
// Access apps). Each entry is { name, weight, urls: [...] } for HTTP, or
// { name, weight, kind: "tcp", targets: ["host:port", ...] } for raw TCP through Gateway.
let cachedGroups = null;
let cachedSource;
function loadGroups(env) {
  if (cachedGroups && cachedSource === env.EXTRA_GROUPS) return cachedGroups;
  let extra = env.EXTRA_GROUPS || [];
  if (typeof extra === "string") {
    try { extra = JSON.parse(extra); } catch (e) { console.error("EXTRA_GROUPS is not valid JSON", String(e)); extra = []; }
  }
  const valid = [];
  for (const g of Array.isArray(extra) ? extra : []) {
    const weight = Number(g?.weight);
    if (!g?.name || !(weight > 0)) { console.error("Skipping EXTRA_GROUPS entry without name or weight", JSON.stringify(g)); continue; }
    if (g.kind === "tcp" ? Array.isArray(g.targets) && g.targets.length : Array.isArray(g.urls) && g.urls.length) {
      valid.push({ ...g, weight });
    } else {
      console.error("Skipping EXTRA_GROUPS entry without urls or targets", g.name);
    }
  }
  const groups = [...BASE_GROUPS, ...valid];
  cachedGroups = { list: groups, total: groups.reduce((a, g) => a + g.weight, 0) };
  cachedSource = env.EXTRA_GROUPS;
  return cachedGroups;
}

function pickGroup(groups) {
  let r = Math.random() * groups.total;
  for (const g of groups.list) { r -= g.weight; if (r <= 0) return g; }
  return groups.list[0];
}

function howMany(env, when) {
  const daily = Number(env.DAILY_REQUESTS) || 6000;
  const offset = Number(env.TZ_OFFSET_HOURS) || 0;
  const local = new Date(when + offset * 3600000);
  const day = local.getUTCDay();
  const dayFactor = day === 0 || day === 6 ? WEEKEND_FACTOR : 1;
  const expected = (daily * HOURLY[local.getUTCHours()]) / (HOURLY_SUM * 60) * dayFactor * (0.7 + Math.random() * 0.6);
  const n = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
  return Math.min(n, MAX_PER_RUN);
}

function buildDlp(env, headers) {
  const roll = Math.random();
  // Card data stays the most common, as it matches the account's Financial Information policy.
  if (roll < 0.35) {
    const rows = ["name,email,card_number"];
    for (let i = 1; i <= 5; i++) rows.push(`Test User ${i},user${i}@example.org,${pick(TEST_CARDS)}`);
    const form = new FormData();
    form.append("file", new File([rows.join("\n")], pick(FILE_NAMES), { type: "text/csv" }));
    return { url: env.SINK_URL, init: { method: "POST", headers, body: form } };
  }
  if (roll < 0.7) {
    return {
      url: env.SINK_URL,
      init: {
        method: "POST",
        headers: { ...headers, "content-type": "text/plain" },
        body: `Please charge card ${pick(TEST_CARDS)} for the renewal. Backup card ${pick(TEST_CARDS)}.`,
      },
    };
  }
  const f = pick(DLP_EXTRAS)();
  const form = new FormData();
  form.append("file", new File([f.body], f.name, { type: f.type }));
  return { url: env.SINK_URL, init: { method: "POST", headers, body: form } };
}

function buildRequest(env, g) {
  const headers = {
    "user-agent": pick(UAS),
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-GB,en;q=0.9",
  };
  if (g.kind === "dlp") return buildDlp(env, headers);
  const url = pick(g.urls).replace("{q}", encodeURIComponent(pick(TERMS))).replace("{topic}", pick(TOPICS));
  if (Math.random() < 0.3) headers.referer = "https://www.google.com/";
  return { url, init: { method: "GET", headers } };
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

async function sendHttp(env, g) {
  const req = buildRequest(env, g);
  const started = Date.now();
  try {
    const r = await env.EGRESS.fetch(req.url, { ...req.init, signal: AbortSignal.timeout(Number(g.timeoutMs) || HTTP_TIMEOUT_MS) });
    // The page title tells a Gateway block or isolation page apart from the real site, as both return 200.
    const body = await r.text();
    const title = body.slice(0, 65536).match(/<title[^>]*>([^<]{0,120})/i)?.[1]?.trim();
    return { group: g.name, kind: "http", method: req.init.method, url: req.url, status: r.status, ...(title ? { title } : {}), ms: Date.now() - started };
  } catch (e) {
    return { group: g.name, kind: "http", method: req.init.method, url: req.url, error: String(e), ms: Date.now() - started };
  }
}

// Opens a plaintext TCP session through Gateway so it appears in the Network logs, waits briefly
// for a server banner (SSH, SMTP and similar speak first), then closes. No payload is sent.
async function sendTcp(env, g) {
  const target = pick(g.targets);
  const started = Date.now();
  let socket;
  try {
    const timeout = Number(g.timeoutMs) || TCP_TIMEOUT_MS;
    // The VPC binding documents connect() as returning a Promise<Socket>; await covers both shapes.
    socket = await withTimeout(Promise.resolve(env.EGRESS.connect(target)), timeout, "connect");
    await withTimeout(socket.opened, timeout, "connect");
    // Gateway's proxy accepts the socket before it reaches the destination, so `opened` alone
    // proves little. What happens next tells the cases apart:
    //   banner  - the server spoke first (SSH, SMTP)
    //   closed  - the stream ended at once: blocked by policy, or no route / tunnel down
    //   silent  - still open after the wait: connected to a server that waits for the client,
    //             or Gateway is still trying an unreachable address
    let status = "silent";
    let banner = 0;
    const reader = socket.readable.getReader();
    try {
      const first = await withTimeout(reader.read(), TCP_BANNER_MS, "banner");
      if (first.done) status = "closed";
      else { status = "banner"; banner = first.value?.byteLength || 0; }
    } catch (e) {
      if (!String(e).includes("banner timed out")) status = "closed";
    }
    return { group: g.name, kind: "tcp", target, status, bannerBytes: banner, ms: Date.now() - started };
  } catch (e) {
    return { group: g.name, kind: "tcp", target, error: String(e), ms: Date.now() - started };
  } finally {
    try { await socket?.close(); } catch { /* already closed */ }
  }
}

function sendOne(env, groups, forced) {
  const g = forced || pickGroup(groups);
  return g.kind === "tcp" ? sendTcp(env, g) : sendHttp(env, g);
}

async function runBatch(env, n, forced) {
  const groups = loadGroups(env);
  const results = [];
  for (let i = 0; i < n; i += CONCURRENCY) {
    const size = Math.min(CONCURRENCY, n - i);
    results.push(...(await Promise.all(Array.from({ length: size }, () => sendOne(env, groups, forced)))));
  }
  return results;
}

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.byteLength !== y.byteLength) return false;
  return crypto.subtle.timingSafeEqual(x, y);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/sink") {
      await request.arrayBuffer();
      return new Response("ok");
    }
    if (url.pathname === "/run" || url.pathname === "/groups") {
      // Optional shared secret, set with `wrangler secret put RUN_TOKEN`. Sent as the x-run-token header.
      if (env.RUN_TOKEN && !timingSafeEqual(request.headers.get("x-run-token") || "", env.RUN_TOKEN)) {
        return new Response("Unauthorised", { status: 401 });
      }
      const groups = loadGroups(env);
      if (url.pathname === "/groups") {
        return Response.json(groups.list.map((g) => ({ name: g.name, kind: g.kind || "http", weight: g.weight, share: `${((g.weight / groups.total) * 100).toFixed(1)}%` })));
      }
      const n = Math.min(Number(url.searchParams.get("n")) || 10, MAX_PER_RUN);
      const name = url.searchParams.get("group");
      const forced = name ? groups.list.find((g) => g.name === name) : null;
      if (name && !forced) return Response.json({ error: `unknown group ${name}`, groups: groups.list.map((g) => g.name) }, { status: 400 });
      return Response.json(await runBatch(env, n, forced));
    }
    return new Response("Gateway traffic generator");
  },

  async scheduled(controller, env, ctx) {
    const results = await runBatch(env, howMany(env, controller.scheduledTime));
    const byGroup = {};
    for (const r of results) byGroup[r.group] = (byGroup[r.group] || 0) + 1;
    console.log(JSON.stringify({ sent: results.length, errors: results.filter((r) => r.error).length, tcp: results.filter((r) => r.kind === "tcp").length, byGroup }));
  },
};
