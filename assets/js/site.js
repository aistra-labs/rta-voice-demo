/*
 * Page behaviour: intro motion (GSAP), card spotlight, and coordination between
 * the two call frames so only one assistant can be on a call at a time.
 */
(() => {
  const html = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const AGENT_NAMES = { nol: 'Nol Card Assistant', rta: 'Journey Planner' };

  /* ---------- Spotlight cards (cursor-following glow) ---------- */
  if (finePointer) {
    document.querySelectorAll('.spotlight').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Call frames: sizing and one-call-at-a-time ---------- */
  const frames = {};
  document.querySelectorAll('[data-frame]').forEach((f) => { frames[f.dataset.frame] = f; });
  const cards = {};
  document.querySelectorAll('[data-agent]').forEach((c) => { cards[c.dataset.agent] = c; });
  const livePill = document.querySelector('[data-live-pill]');
  const liveText = document.querySelector('[data-live-text]');
  let activeAgent = null;

  const sendToFrame = (agent, message) => {
    const frame = frames[agent];
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ source: 'rta-voice-demo', ...message }, window.location.origin);
    }
  };

  const setActive = (agent) => {
    if (agent === activeAgent) return;
    activeAgent = agent;
    Object.keys(cards).forEach((key) => {
      cards[key].classList.toggle('is-live', key === agent);
      cards[key].classList.toggle('is-waiting', Boolean(agent) && key !== agent);
      sendToFrame(key, { type: 'lock', locked: Boolean(agent) && key !== agent });
    });
    livePill.classList.toggle('is-oncall', Boolean(agent));
    liveText.textContent = agent ? `On a call: ${AGENT_NAMES[agent]}` : 'Live demo';
  };

  window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin) return;
    const data = e.data;
    if (!data || data.source !== 'rta-voice-demo' || !frames[data.agent]) return;
    if (data.type === 'height' && data.height > 0) {
      frames[data.agent].style.height = `${Math.ceil(data.height)}px`;
    } else if (data.type === 'status') {
      if (data.active) setActive(data.agent);
      else if (activeAgent === data.agent) setActive(null);
    } else if (data.type === 'ready' && activeAgent && activeAgent !== data.agent) {
      sendToFrame(data.agent, { type: 'lock', locked: true });
    }
  });

  /* ---------- Intro motion ---------- */
  const startMotion = () => {
    const { gsap, SplitText } = window;
    if (!gsap || !SplitText) return;
    gsap.registerPlugin(SplitText);

    // Heading words blur in (BlurText), then the line below and the two cards rise in.
    // fromTo with explicit end values: the tweens never read end states from CSS,
    // and their start states are applied before the next paint, so nothing flashes.
    const split = SplitText.create('[data-split]', { type: 'words', wordsClass: 'word' });
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo('.label[data-intro]', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
      .fromTo(split.words, { yPercent: 55, opacity: 0, filter: 'blur(14px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1, stagger: 0.06 }, '-=0.35')
      .fromTo('.assistants__sub', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, '-=0.6')
      .fromTo('[data-card]', { y: 48, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 1, stagger: 0.12, clearProps: 'transform' }, '-=0.5');
  };

  // Lift the CSS pre-hide first; the timeline below applies its own start states synchronously.
  html.classList.add('motion-done');
  if (!reduceMotion) {
    try { startMotion(); } catch (err) { console.warn('Motion layer skipped:', err); }
  }
})();
