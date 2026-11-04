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
| Built-in templates | 2 | unlimited + custom |
| Generates / month | 20 | unlimited |
| Saved follow-ups | 30 | unlimited |
| CSV export | — | yes |
| Multiple signatures | 1 | yes |

Activate Pro: paste a license key in the side panel.  
Demo key for local testing: `LO-PRO-DEMO-2026`

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
- Lemon Squeezy live checkout URL
- Optional cloud sync (then it’s no longer pure-local)

## License

Private / all rights reserved until published.
