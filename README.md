# gateway-traffic-generator

A Cloudflare Worker that generates synthetic web traffic through Cloudflare Gateway, so the built-in Zero Trust analytics in a demo or lab account look like a real enterprise tenant. It runs entirely on Cloudflare: no VM, no container and no device client.

This is a personal project, not an official Cloudflare product. It is provided as is.

## How it works

A Worker normally sends its outbound requests straight to the Internet, bypassing Gateway. A [Workers VPC](https://developers.cloudflare.com/workers-vpc/) network binding with `network_id: "cf1:network"` changes that: requests made on the binding leave through Gateway, where DNS, HTTP and network policies are applied and logged. No tunnel or other on-ramp is needed for public destinations.

1. A Cron Trigger starts the Worker once every minute.
2. The Worker decides how many requests suit that minute, using an office-hours curve, a weekend factor and the daily target.
3. For each request it picks a traffic group by weight, then a site from that group.
4. It sends the request on the `EGRESS` binding with browser-like headers, so Gateway inspects and logs it.
5. For DLP traffic it uploads fake card data to its own `/sink` path, so nothing sensitive-looking goes to a third party.

| Part | Purpose |
| --- | --- |
| Cron Trigger `* * * * *` | Starts a run every minute |
| `EGRESS` VPC Network binding | Sends requests through Gateway |
| Traffic groups | About 100 sites in 21 weighted groups |
| `/sink` path | Receives the fake DLP uploads |
| `/run` path | Sends a manual burst on demand |

With the default settings the Worker aims for about 6,000 requests on a weekday and about 1,200 on a weekend day.

## Traffic groups

| Group | Weight | Notes |
| --- | --- | --- |
| business-apps | 22 | Microsoft 365, Google Workspace, Salesforce, Slack and similar |
| developer | 12 | GitHub, Stack Overflow, package registries, cloud consoles |
| search-reference | 10 | Search engines and Wikipedia with random terms |
| news | 9 | Major news sites |
| social | 8 | LinkedIn, Facebook, X, Instagram, Reddit, TikTok |
| video-music | 6 | YouTube, Netflix, Twitch, Vimeo, Spotify |
| shopping | 6 | Amazon, eBay, Walmart, Etsy, IKEA |
| ai-tools | 5 | ChatGPT, Claude, Gemini, Perplexity, Copilot, Hugging Face |
| finance | 5 | PayPal, Chase, Yahoo Finance, Nasdaq, Stripe |
| travel | 4 | Booking, Expedia, Airbnb, Tripadvisor, Uber |
| learning-health-jobs | 4 | Coursera, Khan Academy, WHO, WebMD, ESPN, Indeed |
| file-sharing | 3 | WeTransfer, MediaFire, MEGA, Pastebin |
| security-test | 3 | Cloudflare `testcategory.com` domains for security categories |
| gaming | 2.5 | Steam, Epic Games, Roblox, IGN, Minecraft |
| gambling | 1.5 | bet365, PokerStars, DraftKings |
| dating | 1.5 | Tinder, Bumble, Match, OkCupid, Hinge |
| radio | 1.5 | iHeart, TuneIn, radio.net, SiriusXM |
| adult-themes | 1.5 | Test domain only, no real adult sites |
| dlp | 1.5 | Fake card data posted to `/sink` |
| hacking | 1 | Exploit-DB, Kali, HackThisSite and a test domain |
| drugs | 1 | Leafly, Weedmaps, Erowid and a test domain |

About 12% of the traffic targets categories that a typical acceptable-use policy blocks, so the dashboard shows blocks as well as allowed requests. Whether they are blocked depends on the policies in your account.

## Prerequisites

- A Zero Trust organization with the Gateway proxy turned on.
- TLS decryption turned on, so Gateway can log URLs and inspect uploads.
- No Forward policy matching Workers VPC traffic. Gateway drops HTTP traffic from Workers VPC that matches one.
- Node.js 20 or later on the machine used to deploy.
- For DLP hits: an HTTP policy that references a DLP profile covering credit card numbers.
- For blocks in the HTTP charts: HTTP policies that block the content categories. Categories blocked by a DNS policy never reach the HTTP stage.

## Deploy

1. Clone the repository:

```sh
git clone https://github.com/zerotrustguy/gateway-traffic-generator.git
cd gateway-traffic-generator
```

2. Open `wrangler.jsonc` and replace the two placeholders:

| Placeholder | Replace with |
| --- | --- |
| `<YOUR_ACCOUNT_ID>` | Your Cloudflare account ID |
| `<YOUR_WORKERS_SUBDOMAIN>` | Your account's `workers.dev` subdomain |

If you do not know the subdomain yet, deploy once, copy it from the address Wrangler prints, update `SINK_URL` and deploy again. Until `SINK_URL` is correct, the DLP uploads fail and everything else works.

3. Sign in and deploy:

```sh
npx wrangler@latest login
npx wrangler@latest deploy
```

Wrangler prints the Worker address and lists `env.EGRESS (cf1:network)` as a VPC Network binding. The schedule starts on its own after the deploy.

## Test

### 1. Send a manual burst

```sh
curl "https://gateway-traffic-test.<YOUR_WORKERS_SUBDOMAIN>.workers.dev/run?n=10"
```

The response is a JSON list with the group, URL and status of each request. `n` is capped at 25.

### 2. Check the Gateway logs

In the Zero Trust dashboard, open the Gateway HTTP logs. Each generated request should show:

- the full URL and HTTP method
- `onramp: workers_vpc`
- one or more category IDs
- the action, and the policy name when one matched

Blocked security categories may appear in the DNS logs instead of the HTTP logs.

### 3. Check the scheduled runs

In the Worker's Observability tab, look for events with `eventType: scheduled` and `outcome: ok` once a minute. Each run also logs a summary line such as `{"sent":7,"errors":0}`.

### How to read the results

- **A 403 or bot-check page from a site** is normal. Gateway still logs the request with its URL and category.
- **A Gateway block page with status 200** means a policy blocked the request.
- **`"error"` in the burst output** means the request failed or timed out after 8 seconds.

## Settings

The settings are in `wrangler.jsonc`. Redeploy after changing them.

| Setting | Default | Meaning |
| --- | --- | --- |
| `DAILY_REQUESTS` | 6000 | Weekday volume. Works up to roughly 12,000 before the per-minute cap of 25 flattens the peaks. |
| `TZ_OFFSET_HOURS` | 0 | Offset from UTC for the busy hours. India is 5.5. |
| `SINK_URL` | placeholder | Address of this Worker's own `/sink` path, used for the fake DLP uploads. |

To change which sites are visited or how often, edit the `GROUPS` list in `src/index.js`.

## Pause, resume or stop

### Pause

Set the schedule to an empty list and redeploy. Keep the empty brackets: removing the line entirely may leave the old schedule running.

```sh
sed -i '' 's#"crons": \["\* \* \* \* \*"\]#"crons": []#' wrangler.jsonc
npx wrangler@latest deploy
```

### Resume

```sh
sed -i '' 's#"crons": \[\]#"crons": ["* * * * *"]#' wrangler.jsonc
npx wrangler@latest deploy
```

### Stop and remove

```sh
npx wrangler@latest delete
```

The `sed` commands use macOS syntax. On Linux, use `sed -i` without the empty quotes. Manual bursts through `/run` still work while the schedule is paused.

## What has been tested

Tested in one Zero Trust account:

- The Worker deploys with the `cf1:network` binding and its requests appear in the Gateway HTTP logs.
- Log entries carry the full URL, method, status code and category IDs, with `onramp: workers_vpc`.
- Allowed requests reach the destination site.
- Requests to `malware.testcategory.com` return the Gateway block page.
- The Cron Trigger fires every minute with outcome `ok`.

Checked by simulation only, against a mocked network:

- The volume curve produces about 6,000 requests on a weekday and about 1,200 on a weekend day, with at most 12 in any one minute.


## Limits and caveats

- **No user or device identity.** The traffic is logged with Workers VPC as its source, so the top users and top devices charts stay empty.
- **Gateway assigns the categories.** The group names in the code are only labels, so a site may be classed differently than expected.
- **`/run` is publicly reachable.** Anyone with the address can trigger up to 25 requests per call. Delete the Worker when the demo is over, or put Cloudflare Access in front of it.
- **Third-party sites.** Requests are spread across about 100 sites, so each one receives a small share. Keep the daily volume modest.
- **Fake data only.** The DLP uploads use well-known public test card numbers and are sent only to the Worker's own `/sink` path.
- **Workers limits.** The per-run cap of 25 requests keeps a run inside the subrequest limit of the Workers Free plan.
- **Beta feature.** Workers VPC is in beta, so its behaviour and configuration may change.

## References

- [Workers VPC overview](https://developers.cloudflare.com/workers-vpc/)
- [VPC Networks and egress to the public Internet](https://developers.cloudflare.com/workers-vpc/configuration/vpc-networks/)
- [Test DNS filtering and category test domains](https://developers.cloudflare.com/cloudflare-one/traffic-controls/dns-policies/test-dns-filtering/)
