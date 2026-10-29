/*
 * One call control per frame. Loads the DeepTalk widget for the agent named in
 * ?agent=, hides the widget's own panel, and drives it through its public API
 * (start / end / onStatusChange) so the call UI matches the Aistra design.
 *
 * The embed tokens below are public by design: each one only starts web calls
 * with its own agent, and only from the domains allowed in DeepTalk.
 */
(() => {
  const API = 'https://deeptalk-official-dev.deeptalk.work';
  const AGENTS = {
    nol: { token: 'emb_ygTox3FnCvc1pPQ1NRTChaezHJjmW3DfSsqZqFetYII', name: 'Nol Card Assistant' },
    rta: { token: 'emb_ZTBGvJQmf1L2JFVkjJSuD80aLjd4iPYSNY5ZlvHbM3U', name: 'Journey Planner' },
  };

  const agentKey = new URLSearchParams(window.location.search).get('agent');
  const agent = AGENTS[agentKey];

  const root = document.querySelector('[data-call]');
  const orb = document.querySelector('[data-orb]');
  const btn = document.querySelector('[data-btn]');
  const btnLabel = document.querySelector('[data-btn-label]');
  const statusEl = document.querySelector('[data-status]');
  const subEl = document.querySelector('[data-sub]');
  const timerEl = document.querySelector('[data-timer]');

  // Copy per view state: [status, subtext, button label, button disabled]
  const VIEWS = {
    loading: ['Getting ready…', 'Connecting to the assistant.', 'Start call', true],
    idle: ['Ready when you are', 'Press Start call, then allow your microphone.', 'Start call', false],
    connecting: ['Connecting…', 'Allow microphone access if your browser asks.', 'Cancel', false],
    connected: ['On a call', 'Speak naturally. You can interrupt at any time.', 'End call', false],
    ended: ['Call ended', 'Press Start call to talk again.', 'Start call', false],
    failed: ['Call couldn’t connect', 'Check your connection and try again.', 'Try again', false],
    unavailable: ['Assistant unavailable', 'Please refresh the page in a moment.', 'Refresh', false],
    locked: ['Another call is live', 'End that call to talk to this assistant.', 'Start call', true],
  };

  let widget = null;
  let phase = 'loading';     // last state reported by the widget (or our own loading/unavailable)
  let locked = false;        // set by the page while the other assistant is on a call
  let failureDetail = '';
  let startedAt = 0;
  let timer = null;

  const post = (message) => {
    if (window.parent !== window) {
      window.parent.postMessage({ source: 'rta-voice-demo', agent: agentKey, ...message }, window.location.origin);
    }
  };
  const isActive = () => phase === 'connecting' || phase === 'connected';
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function render() {
    const view = locked && !isActive() ? 'locked' : phase;
    const [status, sub, label, disabled] = VIEWS[view];
    root.dataset.state = view;
    statusEl.textContent = status;
    subEl.textContent = view === 'failed' && failureDetail ? failureDetail : sub;
    btnLabel.textContent = label;
    btn.disabled = disabled;
    orb.disabled = disabled;
    const orbLabel = isActive() ? `End call with the ${agent.name}` : `Start call with the ${agent.name}`;
    orb.setAttribute('aria-label', orbLabel);
  }

  function setPhase(next) {
    const wasActive = isActive();
    phase = next;
    if (next === 'connected') startTimer();
    if (next !== 'connected') stopTimer();
    render();
    if (wasActive !== isActive()) post({ type: 'status', active: isActive(), phase });
  }

  function startTimer() {
    startedAt = Date.now();
    timerEl.textContent = '00:00';
    clearInterval(timer);
    timer = setInterval(() => { timerEl.textContent = fmt(Math.floor((Date.now() - startedAt) / 1000)); }, 500);
  }
  function stopTimer() { clearInterval(timer); timer = null; }

  /* ---------- Assistant voice level: drives the orb while it speaks ---------- */
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let raf = 0;

  function primeAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { audioCtx = null; }
  }

  function watchLevel() {
    if (phase !== 'connected' || !audioCtx || analyser) return;
    const audioEl = document.querySelector('#deeptalk-inline-container audio');
    const stream = audioEl && audioEl.srcObject;
    if (!stream || !stream.getAudioTracks().length) { setTimeout(watchLevel, 250); return; }
    try {
      source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser); // analysis only: not routed to the speakers, the widget plays the audio
    } catch { return; }
    const buf = new Uint8Array(analyser.fftSize);
    let smooth = 0;
    const loop = () => {
      if (!analyser) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 1) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const level = Math.min(1, Math.sqrt(sum / buf.length) * 4.5);
      smooth += (level - smooth) * (level > smooth ? 0.35 : 0.12);
      root.style.setProperty('--level', smooth.toFixed(3));
      root.classList.toggle('is-speaking', smooth > 0.06);
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  function stopLevel() {
    cancelAnimationFrame(raf);
    try { if (source) source.disconnect(); } catch { /* already gone */ }
    source = null;
    analyser = null;
    root.style.setProperty('--level', '0');
    root.classList.remove('is-speaking');
  }

  /* ---------- Widget wiring ---------- */
  function onStatus(status, _text, subtext) {
    if (status === 'connecting') {
      failureDetail = '';
      setPhase('connecting');
    } else if (status === 'connected') {
      setPhase('connected');
      watchLevel();
    } else if (status === 'failed') {
      stopLevel();
      failureDetail = phase === 'connected'
        ? 'The call dropped. Press Try again to reconnect.'
        : (subtext && !/^click/i.test(subtext) ? subtext : '');
      setPhase('failed');
    } else if (status === 'idle') {
      stopLevel();
      const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      const wasConnected = phase === 'connected';
      setPhase(wasConnected ? 'ended' : 'idle');
      if (wasConnected) timerEl.textContent = fmt(elapsed);
      startedAt = 0;
    }
  }

  function press() {
    if (phase === 'unavailable') { window.location.reload(); return; }
    if (!widget || (locked && !isActive())) return;
    if (isActive()) { widget.end(); return; }
    primeAudio(); // must happen inside the click so the browser lets audio analysis run
    widget.start();
  }

  btn.addEventListener('click', press);
  orb.addEventListener('click', press);

  window.addEventListener('message', (e) => {
    if (e.origin !== window.location.origin) return;
    const data = e.data;
    if (!data || data.source !== 'rta-voice-demo' || data.type !== 'lock') return;
    locked = Boolean(data.locked);
    render();
  });

  // Keep the parent frame sized to this control.
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => post({ type: 'height', height: root.getBoundingClientRect().height })).observe(root);
  }

  // End an active call if the visitor leaves or reloads the page.
  window.addEventListener('pagehide', () => { if (widget && isActive()) widget.end(); });

  if (!agent) {
    setPhase('unavailable');
    return;
  }
  render();

  let pageUrl = window.location.href;
  try { pageUrl = window.parent.location.href; } catch { /* cross-origin parent */ }

  const script = document.createElement('script');
  script.id = 'deeptalk-widget';
  script.async = true;
  script.src = `${API}/embed/deeptalk-widget.js?token=${agent.token}&environment=production&apiEndpoint=${API}`;
  script.setAttribute('data-deeptalk-context', JSON.stringify({
    page_url: pageUrl,
    today: new Date().toISOString().slice(0, 10),
  }));
  script.onerror = () => setPhase('unavailable');
  document.head.appendChild(script);

  const started = Date.now();
  (function waitForWidget() {
    if (!window.DeepTalkWidget) {
      if (Date.now() - started > 20000) { setPhase('unavailable'); return; }
      setTimeout(waitForWidget, 100);
      return;
    }
    widget = window.DeepTalkWidget;
    widget.onStatusChange(onStatus);
    widget.onError((err) => {
      if (err && err.message && !/container element/i.test(err.message)) failureDetail = err.message;
    });
    Promise.resolve(widget.init())
      .then(() => {
        const ok = widget.getState && widget.getState().isInitialized;
        setPhase(ok ? 'idle' : 'unavailable');
        post({ type: 'ready' });
      })
      .catch(() => setPhase('unavailable'));
  })();
})();
