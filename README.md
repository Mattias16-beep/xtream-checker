<div align="center">

Try the app live:

**https://xtream-checker-lac.vercel.app/**

</div>

# Xtream Checker

A web tool to verify the validity of an Xtream Codes IPTV subscription. Built with Claude.

## Features

**Subscription check**
- Form mode: server URL + username + password
- URL mode: paste a full m3u/player_api link, fields are auto-filled
- Three possible results: valid subscription, invalid credentials, or server unreachable

**Result details (valid subscription only)**
- Expiration date, status (Active / Expired / Banned), max connections, account type
- Client-side latency: measures your real round-trip to the IPTV server
- Server-side diagnostics: DNS resolution, IP geolocation (country, city, ISP, ASN)

**History**
- Last 20 checks stored in `localStorage`
- Passwords are never saved
- Click any entry to pre-fill the form

**Rate limiting**
- 10 requests / minute / IP via Vercel Middleware

## Stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · Vercel

## Deploy

```bash
npm install
npm run dev
```

Deploy to Vercel: push to GitHub and import the repo.
