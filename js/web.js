/* ==========================================================================
   PlayStation 5 — Millennium theme · runtime for Steam's web pages
   --------------------------------------------------------------------------
   Millennium injects this file (skin.json → "webkitJS") and css/webkit/web.css
   ("webkitCSS") into EVERY page Steam's built-in browser loads. That is the
   only reliable route: Millennium matches web patches with std::regex_match
   against the whole URL and applies conditional web CSS only once the option
   has been saved — the reason v1.0.0's store styling never showed up.

   So this script decides where the PS5 design applies:
     · store.steampowered.com and steamcommunity.com only (checkout, login and
       Steam's hardware landing pages are left alone),
     · unless «Store and Community → Steam default» is chosen (--ps5-web: off).
   It then marks the page for the stylesheet:
     html.ps5-web, html.ps5-store | html.ps5-community, html.ps5-p-<kind>
     [data-ps5-mount="<name>"]  Steam's React mount points (data-featuretarget)
     [data-ps5-strip]           the store's menu strip (React, hashed classes)
   One MutationObserver, batched to at most four passes a second; it stops
   when the page is hidden into the back/forward cache and on unload.
   ========================================================================== */
(() => {
  'use strict';
  if (window.__ps5Web) return;
  const host = location.hostname;
  const isStore = host === 'store.steampowered.com';
  const isCommunity = host === 'steamcommunity.com';
  if (!isStore && !isCommunity) return;
  // pages that must look exactly like Steam: payments, sign-in, the light hardware pages
  if (/^\/(checkout|login|join|widget|hardware|steamdeck\w*|about|steamcontroller|vr)(\/|$)/i.test(location.pathname)) return;
  if (isCommunity && /^\/(openid|login|linkfilter)(\/|$)/i.test(location.pathname)) return;

  const root = document.documentElement;
  const state = window.__ps5Web = { kind: '', on: false };

  const STORE_PAGES = [
    ['wishlist', /^\/wishlist/i], ['app', /^\/app\//i], ['sub', /^\/(sub|bundle)\//i], ['search', /^\/search/i],
    ['cart', /^\/cart/i], ['account', /^\/account/i], ['charts', /^\/charts/i], ['explore', /^\/explore/i],
    ['category', /^\/(category|tags|genre|curator|developer|publisher|franchise|specials|sale|vr|greatondeck)/i],
    ['news', /^\/news/i], ['points', /^\/points/i], ['calendar', /^\/personalcalendar/i], ['recommender', /^\/recommender/i],
    ['home', /^\/($|\?|home|\?.*)/i],
  ];
  const COMMUNITY_PAGES = [
    ['profile', /^\/(id|profiles)\/[^/]+\/?($|\?|home)/i], ['games', /^\/(id|profiles)\/[^/]+\/games/i],
    ['achievements', /^\/(id|profiles)\/[^/]+\/(stats|achievements)/i], ['friends', /^\/(id|profiles)\/[^/]+\/friends/i],
    ['badges', /^\/(id|profiles)\/[^/]+\/(badges|gamecards)/i], ['inventory', /^\/(id|profiles)\/[^/]+\/inventory/i],
    ['screenshots', /^\/(id|profiles)\/[^/]+\/screenshots|^\/sharedfiles\/filedetails.*screenshot/i],
    ['userpage', /^\/(id|profiles)\//i],
    ['workshop', /^\/(workshop|sharedfiles)/i], ['discussions', /^\/discussions|\/discussions\//i],
    ['market', /^\/market/i], ['hub', /^\/app\//i], ['groups', /^\/groups\//i], ['home', /^\/($|\?|home)/i],
  ];
  const kindOf = () => {
    const path = location.pathname + location.search;
    const list = isStore ? STORE_PAGES : COMMUNITY_PAGES;
    const hit = list.find(([, re]) => re.test(path));
    return hit ? hit[0] : 'other';
  };

  const disabled = () => {
    try { return getComputedStyle(root).getPropertyValue('--ps5-web').trim() === 'off'; } catch (e) { return false; }
  };

  // the art of a game page, for the soft ground behind it (Steam already ships it in the page)
  const paintArt = () => {
    if (state.kind !== 'app' && state.kind !== 'hub') { root.style.removeProperty('--ps5-page-art'); return; }
    let url = '';
    const bg = document.querySelector('.game_page_background[style*="url"], .apphub_background[style*="url"], .page_background_holder[style*="url"]');
    if (bg) { const m = /url\((['"]?)(.*?)\1\)/.exec(bg.getAttribute('style') || ''); if (m) url = m[2]; }
    if (!url) { const meta = document.querySelector('meta[property="og:image"]'); if (meta) url = meta.content || ''; }
    if (url && /^https?:\/\//.test(url)) root.style.setProperty('--ps5-page-art', `url("${url.replace(/"/g, '%22')}")`);
  };

  const markMounts = () => {
    for (const m of document.querySelectorAll('[data-featuretarget]:not([data-ps5-mount])')) {
      m.setAttribute('data-ps5-mount', m.getAttribute('data-featuretarget') || '');
    }
    // game capsules inside React blocks: marked once, so the stylesheet needs no :has()
    for (const a of document.querySelectorAll('[data-ps5-mount] a[href*="/app/"]:not([data-ps5-cap])')) {
      a.setAttribute('data-ps5-cap', a.querySelector('img') ? '1' : '0');
    }
    // the store's menu strip (React): the panel whose navigation holds the search form
    if (isStore) {
      for (const strip of document.querySelectorAll('.Panel:has(> [role=navigation] form[role=search]):not([data-ps5-strip])')) {
        strip.setAttribute('data-ps5-strip', '');
      }
    }
  };

  let last = 0, timer = 0, observer = null;
  const pass = () => {
    timer = 0;
    last = performance.now();
    if (disabled()) { turnOff(); return; }
    if (!state.on) {
      state.on = true;
      root.classList.add('ps5-web', isStore ? 'ps5-store' : 'ps5-community');
    }
    const kind = kindOf();
    if (kind !== state.kind) {
      if (state.kind) root.classList.remove('ps5-p-' + state.kind);
      root.classList.add('ps5-p-' + kind);
      state.kind = kind;
    }
    markMounts();
    paintArt();
  };
  const soon = () => {
    if (timer) return;
    timer = setTimeout(pass, Math.max(0, 250 - (performance.now() - last)));
  };
  const turnOff = () => {
    state.on = false;
    root.classList.remove('ps5-web', 'ps5-store', 'ps5-community', 'ps5-p-' + state.kind);
    state.kind = '';
    stop();
  };
  const start = () => {
    if (observer) return;
    observer = new MutationObserver(soon);
    observer.observe(root, { childList: true, subtree: true });
  };
  const stop = () => {
    if (observer) { observer.disconnect(); observer = null; }
    if (timer) { clearTimeout(timer); timer = 0; }
  };

  // the React store changes pages without reloading: follow its history
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    if (typeof orig !== 'function' || orig.__ps5) continue;
    const wrapped = function (...args) { const r = orig.apply(this, args); soon(); return r; };
    wrapped.__ps5 = true;
    history[fn] = wrapped;
  }
  addEventListener('popstate', soon);
  addEventListener('load', soon);   // the option stylesheet (web-off.css) may only be applied now
  addEventListener('pagehide', stop);
  addEventListener('pageshow', e => { if (e.persisted && state.on) { start(); soon(); } });

  pass();
  if (state.on) start();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', soon, { once: true });
})();
