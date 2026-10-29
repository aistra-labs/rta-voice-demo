/*
 * Landing page behaviour: motion (GSAP), card spotlight, copy buttons,
 * the hero conversation preview, and coordination between the two call frames
 * so only one assistant can be on a call at a time.
 */
(() => {
  const html = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const AGENT_NAMES = { nol: 'Nol Card Assistant', rta: 'Journey Planner' };

  /* ---------- Nav border on scroll ---------- */
  const nav = document.querySelector('[data-nav]');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Toast ---------- */
  const toast = document.querySelector('[data-toast]');
  let toastTimer;
  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1800);
  };

  /* ---------- Copy card numbers ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const field = Object.assign(document.createElement('textarea'), { value });
        field.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }
      btn.classList.add('is-copied');
      setTimeout(() => btn.classList.remove('is-copied'), 1400);
      showToast(`Copied ${value.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}`);
    });
  });

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

  /* ---------- Hero conversation preview (TextType-style) ---------- */
  const stage = document.querySelector('[data-stage]');
  const userBubble = document.querySelector('[data-bubble-user]');
  const agentTag = document.querySelector('[data-bubble-tag]');
  const agentText = document.querySelector('[data-bubble-text]');
  const EXCHANGES = [
    ['Hi, I need to check my Nol card balance.', 'Nol Card Assistant', 'Hello! I’d be happy to help. Please provide me with your Nol card number.'],
    ['It’s 567, then 391, last four are 8273.', 'Nol Card Assistant', 'Cool. Am I speaking with Pulkit?'],
    ['I want to recharge it by AED 50.', 'Nol Card Assistant', 'Great! I have sent you a link on your registered whatsapp number.'],
    ['How do I get from Dubai Mall to Dubai Marina Walk?', 'Journey Planner', 'Of course! I have three options for you. Option 1: take the Red Line Metro…'],
    ['Which one is the fastest?', 'Journey Planner', 'Option 1 is the fastest, at 1 hour and 1 minute.'],
  ];

  const runConversation = () => {
    let i = 0;
    const gsap = window.gsap;
    const play = () => {
      const [user, tag, reply] = EXCHANGES[i % EXCHANGES.length];
      i += 1;
      const state = { n: 0 };
      const tl = gsap.timeline({ onComplete: () => setTimeout(play, 2600) });
      tl.to([userBubble, agentText.parentElement], { opacity: 0, y: -10, filter: 'blur(6px)', duration: 0.35, ease: 'power2.in' })
        .add(() => { userBubble.textContent = user; agentTag.textContent = tag; agentText.textContent = ''; })
        .fromTo(userBubble, { opacity: 0, y: 16, scale: 0.96, filter: 'blur(6px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.55, ease: 'back.out(1.6)' })
        .fromTo(agentText.parentElement, { opacity: 0, y: 16, scale: 0.96, filter: 'blur(6px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.55, ease: 'back.out(1.6)' }, '+=0.5')
        .add(() => { stage.classList.add('is-speaking'); agentText.classList.add('caret'); })
        .to(state, {
          n: reply.length,
          duration: Math.min(3.2, reply.length * 0.035),
          ease: 'none',
          onUpdate: () => { agentText.textContent = reply.slice(0, Math.round(state.n)); },
        })
        .add(() => { stage.classList.remove('is-speaking'); agentText.classList.remove('caret'); });
    };
    setTimeout(play, 2200);
  };

  /* ---------- Motion layer ---------- */
  const startMotion = () => {
    const { gsap, SplitText, ScrollTrigger } = window;
    if (!gsap || !SplitText || !ScrollTrigger) return false;
    gsap.registerPlugin(SplitText, ScrollTrigger);

    // Hero: words blur in (BlurText), then the supporting lines rise in.
    const split = SplitText.create('[data-split]', { type: 'words', wordsClass: 'word' });
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro
      .from(split.words, { yPercent: 55, opacity: 0, filter: 'blur(14px)', duration: 1, stagger: 0.07 })
      .from('[data-hero-item]', { y: 24, opacity: 0, duration: 0.8, stagger: 0.09 }, '-=0.75')
      .from('.stage', { y: 40, opacity: 0, scale: 0.96, duration: 1.1 }, 0.15);

    // Scroll reveals (AnimatedContent-style), batched so siblings stagger.
    gsap.set('[data-reveal]', { opacity: 0, y: 32 });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, clearProps: 'transform',
      }),
    });

    // Magnetic primary button.
    if (finePointer) {
      document.querySelectorAll('[data-magnet]').forEach((el) => {
        const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.45)' });
        const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.45)' });
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
          yTo((e.clientY - (r.top + r.height / 2)) * 0.38);
        });
        el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      });
    }

    runConversation();
    return true;
  };

  const finish = () => html.classList.add('motion-done');

  if (reduceMotion) {
    finish();
  } else {
    // Scripts are deferred, so GSAP is ready by now unless the CDN failed.
    try { startMotion(); } catch (err) { console.warn('Motion layer skipped:', err); }
    finish();
  }
})();
