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


  /* ───────────── store game page: the PS Store hero ─────────────
     Built once per page in front of Steam's top block, from what the page already
     holds (nothing is fetched, nothing is computed):
       · art      — the game's library hero on Steam's CDN, else its first screenshot
       · title    — .apphub_AppName (logo from the CDN when it exists)
       · chips    — the sale percent (.discount_pct of the base edition — never
                    .bundle_base_discount, which is a struck-through note) with Steam's
                    countdown text, the review summary row, release date, developer
       · price    — Steam's own final / original price text of the base edition
       · buttons  — the primary one CLICKS Steam's own button of the base edition
                    (Add to Cart / Play / Download / Install…), the heart clicks Steam's
                    wishlist links, the others scroll to Steam's editions and gallery
     Steam's release / developer / tag nodes are MOVED into a facts strip (their links
     and the tag "+" keep working). If the page lacks the basics, nothing is built. */
  const SR = /^(ru|uk|be)/i.test(document.documentElement.lang || '') || /russian|ukrainian/i.test(String(window.g_strLanguage || ''));
  const TXT = SR
    ? { editions: 'Все издания', media: 'Медиа', wish: 'В список желаемого', wished: 'В списке желаемого', close: 'Закрыть', prev: 'Назад', next: 'Вперёд', owned: 'В библиотеке' }
    : { editions: 'All editions', media: 'Media', wish: 'Add to wishlist', wished: 'On your wishlist', close: 'Close', prev: 'Previous', next: 'Next', owned: 'In library' };
  const SVG = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20.2s-7.6-4.6-9.2-9.4C1.7 7.4 3.9 4.3 7.2 4.3c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.5 3.1 4.4 6.5-1.6 4.8-9.2 9.4-9.2 9.4z"/></svg>',
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2.2l2.1 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 1.9-1.5L20.5 8H6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19.5" r="1.4" fill="currentColor"/><circle cx="17" cy="19.5" r="1.4" fill="currentColor"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  };
  const $ = (sel, r = document) => r.querySelector(sel);
  const $$ = (sel, r = document) => [...r.querySelectorAll(sel)];
  const text = n => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
  const el = (tag, cls, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'svg') n.innerHTML = v;   // our own static SVG only
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of [].concat(kids)) if (kid) n.append(kid);
    return n;
  };
  const CDN = id => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}`;

  const readProps = () => {
    try {
      const p = JSON.parse(($('.gamehighlight_desktopcarousel') || {}).dataset?.props || 'null');
      return p ? { shots: (p.screenshots || []).filter(x => x && x.full) } : { shots: [] };
    } catch (e) { return { shots: [] }; }
  };
  const legacyShots = () => $$('.highlight_strip_screenshot img, .highlight_screenshot_link').map(n => {
    const full = n.tagName === 'A' ? n.getAttribute('href') : (n.src || '').replace(/\.116x65\.jpg/, '.1920x1080.jpg');
    return full ? { full, standard: n.tagName === 'IMG' ? n.src : full } : null;
  }).filter(Boolean);
  // the base edition: the first purchase block that is not a bundle
  const basePurchase = () => {
    const wraps = $$('#game_area_purchase .game_area_purchase_game_wrapper');
    return wraps.find(w => !w.classList.contains('dynamic_bundle_description')) || wraps[0] || $('#game_area_purchase .game_area_purchase_game') || null;
  };

  const Viewer = (() => {
    let node = null, list = [], i = 0;
    const show = () => {
      node.querySelector('img').src = list[i].full;
      node.querySelector('.count').textContent = `${i + 1} / ${list.length}`;
    };
    const key = e => {
      if (!node || !node.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') { i = (i - 1 + list.length) % list.length; show(); }
      else if (e.key === 'ArrowRight') { i = (i + 1) % list.length; show(); }
    };
    const close = () => { if (node) node.classList.remove('open'); removeEventListener('keydown', key, true); };
    const open = (shots, start) => {
      list = shots; i = start || 0;
      if (!node) {
        node = el('div', 'ps5-viewer', { role: 'dialog', 'aria-modal': 'true' }, [
          el('img', '', { alt: '' }),
          el('button', 'prev', { type: 'button', 'aria-label': TXT.prev, svg: SVG.left }),
          el('button', 'next', { type: 'button', 'aria-label': TXT.next, svg: SVG.right }),
          el('button', 'close', { type: 'button', 'aria-label': TXT.close, svg: SVG.close }),
          el('div', 'count'),
        ]);
        node.addEventListener('click', e => {
          if (e.target.closest('.prev')) { i = (i - 1 + list.length) % list.length; show(); }
          else if (e.target.closest('.next')) { i = (i + 1) % list.length; show(); }
          else if (e.target.closest('.close') || e.target === node) close();
        });
        document.body.appendChild(node);
      }
      show();
      node.classList.add('open');
      addEventListener('keydown', key, true);
    };
    return { open };
  })();

  const buildHero = () => {
    if (!isStore || state.kind !== 'app' || document.querySelector('[data-ps5-hero]')) return;
    const id = (/^\/app\/(\d+)/.exec(location.pathname) || [])[1];
    const name = text($('.apphub_AppName')) || text($('#appHubAppName'));
    const anchor = $('.game_page_background.game .page_top_area') || $('.page_title_area') || $('#game_highlights');
    if (!id || !name || !anchor) return;
    const base = basePurchase();
    const shots = (() => { const p = readProps().shots; return p.length ? p : legacyShots(); })();

    // art: library hero → first screenshot
    const art = el('img', 'ps5-hero-art', { alt: '', decoding: 'async' });
    const arts = [`${CDN(id)}/library_hero.jpg`, ...(shots[0] ? [shots[0].full] : [])];
    let ai = 0;
    art.onload = () => art.classList.add('on');
    art.onerror = () => { if (++ai < arts.length) art.src = arts[ai]; };
    art.src = arts[0];

    const logo = el('img', 'ps5-hero-logo', { alt: '', decoding: 'async' });
    const title = el('h1', 'ps5-hero-title', { text: name });

    // chips
    const chips = el('ul', 'ps5-hero-chips');
    const pct = base && base.querySelector('.discount_block:not(.no_discount) .discount_pct');
    if (pct && /\d/.test(text(pct))) {
      const cd = base.querySelector('.game_purchase_discount_countdown');
      chips.append(el('li', 'ps5-hero-chip sale', { text: [text(pct), cd ? text(cd).replace(/^[^!]*!\s*/, '') : ''].filter(Boolean).join(' · ') }));
    }
    const rows = $$('#userReviews .user_reviews_summary_row');
    const row = rows.find(r => r.matches('[itemprop=aggregateRating]')) || rows[rows.length - 1];
    const summary = row && row.querySelector('.game_review_summary');
    if (summary && text(summary)) {
      const tone = summary.classList.contains('positive') ? 'ok' : summary.classList.contains('mixed') ? 'warn' : summary.classList.contains('negative') ? 'bad' : '';
      const share = ((row.getAttribute('data-tooltip-html') || '').match(/(\d+)\s?%/) || [])[1];
      chips.append(el('li', '', {}, [el('a', 'ps5-hero-chip', { href: '#app_reviews_hash', 'data-tone': tone }, [el('span', 'dot'), document.createTextNode(text(summary) + (share ? ` · ${share}%` : ''))])]));
    }
    const date = text($('.glance_ctn .release_date .date'));
    if (date) chips.append(el('li', 'ps5-hero-chip', { text: date }));
    const dev = text($('.glance_ctn #developers_list a, .glance_ctn .dev_row .summary a'));
    if (dev) chips.append(el('li', 'ps5-hero-chip', { text: dev }));

    const desc = text($('.game_description_snippet'));

    // price: Steam's own strings of the base edition
    let price = null;
    const owned = $('.game_area_already_owned');
    if (owned) price = el('div', 'ps5-hero-owned', { text: text(owned.querySelector('.already_in_library')) || TXT.owned });
    else if (base) {
      const sale = base.querySelector('.discount_block:not(.no_discount)');
      if (sale && sale.querySelector('.discount_final_price')) {
        price = el('div', 'ps5-hero-price', {}, [
          sale.querySelector('.discount_pct') ? el('span', 'pct', { text: text(sale.querySelector('.discount_pct')) }) : null,
          sale.querySelector('.discount_original_price') ? el('span', 'orig', { text: text(sale.querySelector('.discount_original_price')) }) : null,
          el('span', 'final', { text: text(sale.querySelector('.discount_final_price')) }),
        ]);
      } else {
        const plain = base.querySelector('.discount_block.no_discount .discount_final_price, .game_purchase_price');
        if (plain && text(plain)) price = el('div', 'ps5-hero-price', {}, [el('span', 'final', { text: text(plain) })]);
      }
    }

    // buttons
    const buy = el('div', 'ps5-hero-buy', {}, [price]);
    const steamBtn = owned
      ? owned.querySelector('.game_area_already_owned_btn a, a.btn_green_steamui')
      : base && base.querySelector('.btn_addtocart .btn_green_steamui, .game_purchase_action a.btn_green_steamui, .game_purchase_action .btn_green_steamui, .game_purchase_action a[href]');
    if (steamBtn && text(steamBtn)) {
      const primary = el('button', 'ps5-hero-btn primary', { type: 'button', svg: owned ? '' : SVG.cart });
      primary.append(document.createTextNode(text(steamBtn)));
      primary.addEventListener('click', () => steamBtn.click());
      buy.append(primary);
    }
    const add = $('#add_to_wishlist_area'), added = $('#add_to_wishlist_area_success');
    if (add && added) {
      const addLink = add.querySelector('a'), removeLink = added.querySelector('a');
      const wish = el('button', 'ps5-hero-btn ghost icon wish', { type: 'button', svg: SVG.heart });
      const isOn = () => getComputedStyle(added).display !== 'none';
      const sync = () => { const on = isOn(); wish.setAttribute('aria-pressed', String(on)); wish.title = on ? TXT.wished : TXT.wish; wish.setAttribute('aria-label', wish.title); };
      wish.addEventListener('click', () => { const a = isOn() ? removeLink : addLink; if (a) a.click(); setTimeout(sync, 350); });
      const mo = new MutationObserver(sync);
      [add, added].forEach(n => mo.observe(n, { attributes: true, attributeFilter: ['style', 'class'] }));
      sync();
      buy.append(wish);
    }
    const go = (label, target) => {
      const b = el('button', 'ps5-hero-btn ghost', { type: 'button', text: label });
      b.addEventListener('click', () => { const t = $(target); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      return b;
    };
    if ($('#game_area_purchase') && $$('#game_area_purchase .game_area_purchase_game_wrapper').length > 1) buy.append(go(TXT.editions, '#game_area_purchase'));
    if ($('#game_highlights')) buy.append(go(TXT.media, '#game_highlights'));

    // screenshot thumbnails: a click shows it behind the hero, a second click opens the viewer
    const thumbs = shots.slice(0, 3).map((sh, k) => {
      const b = el('button', 'ps5-hero-shot', { type: 'button', 'aria-label': `${TXT.media} ${k + 1}` }, [el('img', '', { src: sh.standard || sh.thumbnail || sh.full, alt: '', loading: 'lazy', decoding: 'async' })]);
      b.addEventListener('click', () => {
        if (b.classList.contains('on')) { Viewer.open(shots, k); return; }
        thumbs.forEach(t => t.classList.remove('on'));
        b.classList.add('on');
        art.classList.remove('on');
        art.onload = () => art.classList.add('on');
        art.src = sh.full;
      });
      return b;
    });

    const hero = el('section', 'ps5-hero', { 'data-ps5-hero': '' }, [
      el('div', 'ps5-hero-stage', {}, [art]),
      el('div', 'ps5-hero-shade'),
      el('div', 'ps5-hero-inner', {}, [
        el('div', 'ps5-hero-main', {}, [logo, title, chips.children.length ? chips : null, desc ? el('p', 'ps5-hero-desc', { text: desc }) : null, buy]),
        thumbs.length ? el('div', 'ps5-hero-shots', {}, thumbs) : null,
      ]),
    ]);
    logo.onload = () => { if (logo.naturalWidth > 40) hero.classList.add('has-logo'); };
    logo.src = `${CDN(id)}/logo.png`;

    // facts: Steam's own nodes, moved (not copied)
    const factNodes = $$('.glance_ctn .release_date, .glance_ctn .dev_row');
    const tags = $('.glance_ctn .glance_tags_ctn');
    const facts = factNodes.length || tags ? el('div', 'ps5-facts', {}, [...factNodes, tags]) : null;

    anchor.before(...[hero, facts].filter(Boolean));
    root.classList.add('ps5-hero-on');
    const sbw = () => root.style.setProperty('--ps5-sbw', Math.max(0, innerWidth - root.clientWidth) + 'px');
    sbw();
    addEventListener('resize', sbw, { passive: true });
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
    try { buildHero(); } catch (e) { console.warn('[PS5] store hero', e); }
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
