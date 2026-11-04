# Listing Outreach

Chrome extension for **US buyer’s agents**: open a Zillow / Redfin listing → extract address & listing agent → fill SMS/email templates → keep a local follow-up log.

- **Stack**: Manifest V3, vanilla JS, pure frontend (no backend in v1)
- **Monetization**: freemium + Lemon Squeezy license key (stub ready)
- **Privacy**: all data stays in `chrome.storage.local`

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension/` folder

## Free vs Pro

| | Free | Pro |
|--|------|-----|
| Templates | all built-in | all + custom |
| Generates | 20 / day | unlimited |
| Follow-ups | unlimited (local) | unlimited |
| Export CSV / Excel | 1 trial total | unlimited |

Activate Pro: **Buy Pro** (Lemon Squeezy checkout) → paste key → Activate.  
Mint keys locally: `npm run gen-license`. When Pro is active, the license card hides — clear from the **Pro** badge menu.

Set checkout URL in `extension/lib/commerce.js` (`CHECKOUT_URL`).  
Full payment / key delivery checklist: [docs/lemonsqueezy-checklist.md](docs/lemonsqueezy-checklist.md)

## Project layout

```
extension/
  manifest.json
  background.js
  sidepanel.html / .css / .js
  content/          # Zillow & Redfin extractors
  lib/              # storage, templates, freemium, license
  icons/
```

## Roadmap (after first paying users)

- One regional MLS host
- Auto-email keys via LS webhook / Zapier
- Optional cloud sync (then it’s no longer pure-local)

## License

Private / all rights reserved until published.
