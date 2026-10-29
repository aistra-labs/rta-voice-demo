# RTA Voice Assistants: live demo page

A static landing page where RTA can try two Aistra-built DeepTalk voice agents in the browser, without a DeepTalk login:

| Card | DeepTalk agent | Workflow ID |
|---|---|---|
| Nol Card Assistant | NOL Card - RTA Demo | 148 |
| Journey Planner | Dubai RTA - Journey Planner | 147 |

Live at **https://aistra-labs.github.io/rta-voice-demo/** (GitHub Pages, `main` branch, root folder).

## How it works

- `index.html` is the page. Each assistant card embeds `call.html?agent=nol` or `call.html?agent=rta` in an iframe with microphone access.
- `call.html` loads the agent's DeepTalk widget (embed mode **Inline**, type **Voice**), keeps the widget's own panel hidden, and drives it through `window.DeepTalkWidget` (`start`, `end`, `onStatusChange`). One iframe per agent is needed because the widget script loads once per page and owns a single global.
- The page and the frames talk through `postMessage`, so only one assistant can be on a call at a time and each frame sizes itself.
- Motion uses [GSAP 3.13](https://gsap.com) (SplitText, ScrollTrigger) from jsDelivr. Everything still works if it fails to load, and all motion is skipped for visitors who prefer reduced motion.

## Updating

- **New agent versions:** publish the agent in DeepTalk. The widget runs the published version, so the page picks it up on the next call with no change here.
- **New embed token:** if a widget's token is regenerated, update it in `assets/js/call.js` (`AGENTS`).
- **Test cards:** the table in `index.html` mirrors the demo Google Sheet. Update both together.
- **Allowed domains:** each widget's Allowed Domains in DeepTalk must include `aistra-labs.github.io` (and `localhost` if you want to test locally).

## Local preview

```bash
python -m http.server 8080
# open http://localhost:8080
```

Calls only connect from an allowed domain, so locally the call controls show "Assistant unavailable" unless `localhost` is added in DeepTalk.

## Brand

Colours, type and logos follow the Aistra deck style: navy `#0D0B1F`, brand purple `#6E5BFF`, deep purple `#4B3DC9`, light purple `#8B7EFF`, cyan `#00D4E0`, Helvetica throughout.
