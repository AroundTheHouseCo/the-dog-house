/* Show-password eye (Jack, 2026-11-27). Every password box in RAVN gets a
   "Show / Hide" toggle on its right edge: sign-in (password and PIN) and any
   password box added later. One helper for the whole app, so a new password
   box gets it without anyone remembering to add it.

   How: a MutationObserver watches the page; each <input type="password"> it
   finds is wrapped once in a positioned box with the toggle button inside.
   The wrapper copies the input's own width limit and margin, so the layout
   doesn't move. The button only flips the input between type="password" and
   type="text"; it never reads or stores the value. Brand rule: icon with a
   word (Lucide eye / eye-off, 2px stroke). */
(function () {
  const SVG = {
    eye: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
    off: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>'
  };

  function style() {
    if (document.getElementById('pwEyeStyle')) return;
    const s = document.createElement('style');
    s.id = 'pwEyeStyle';
    s.textContent =
      '.pw-eye-wrap{position:relative;display:block;width:100%;box-sizing:border-box}' +
      '.pw-eye-wrap>input{width:100%!important;max-width:none!important;margin:0!important;padding-right:96px!important;box-sizing:border-box}.pw-eye-wrap>input.rv-pin{padding-left:96px!important}' +
      '.pw-eye-btn{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;gap:6px;' +
      'min-height:44px;padding:0 10px;border:0;background:transparent;color:#3A3A3C;font:600 16px/1 Figtree,system-ui,sans-serif;' +
      'letter-spacing:normal;cursor:pointer;border-radius:10px;-webkit-tap-highlight-color:transparent}' +
      '.pw-eye-btn:focus-visible{outline:2px solid #3A3A3C;box-shadow:0 0 0 4px rgba(249,161,27,.35)}';
    document.head.appendChild(s);
  }

  function setState(btn, input, shown) {
    input.type = shown ? 'text' : 'password';
    btn.setAttribute('aria-pressed', shown ? 'true' : 'false');
    btn.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
    btn.innerHTML = (shown ? SVG.off : SVG.eye) + '<span>' + (shown ? 'Hide' : 'Show') + '</span>';
  }

  function enhance(input) {
    if (input.dataset.pwEye) return;
    input.dataset.pwEye = '1';
    const cs = getComputedStyle(input);
    const wrap = document.createElement('span');
    wrap.className = 'pw-eye-wrap';
    const limit = cs.maxWidth !== 'none' ? cs.maxWidth : (/px$/.test(cs.width) && cs.width !== '0px' ? cs.width : '');
    // A narrow box (the 4-digit PIN) is widened so the button never covers the digits.
    if (limit) wrap.style.maxWidth = (parseFloat(limit) < 300 ? '300px' : limit);
    wrap.style.margin = cs.margin;
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-eye-btn';
    setState(btn, input, false);
    // mousedown: keep the cursor in the box on desktop.
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      const pos = input.selectionStart;
      setState(btn, input, input.type === 'password');
      try { input.focus(); if (pos != null) input.setSelectionRange(pos, pos); } catch (e) { /* number pads */ }
    });
    wrap.appendChild(btn);
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('input[type="password"]')) enhance(root);
    root.querySelectorAll('input[type="password"]').forEach(enhance);
  }

  function start() {
    style();
    scan(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.pwEyeScan = scan;
})();
