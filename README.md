# RTA Voice Assistants

A static page for trying two Aistra voice assistants in the browser.

Live at **https://aistra-labs.github.io/rta-voice-demo/** (GitHub Pages, `main` branch, root folder).

## How it works

- `index.html` shows one card per assistant. Each card embeds `call.html?agent=…` in an iframe with microphone access.
- `call.html` loads that assistant's DeepTalk widget (Voice, Inline), keeps the widget's own panel hidden, and drives it through `window.DeepTalkWidget`. One iframe per assistant is needed because the widget script loads once per page.
- The page and the frames talk through `postMessage`, so only one assistant can be on a call at a time.
- Intro motion uses [GSAP 3.13](https://gsap.com) from jsDelivr. The page still works if it fails to load, and motion is skipped for visitors who prefer reduced motion.

## Updating

- **Assistant behaviour:** publish the agent in DeepTalk. The page uses the published version on the next call.
- **Embed tokens:** if a widget token is regenerated, update `AGENTS` in `assets/js/call.js`.
- **Allowed domains:** each widget's Allowed Domains in DeepTalk must include `aistra-labs.github.io`.
