const HOURLY = [0.05,0.04,0.03,0.03,0.04,0.08,0.2,0.45,0.8,1.0,1.0,0.95,0.75,0.9,1.0,0.95,0.85,0.65,0.4,0.3,0.22,0.15,0.1,0.07];
const HOURLY_SUM = HOURLY.reduce((a, b) => a + b, 0);
const WEEKEND_FACTOR = 0.2;
const MAX_PER_RUN = 25;
const CONCURRENCY = 6;

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

const GROUPS = [
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
  { name: "dlp", weight: 1.5, urls: [] },
];
const TOTAL_WEIGHT = GROUPS.reduce((a, g) => a + g.weight, 0);

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickGroup() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const g of GROUPS) { r -= g.weight; if (r <= 0) return g; }
  return GROUPS[0];
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
  const rows = ["name,email,card_number"];
  for (let i = 1; i <= 5; i++) rows.push(`Test User ${i},user${i}@example.org,${pick(TEST_CARDS)}`);
  if (Math.random() < 0.5) {
    const form = new FormData();
    form.append("file", new File([rows.join("\n")], pick(FILE_NAMES), { type: "text/csv" }));
    return { group: "dlp", url: env.SINK_URL, init: { method: "POST", headers, body: form } };
  }
  return {
    group: "dlp",
    url: env.SINK_URL,
    init: {
      method: "POST",
      headers: { ...headers, "content-type": "text/plain" },
      body: `Please charge card ${pick(TEST_CARDS)} for the renewal. Backup card ${pick(TEST_CARDS)}.`,
    },
  };
}

function buildRequest(env) {
  const g = pickGroup();
  const headers = {
    "user-agent": pick(UAS),
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  };
  if (g.name === "dlp") return buildDlp(env, headers);
  const url = pick(g.urls).replace("{q}", encodeURIComponent(pick(TERMS))).replace("{topic}", pick(TOPICS));
  if (Math.random() < 0.3) headers.referer = "https://www.google.com/";
  return { group: g.name, url, init: { method: "GET", headers } };
}

async function sendOne(env) {
  const req = buildRequest(env);
  try {
    const r = await env.EGRESS.fetch(req.url, { ...req.init, signal: AbortSignal.timeout(8000) });
    await r.arrayBuffer();
    return { group: req.group, url: req.url, status: r.status };
  } catch (e) {
    return { group: req.group, url: req.url, error: String(e) };
  }
}

async function runBatch(env, n) {
  const results = [];
  for (let i = 0; i < n; i += CONCURRENCY) {
    const size = Math.min(CONCURRENCY, n - i);
    results.push(...(await Promise.all(Array.from({ length: size }, () => sendOne(env)))));
  }
  return results;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/sink") {
      await request.arrayBuffer();
      return new Response("ok");
    }
    if (url.pathname === "/run") {
      const n = Math.min(Number(url.searchParams.get("n")) || 10, MAX_PER_RUN);
      return Response.json(await runBatch(env, n));
    }
    return new Response("Gateway traffic generator");
  },

  async scheduled(controller, env, ctx) {
    const results = await runBatch(env, howMany(env, controller.scheduledTime));
    console.log(JSON.stringify({ sent: results.length, errors: results.filter((r) => r.error).length }));
  },
};
