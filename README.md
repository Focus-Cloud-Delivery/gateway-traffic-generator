# gateway-traffic-generator

A Cloudflare Worker that generates synthetic web traffic through Cloudflare Gateway, so the built-in Zero Trust analytics in a demo or lab account look like a real enterprise tenant. It runs entirely on Cloudflare: no VM, no container and no device client.

This is a personal project, not an official Cloudflare product. It is provided as is.

## How it works

A Worker normally sends its outbound requests straight to the Internet, bypassing Gateway. A [Workers VPC](https://developers.cloudflare.com/workers-vpc/) network binding with `network_id: "cf1:network"` changes that: requests made on the binding leave through Gateway, where DNS, HTTP and network policies are applied and logged. No tunnel or other on-ramp is needed for public destinations.

1. A Cron Trigger starts the Worker once every minute.
2. The Worker decides how many requests suit that minute, using an office-hours curve, a weekend factor and the daily target.
3. For each request it picks a traffic group by weight, then a site from that group.
4. It sends the request on the `EGRESS` binding with browser-like headers, so Gateway inspects and logs it.
5. For DLP traffic it uploads fake card data, example cloud keys, example ID numbers or source code to its own `/sink` path, so nothing sensitive-looking goes to a third party.
6. For TCP groups it opens a plain TCP session on the binding with `connect()`, waits briefly for a banner and closes it, so the Network logs show L4 sessions to private or blocked ports.

| Part | Purpose |
| --- | --- |
| Cron Trigger `* * * * *` | Starts a run every minute |
| `EGRESS` VPC Network binding | Sends requests through Gateway |
| Traffic groups | About 100 sites in 21 weighted groups |
| `/sink` path | Receives the fake DLP uploads |
| `/run` path | Sends a manual burst on demand, optionally for one group |
| `/groups` path | Lists every group with its weight and share of traffic |
| `EXTRA_GROUPS` setting | Adds account-specific HTTP and TCP groups, including private networks |

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

## Private and network traffic

`EXTRA_GROUPS` in `wrangler.jsonc` adds groups on top of the built-in list. Use it for anything specific to one account: private IP ranges, internal hostnames, Gateway lists and Access applications. Two shapes are supported:

```jsonc
{ "name": "private-web", "weight": 4, "timeoutMs": 4000, "urls": ["http://172.16.1.4/"] }
{ "name": "private-tcp", "weight": 6, "kind": "tcp", "targets": ["172.16.1.4:22", "172.16.0.5:3389"] }
```

With `network_id: "cf1:network"` the binding uses the account's default virtual network, so it can reach subnet and hostname routes announced through Cloudflare Tunnel, Mesh or WAN. For the private requests to complete, a tunnel that reaches the targets must be healthy and use the QUIC transport. When it is down, Network policies still evaluate and log the attempt, and blocked sessions still show as blocks.

The traffic carries no user identity, so policies that require one (for example `identity.email matches ...`) never match it. In this account that is useful: private traffic falls through to the "block everyone else" policy, which shows both sides of the policy in the logs.

`connect()` supports plaintext TCP only. UDP is not supported, and implicit-TLS services such as SMTP on port 465 cannot be reached.

What was seen in testing (23 November 2026, tunnel down):

- HTTP to public sites, DLP uploads, isolation and Access apps all appear in the HTTP logs.
- `connect()` sessions produced no Network log entries, for private or public destinations. Only port 443 sessions behind `fetch()` were logged, with `onramp: workers_vpc`. Port 25 is refused by the Workers runtime itself, not by Gateway. So TCP groups to public addresses are not useful for Gateway demos.
- HTTP to private IPs failed with `ProxyError: destination_unavailable` and was not logged. The Workers VPC docs list Mesh and WAN, but not Tunnel, as traffic that flows through Gateway. Retest `private-web` and `private-tcp` with the tunnel up before relying on them.

The TCP result reports `status`: `banner` (the server spoke first), `closed` (the stream ended at once: blocked, or no route) or `silent` (still open after 1.5 seconds). Gateway's proxy accepts the socket before it reaches the destination, so a successful open alone proves nothing.

The groups set up for this account:

| Group | Weight | Targets | Expected policy |
| --- | --- | --- | --- |
| policy-isolate | 2 | example.com, neverssl.com | Isolate risky sites |
| policy-blocklist | 1 | Domains in the blocked domains list | DNS block domain list |
| access-public-apps | 3 | Published Access hostnames | Allowed, Access login redirect |
| internal-dns | 2 | `*.focuspoc.internal` | Resolver policy to Azure DNS over the tunnel, then the apps subnet |
| private-web | 4 | HTTP to 172.16.1.4 and 172.16.0.5 | Block everyone else to apps subnet, or allowed to the tunnel |
| private-tcp | 6 | SSH, SMB, PostgreSQL, RDP, WinRM to the two VMs | Network allow and block policies |

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

The response is a JSON list with the group, URL or TCP target, status, page title and time taken for each request. The title shows whether a 200 is the real site or a Gateway block page. `n` is capped at 25.

To show one behaviour on demand, name a group. `/groups` lists the names.

```sh
curl "https://gateway-traffic-test.<YOUR_WORKERS_SUBDOMAIN>.workers.dev/run?n=5&group=private-tcp"
```

If `RUN_TOKEN` is set, send it in the `x-run-token` header on both `/run` and `/groups`.

### 2. Check the Gateway logs

In the Zero Trust dashboard, open the Gateway HTTP, DNS and Network logs. TCP groups and private HTTP appear in the Network logs with Workers VPC as the traffic source. Each generated HTTP request should show:

- the full URL and HTTP method
- `onramp: workers_vpc`
- one or more category IDs
- the action, and the policy name when one matched

Blocked security categories may appear in the DNS logs instead of the HTTP logs.

### 3. Check the scheduled runs

In the Worker's Observability tab, look for events with `eventType: scheduled` and `outcome: ok` once a minute. Each run also logs a summary line such as `{"sent":7,"errors":1,"tcp":1,"byGroup":{...}}`.

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
| `EXTRA_GROUPS` | account groups | Extra HTTP and TCP groups. See [Private and network traffic](#private-and-network-traffic). |
| `RUN_TOKEN` | not set | Optional secret for `/run` and `/groups`. Set it with `npx wrangler@latest secret put RUN_TOKEN`, never in `wrangler.jsonc`. |

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
- **`/run` is publicly reachable unless `RUN_TOKEN` is set.** Anyone with the address can trigger up to 25 requests per call, and `/groups` and `/run` reveal the private targets in `EXTRA_GROUPS`. Set `RUN_TOKEN`, put Cloudflare Access in front of the Worker, or delete it when the demo is over. `/sink` stays open and discards what it receives.
- **Third-party sites.** Requests are spread across about 100 sites, so each one receives a small share. Keep the daily volume modest.
- **Fake data only.** The DLP uploads use well-known public test card numbers, AWS's documented example key pair, randomly generated US SSNs, UK National Insurance numbers and NHS numbers in valid formats, and made-up Python and JavaScript files. They are sent only to the Worker's own `/sink` path, which discards them. Only profiles referenced by an HTTP policy are matched and logged. In this account cards, credentials and ID numbers are blocked, and source code is allowed and logged.
- **Private targets are scanned lightly.** Each TCP session opens, waits up to 1.5 seconds for a banner and closes without sending data. Only list hosts you are authorised to test.
- **Workers limits.** The per-run cap of 25 requests keeps a run inside the subrequest limit of the Workers Free plan.
- **Beta feature.** Workers VPC is in beta, so its behaviour and configuration may change.

## References

- [Workers VPC overview](https://developers.cloudflare.com/workers-vpc/)
- [VPC Networks and egress to the public Internet](https://developers.cloudflare.com/workers-vpc/configuration/vpc-networks/)
- [Workers VPC binding API, including `connect()`](https://developers.cloudflare.com/workers-vpc/api/)
- [Test DNS filtering and category test domains](https://developers.cloudflare.com/cloudflare-one/traffic-controls/dns-policies/test-dns-filtering/)
