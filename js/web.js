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
  // v1.4.0: the profile page itself stays exactly as Steam draws it (owners' own backgrounds
  // and showcases); v1.6.0: its tabs (activity, friends, badges, inventory, content…) get the theme
  if (isCommunity && /^\/(id|profiles)\/[^/]+\/?$/i.test(location.pathname)) return;

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
    ['activity', /^\/(id|profiles)\/[^/]+\/home/i], ['games', /^\/(id|profiles)\/[^/]+\/games/i],
    ['achievements', /^\/(id|profiles)\/[^/]+\/(stats|achievements)/i],
    ['friends', /^\/(id|profiles)\/[^/]+\/(friends|groups|followedgames|following)(\/|$|\?)/i],
    ['badges', /^\/(id|profiles)\/[^/]+\/(badges|gamecards|badge)/i], ['inventory', /^\/(id|profiles)\/[^/]+\/(inventory|tradeoffers)/i],
    ['screenshots', /^\/(id|profiles)\/[^/]+\/(screenshots|images|videos|myworkshopfiles|mycollections|recommended|reviews)|^\/sharedfiles\/filedetails.*screenshot/i],
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
    const title = el('h1', 'ps5-hero-title' + (name.length > 42 ? ' is-long' : ''), { text: name, title: name });

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
        thumbs.length > 1 ? el('div', 'ps5-hero-shots', {}, thumbs) : null,
      ]),
    ]);
    logo.onload = () => { if (logo.naturalWidth > 40) hero.classList.add('has-logo'); };
    logo.src = `${CDN(id)}/logo.png`;

    const about = buildAbout();
    // media on one side, the facts and reviews on the other
    const gallery = $('#game_highlights');
    let split = null;
    if (gallery && about) {
      split = el('div', 'ps5-split', {}, [el('div', 'ps5-split-media'), el('div', 'ps5-split-side', {}, [...about.children])]);
      anchor.before(hero, split);
      split.firstChild.appendChild(gallery);   // the React carousel moves with its container
    } else {
      anchor.before(...[hero, about].filter(Boolean));
    }
    root.classList.add('ps5-hero-on');
    widenGallery(shots);
    // one width system: the hero's content lines up with Steam's page column
    const fit = () => {
      root.style.setProperty('--ps5-sbw', Math.max(0, innerWidth - root.clientWidth) + 'px');
      const col = $('.page_content_ctn .page_content') || $('.page_content') || anchor.parentElement;
      const cs = col && getComputedStyle(col);
      const w = col ? Math.round(col.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) : 0;
      if (w > 400) root.style.setProperty('--ps5-content-w', w + 'px');
    };
    fit();
    addEventListener('resize', fit, { passive: true });
  };

  /* ───────────── "About this game": two balanced columns + compact reviews ─────────────
     Left: release date · developer · publisher. Right: genres · tags. Values are Steam's
     own: developer / publisher / genre links are cloned anchors (plain links), the tag row
     is MOVED so its "+" keeps working. Rows with no data are not drawn. Reviews: the
     score rows Steam already prints (#userReviews) — label, share, count, link. */
  const ICO = {
    date: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g></svg>',
    dev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8.5 8 4.5 12l4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13"/></svg>',
    pub: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20.5V8l8-4.5L20 8v12.5"/><path d="M9 20.5v-6h6v6M4 20.5h16"/></g></svg>',
    genre: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><circle cx="17" cy="17" r="3.5"/></g></svg>',
    tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8.3" cy="8.3" r="1.6"/></g></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/></svg>',
  };
  const L = SR
    ? { about: 'Об игре', release: 'Дата выхода', dev: 'Разработчик', pub: 'Издатель', genres: 'Жанры', tags: 'Метки', reviews: 'Обзоры пользователей', recent: 'Недавние', all: 'Все', count: n => `${n} обзоров`, read: 'Читать обзоры', full: 'Во весь экран' }
    : { about: 'About this game', release: 'Release date', dev: 'Developer', pub: 'Publisher', genres: 'Genres', tags: 'Tags', reviews: 'User reviews', recent: 'Recent', all: 'All', count: n => `${n} reviews`, read: 'Read reviews', full: 'Full screen' };
  const links = nodes => {
    const out = [];
    const seen = new Set();
    for (const a of nodes) {
      const t = text(a);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      const c = el('a', 'ps5-info-link', { href: a.getAttribute('href') || '#', text: t });
      out.push(c);
    }
    return out;
  };
  const buildAbout = () => {
    const glance = $('.glance_ctn');
    const devRows = $$('.glance_ctn .dev_row');
    const isPub = r => /publisher|издател|editeur|verleger|editor/i.test(text(r.querySelector('.subtitle')));
    const devRow = devRows.find(r => !isPub(r)) || devRows[0];
    const pubRow = devRows.find(isPub);
    const rowsL = [
      ['date', L.release, text($('.glance_ctn .release_date .date')) ? [document.createTextNode(text($('.glance_ctn .release_date .date')))] : []],
      ['dev', L.dev, devRow ? links(devRow.querySelectorAll('a')) : []],
      ['pub', L.pub, pubRow ? links(pubRow.querySelectorAll('a')) : []],
    ];
    const genreLinks = links($$('#genresAndManufacturer a[href*="/genre/"], .details_block a[href*="/genre/"]'));
    const tagsNode = $('.glance_ctn .glance_tags_ctn');
    const rowsR = [
      ['genre', L.genres, genreLinks],
      ['tag', L.tags, tagsNode ? [tagsNode] : []],
    ];
    const row = ([ico, label, vals]) => vals.length ? el('div', 'ps5-info-row', {}, [
      el('span', 'ps5-info-ico', { svg: ICO[ico] }),
      el('span', 'ps5-info-label', { text: label }),
      el('span', 'ps5-info-value', {}, vals.flatMap((v, i) => (i && v.nodeType === 1 && v.classList.contains('ps5-info-link') ? [document.createTextNode(', '), v] : [v]))),
    ]) : null;
    const left = rowsL.map(row).filter(Boolean);
    const right = rowsR.map(row).filter(Boolean);

    // reviews: Steam's summary rows
    const revRows = $$('#userReviews .user_reviews_summary_row').map(r => {
      const summary = r.querySelector('.game_review_summary');
      if (!summary || !text(summary)) return null;
      const tone = summary.classList.contains('positive') ? 'ok' : summary.classList.contains('mixed') ? 'warn' : summary.classList.contains('negative') ? 'bad' : '';
      const share = ((r.getAttribute('data-tooltip-html') || '').match(/(\d+)\s?%/) || [])[1] || '';
      const count = (text(r.querySelector('.responsive_hidden')) || '').replace(/[()]/g, '').trim();
      const sub = text(r.querySelector('.subtitle')).replace(/:$/, '');
      const all = r.matches('[itemprop=aggregateRating]') || /all|все/i.test(sub);
      return { tone, share, count, label: text(summary), sub, all };
    }).filter(Boolean);
    const main = revRows.find(r => r.all) || revRows[revRows.length - 1];
    const other = revRows.filter(r => r !== main);
    const reviews = main ? el('section', 'ps5-reviews', { 'data-tone': main.tone }, [
      el('h3', 'ps5-about-title', { text: L.reviews }),
      el('div', 'ps5-rev-main', {}, [
        main.share ? el('span', 'ps5-rev-share', { text: main.share + '%' }) : null,
        el('div', 'ps5-rev-text', {}, [
          el('span', 'ps5-rev-label', { text: main.label }),
          main.count ? el('span', 'ps5-rev-count', { text: /\d/.test(main.count) && !/[a-zа-я]/i.test(main.count) ? L.count(main.count) : main.count }) : null,
        ]),
      ]),
      main.share ? el('div', 'ps5-rev-bar', {}, [el('i', '', { style: `width:${Math.max(0, Math.min(100, +main.share))}%` })]) : null,
      ...other.map(o => el('div', 'ps5-rev-other', { 'data-tone': o.tone }, [
        el('span', 'ps5-rev-sub', { text: o.sub || L.recent }),
        el('span', 'ps5-rev-small', { text: o.label + (o.share ? ` · ${o.share}%` : '') }),
      ])),
      el('a', 'ps5-rev-link', { href: '#app_reviews_hash', text: L.read + ' →' }),
    ]) : null;

    if (!left.length && !right.length && !reviews) return null;
    const info = left.length || right.length ? el('section', 'ps5-info', {}, [
      el('h3', 'ps5-about-title', { text: L.about }),
      el('div', 'ps5-info-cols', {}, [el('div', 'ps5-info-col', {}, left), el('div', 'ps5-info-col', {}, right)]),
    ]) : null;
    // the glance box is now fully represented (art, snippet, reviews, facts, tags): it steps back
    if (glance) root.classList.add('ps5-glance-off');
    return el('div', 'ps5-about' + (reviews && info ? '' : ' single'), {}, [info, reviews]);
  };

  /* the gallery: Steam's own React carousel (trailers keep Steam's player), given the
     whole column once the glance box steps back, plus a full-screen button for the
     screenshots (our viewer) */
  const widenGallery = shots => {
    const box = $('#game_highlights');
    if (!box) return;
    const glance = $('.glance_ctn');
    const right = glance && (glance.closest('.rightcol') || glance.parentElement);
    if (right && right !== box && [...right.children].every(c => c === glance || !c.offsetHeight)) root.classList.add('ps5-gallery-wide');
    if (shots.length && !box.querySelector('.ps5-gal-full')) {
      const b = el('button', 'ps5-gal-full', { type: 'button', title: L.full, 'aria-label': L.full, svg: ICO.full });
      b.addEventListener('click', () => Viewer.open(shots, 0));
      (box.querySelector('.highlight_ctn') || box).appendChild(b);
    }
  };

  /* ───────────── store arrows: one compact control everywhere ─────────────
     React carousels (.CarouselBtnLeft/Right), the game page gallery's paging arrows and its
     thumbnail-scrollbar arrows (hashed classes captured from the live store, plus a
     structural fallback: a lone svg button sitting on the gallery). Marked once with
     data-ps5-arrow; the stylesheet draws the same 36 px disc on all of them. */
  const ARROWS = '.CarouselBtnLeft, .CarouselBtnRight, #game_highlights ._258hIVgneRO0dUbgnPZh_R';
  const SMALL_ARROWS = '#game_highlights ._2lIBEOcXRC3KKhDamcV9t';
  const markArrows = () => {
    for (const n of document.querySelectorAll(`:is(${ARROWS}):not([data-ps5-arrow])`)) {
      n.setAttribute('data-ps5-arrow', '');
      if (getComputedStyle(n).position === 'static') n.style.position = 'relative';
    }
    for (const n of document.querySelectorAll(`:is(${SMALL_ARROWS}):not([data-ps5-arrow])`)) n.setAttribute('data-ps5-arrow', 'small');
    const car = document.querySelector('.gamehighlight_desktopcarousel');
    if (car && !car.dataset.ps5Scanned) {
      for (const svg of car.querySelectorAll('svg')) {
        const b = svg.parentElement;
        if (!b || b === car || b.hasAttribute('data-ps5-arrow') || b.children.length !== 1 || text(b)) continue;
        const cs = getComputedStyle(b);
        const r = b.getBoundingClientRect();
        if (cs.position === 'absolute' && r.width > 0 && r.width <= 90 && r.height <= 120 && !b.closest('img, video')) b.setAttribute('data-ps5-arrow', '');
      }
      if (car.querySelector('img')) car.dataset.ps5Scanned = '1';
    }
  };

  /* ───────────── WISHLIST: a PS5 grid on Steam's real wishlist ─────────────
     Steam's own wishlist is a virtual list (rows placed by a fixed row height), so it
     cannot be re-laid as a grid without breaking its scrolling. The grid is therefore a
     view of its own, fed by Steam's public Web API and acting through Steam:
       data    IWishlistService/GetWishlist (appid, rank, date added) — with the page's
               own web API token when it has one — and IStoreBrowseService/GetItems
               (name, art, Steam's formatted prices and discount, reviews, release)
       remove  POST store.steampowered.com/api/removefromwishlist {sessionid, appid}
               (the call Steam's store script makes)
       buy     Steam's own addToCart(packageid) when the page has it, else the game's
               store page (its real Add to Cart)
     Safety: built only when the API list matches the rows Steam renders on this page
     (so another user's wishlist is never replaced by yours); if anything fails or comes
     back empty, Steam's list simply stays. A button switches between grid and Steam's list. */
  const Wish = (() => {
    let built = false, busy = false, items = [], store = new Map(), node = null, listEl = null, shown = 0, io = null;
    let sort = 'rank', query = '', onSale = false;
    const W = SR
      ? { search: 'Поиск в списке желаемого', rank: 'Ваш порядок', name: 'Название', discount: 'Скидка', price: 'Цена', added: 'Дата добавления', release: 'Дата выхода', reviews: 'Обзоры', sale: 'Со скидкой', games: n => `Игр: ${n}`, cart: 'В корзину', buy: 'В магазин', remove: 'Удалить', confirm: 'Удалить?', removed: 'Удалено из списка желаемого', failed: 'Не удалось — попробуйте на странице игры', added: d => `Добавлено ${d}`, soon: 'Скоро', free: 'Бесплатно', view: 'Список Steam', grid: 'Сетка PS5', empty: 'Ничего не найдено' }
      : { search: 'Search your wishlist', rank: 'Your rank', name: 'Name', discount: 'Discount', price: 'Price', added: 'Date added', release: 'Release date', reviews: 'Reviews', sale: 'On sale', games: n => `${n} games`, cart: 'Add to Cart', buy: 'View in store', remove: 'Remove', confirm: 'Remove?', removed: 'Removed from your wishlist', failed: 'Could not remove — try on the game page', added: d => `Added ${d}`, soon: 'Coming soon', free: 'Free', view: 'Steam list', grid: 'PS5 grid', empty: 'Nothing found' };
    const cfg = () => {
      const c = document.getElementById('application_config');
      const parse = v => { try { return JSON.parse(v || 'null'); } catch (e) { return null; } };
      const config = (c && parse(c.dataset.config)) || {};
      return { user: (c && parse(c.dataset.userinfo)) || {}, token: (c && parse(c.dataset.loyalty_webapi_token)) || '', lang: config.LANGUAGE || 'english', country: config.COUNTRY || '' };
    };
    const sessionId = () => window.g_sessionID || (document.cookie.match(/(?:^|; )sessionid=([^;]+)/) || [])[1] || '';
    const nativeRows = () => $$('[data-rfd-draggable-id^="WishlistItem-"]');
    const nativeIds = () => new Set(nativeRows().map(r => +(r.getAttribute('data-rfd-draggable-id') || '').split('-')[1]).filter(Boolean));
    const waitRows = () => new Promise(res => {
      const t0 = Date.now();
      const tick = () => { const ids = nativeIds(); if (ids.size || Date.now() - t0 > 8000) res(ids); else setTimeout(tick, 300); };
      tick();
    });
    const api = (path, params) => {
      const u = new URL('https://api.steampowered.com/' + path);
      for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) u.searchParams.set(k, v);
      return fetch(u.toString(), { credentials: 'omit' }).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
    };
    const assetUrl = (it, file) => {
      const fmt = it && it.assets && it.assets.asset_url_format;
      return fmt && file ? 'https://shared.akamai.steamstatic.com/store_item_assets/' + fmt.replace('${FILENAME}', file) : '';
    };
    const fmtDate = unix => { try { return new Date(unix * 1000).toLocaleDateString(SR ? 'ru-RU' : undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
    const price = it => {
      const o = it && it.best_purchase_option;
      if (it && it.is_free) return { final: W.free, cents: 0, pct: 0 };
      if (!o) return { final: (it && it.release && it.release.is_coming_soon) ? W.soon : '', cents: Infinity, pct: 0 };
      return { final: o.formatted_final_price || '', orig: o.discount_pct ? (o.formatted_original_price || '') : '', pct: +o.discount_pct || 0, cents: +o.final_price_in_cents || 0, pkg: o.packageid };
    };
    const compute = () => {
      const q = query.toLowerCase();
      let l = items.filter(w => {
        const it = store.get(w.appid);
        if (q && !String((it && it.name) || '').toLowerCase().includes(q)) return false;
        if (onSale && !(price(it).pct > 0)) return false;
        return true;
      });
      const name = w => String((store.get(w.appid) || {}).name || '');
      const by = {
        rank: (a, b) => (a.priority || 0) - (b.priority || 0),
        name: (a, b) => name(a).localeCompare(name(b)),
        discount: (a, b) => price(store.get(b.appid)).pct - price(store.get(a.appid)).pct,
        price: (a, b) => price(store.get(a.appid)).cents - price(store.get(b.appid)).cents,
        added: (a, b) => (b.date_added || 0) - (a.date_added || 0),
        release: (a, b) => (((store.get(b.appid) || {}).release || {}).steam_release_date || 0) - (((store.get(a.appid) || {}).release || {}).steam_release_date || 0),
        reviews: (a, b) => ((((store.get(b.appid) || {}).reviews || {}).summary_filtered || {}).percent_positive || 0) - ((((store.get(a.appid) || {}).reviews || {}).summary_filtered || {}).percent_positive || 0),
      }[sort];
      return by ? l.slice().sort(by) : l;
    };
    const card = w => {
      const it = store.get(w.appid) || {};
      const p = price(it);
      const rv = it.reviews && it.reviews.summary_filtered;
      const href = `https://store.steampowered.com/app/${w.appid}/`;
      const canCart = typeof window.addToCart === 'function' && p.pkg;
      const c = el('article', 'ps5-wcard', { 'data-app': String(w.appid) });
      const img = el('img', '', { alt: '', loading: 'lazy', decoding: 'async' });
      const srcs = [assetUrl(it, it.assets && it.assets.library_capsule), `${CDN(w.appid)}/library_600x900.jpg`, assetUrl(it, it.assets && it.assets.header), `${CDN(w.appid)}/header.jpg`].filter(Boolean);
      let k = 0;
      img.onerror = () => { if (++k < srcs.length) img.src = srcs[k]; else img.remove(); };
      img.onload = () => c.classList.add('loaded');
      img.src = srcs[0];
      c.append(
        el('a', 'ps5-wcard-art', { href }, [img, el('span', 'ps5-wcard-fallback', { text: it.name || '#' + w.appid }), p.pct ? el('span', 'ps5-wcard-pct', { text: `-${p.pct}%` }) : null]),
        el('div', 'ps5-wcard-body', {}, [
          el('a', 'ps5-wcard-name', { href, text: it.name || '#' + w.appid, title: it.name || '' }),
          el('div', 'ps5-wcard-meta', {}, [
            rv && rv.review_score_label ? el('span', 'ps5-wcard-rev', { text: rv.review_score_label + (rv.percent_positive ? ` · ${rv.percent_positive}%` : '') }) : null,
            w.date_added ? el('span', '', { text: W.added(fmtDate(w.date_added)) }) : null,
          ]),
          el('div', 'ps5-wcard-price', {}, [
            p.orig ? el('s', '', { text: p.orig }) : null,
            p.final ? el('b', '', { text: p.final }) : null,
          ]),
          el('div', 'ps5-wcard-actions', {}, [
            el('button', 'ps5-wbtn primary', { type: 'button', 'data-act': canCart ? 'cart' : 'open', text: canCart ? W.cart : W.buy }),
            el('button', 'ps5-wbtn icon', { type: 'button', 'data-act': 'remove', title: W.remove, 'aria-label': W.remove, svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/></svg>' }),
          ]),
        ]),
      );
      return c;
    };
    const renderMore = () => {
      const grid = node.querySelector('.ps5-wgrid');
      const slice = listEl.slice(shown, shown + 48);
      for (const w of slice) grid.appendChild(card(w));
      shown += slice.length;
    };
    const refresh = () => {
      listEl = compute();
      shown = 0;
      widen();
      const grid = node.querySelector('.ps5-wgrid');
      grid.textContent = '';
      node.querySelector('.ps5-wcount').textContent = W.games(listEl.length);
      if (!listEl.length) grid.appendChild(el('div', 'ps5-wempty', { text: W.empty }));
      renderMore();
    };
    const remove = (btn, appid) => {
      if (!btn.classList.contains('confirm')) {
        btn.classList.add('confirm');
        btn.title = W.confirm;
        setTimeout(() => { btn.classList.remove('confirm'); btn.title = W.remove; }, 3000);
        return;
      }
      btn.disabled = true;
      const body = new URLSearchParams({ sessionid: sessionId(), appid: String(appid) });
      fetch('https://store.steampowered.com/api/removefromwishlist', { method: 'POST', body, credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (!d || !d.success) throw new Error('refused');
          items = items.filter(w => w.appid !== appid);
          const c = btn.closest('.ps5-wcard');
          c.classList.add('gone');
          setTimeout(() => { c.remove(); node.querySelector('.ps5-wcount').textContent = W.games(compute().length); }, 260);
          toast(W.removed);
        })
        .catch(() => { btn.disabled = false; btn.classList.remove('confirm'); toast(W.failed); });
    };
    const toast = msg => {
      let t = document.getElementById('ps5-wtoast');
      if (!t) { t = el('div', '', { id: 'ps5-wtoast' }); document.body.appendChild(t); }
      t.textContent = msg;
      t.classList.add('on');
      clearTimeout(t._h);
      t._h = setTimeout(() => t.classList.remove('on'), 2400);
    };
    // Steam caps the wishlist in wrappers (max-width, fixed width, grid / flex tracks) between
    // the list and the page. Mark every narrower ancestor of the grid so grid mode can widen it,
    // and un-clip the ones that hide overflow: web.css then lets #ps5-wish break out to the
    // window's width even where a wrapper cannot be widened.
    const widen = () => {
      if (!node) return;
      for (let a = node.parentElement; a && a !== document.body && a !== root; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.maxWidth !== 'none' || a.getBoundingClientRect().width < window.innerWidth - 80) a.setAttribute('data-ps5-wcol', '');
        if (/hidden|clip/.test(cs.overflowX)) a.setAttribute('data-ps5-wclip', '');
      }
    };
    const setMode = grid => {
      root.classList.toggle('ps5-wish-grid', grid);
      widen();
      try { localStorage.setItem('ps5-wish-view', grid ? 'grid' : 'list'); } catch (e) { /* not kept */ }
      const t = node.querySelector('.ps5-wview');
      t.textContent = grid ? W.view : W.grid;
    };
    const build = () => {
      const first = nativeRows()[0];
      const list = first && (first.closest('[data-rfd-droppable-id]') || first.parentElement);
      if (!list) return false;
      list.setAttribute('data-ps5-wnative', '');
      // Steam's own search / sort / filter bar above the list: our toolbar replaces it in
      // grid mode (it comes back with "Steam list"); and the page column it all sits in,
      // widened in grid mode so the title and the grid share one edge
      for (let n = list.previousElementSibling; n; n = n.previousElementSibling) {
        if (/^H[1-3]$/.test(n.tagName) || n.querySelector('h1, h2')) break;
        if (n.querySelector('input, button, select')) n.setAttribute('data-ps5-wnative', 'tools');
      }
      const col = list.closest('section') || list.parentElement;
      if (col) col.setAttribute('data-ps5-wcol', '');
      const opt = (v, l) => el('option', '', { value: v, text: l });
      const sel = el('select', 'ps5-wsort', {}, [opt('rank', W.rank), opt('added', W.added), opt('discount', W.discount), opt('price', W.price), opt('name', W.name), opt('release', W.release), opt('reviews', W.reviews)]);
      const search = el('input', 'ps5-wsearch', { type: 'search', placeholder: W.search, spellcheck: 'false' });
      const sale = el('button', 'ps5-wchip', { type: 'button', 'aria-pressed': 'false', text: W.sale });
      const view = el('button', 'ps5-wview', { type: 'button' });
      node = el('div', '', { id: 'ps5-wish' }, [
        el('div', 'ps5-wtools', {}, [search, sel, sale, el('span', 'ps5-wcount'), view]),
        el('div', 'ps5-wgrid', { role: 'list' }),
        el('div', 'ps5-wmore'),
      ]);
      list.before(node);
      widen();
      let qt = 0;
      search.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { query = search.value.trim(); refresh(); }, 140); });
      sel.addEventListener('change', () => { sort = sel.value; refresh(); });
      sale.addEventListener('click', () => { onSale = !onSale; sale.setAttribute('aria-pressed', String(onSale)); refresh(); });
      view.addEventListener('click', () => setMode(!root.classList.contains('ps5-wish-grid')));
      node.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const c = b.closest('.ps5-wcard');
        const appid = +c.dataset.app;
        if (b.dataset.act === 'remove') remove(b, appid);
        else if (b.dataset.act === 'cart') {
          const p = price(store.get(appid));
          try { window.addToCart(p.pkg); } catch (err) { location.href = `https://store.steampowered.com/app/${appid}/`; }
        } else if (b.dataset.act === 'open') location.href = `https://store.steampowered.com/app/${appid}/`;
      });
      io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting) && shown < listEl.length) renderMore(); }, { rootMargin: '800px' });
      io.observe(node.querySelector('.ps5-wmore'));
      let saved = 'grid';
      try { saved = localStorage.getItem('ps5-wish-view') || 'grid'; } catch (e) { /* default */ }
      refresh();
      setMode(saved !== 'list');
      return true;
    };
    const init = async () => {
      if (built || busy || state.kind !== 'wishlist' || !isStore) return;
      busy = true;
      try {
        const c = cfg();
        const m = /\/wishlist\/profiles\/(\d+)/.exec(location.pathname);
        const owner = m ? m[1] : (c.user && c.user.steamid) || '';
        if (!owner) return;
        const data = await api('IWishlistService/GetWishlist/v1/', { steamid: owner, access_token: c.token || '' });
        const list = (data && data.response && data.response.items) || [];
        if (!list.length) return;
        const onPage = await waitRows();
        if (!onPage.size || ![...onPage].some(id => list.some(w => w.appid === id))) return;   // not this list
        for (let i = 0; i < list.length; i += 100) {
          const ids = list.slice(i, i + 100).map(w => ({ appid: w.appid }));
          const input = { ids, context: { language: c.lang, country_code: c.country || (c.user && c.user.country_code) || 'US', steam_realm: 1 }, data_request: { include_assets: true, include_reviews: true, include_release: true, include_basic_info: true } };
          const r = await api('IStoreBrowseService/GetItems/v1/', { input_json: JSON.stringify(input) });
          for (const it of (r && r.response && r.response.store_items) || []) store.set(it.appid || it.id, it);
        }
        items = list;
        built = build();
      } catch (e) {
        console.warn('[PS5] wishlist grid unavailable, Steam list kept', e);
      } finally { busy = false; }
    };
    return { init };
  })();

  // ---- v1.8.0: the cart (React, hashed class names that change with Steam updates) ----
  // Marks by structure instead: data-ps5-cart="item" on each line (the wide row around a
  // product capsule — recommendation capsules are narrow), "total" on the box around the
  // primary "Continue to payment" button, "bg" on the full-width background-art layer.
  // Only attributes are added; Steam's buttons and their handlers are untouched.
  const markCart = () => {
    if (state.kind !== 'cart') return;
    const scope = document.querySelector('#StoreTemplate') || document.querySelector('.page_content_ctn') || document.body;
    const page = scope.getBoundingClientRect().width || innerWidth;
    for (const a of scope.querySelectorAll('a[href*="/app/"], a[href*="/sub/"], a[href*="/bundle/"]')) {
      if (!a.querySelector('img') || a.closest('[data-ps5-cart="item"], header, footer, #global_header')) continue;
      let row = a;
      for (let i = 0; i < 7 && row.parentElement && row.parentElement !== scope; i++) {
        row = row.parentElement;
        const w = row.getBoundingClientRect().width;
        if (w >= 420 && w < page - 4 && row.querySelectorAll('button, [role="button"], a').length >= 2) break;
      }
      const w = row.getBoundingClientRect().width;
      if (row !== a && w >= 420 && w < page - 4) row.setAttribute('data-ps5-cart', 'item');
    }
    const primary = scope.querySelector('.DialogButton.Primary, button.Primary, [class*="Primary"][role="button"]');
    if (primary) {
      let box = primary;
      while (box.parentElement && box.parentElement !== scope) {
        const p = box.parentElement;
        if (p.getBoundingClientRect().width > box.getBoundingClientRect().width * 1.3 && box.getBoundingClientRect().height >= 80) break;
        box = p;
      }
      if (box !== primary && !box.hasAttribute('data-ps5-cart')) box.setAttribute('data-ps5-cart', 'total');
    }
    for (const el of scope.querySelectorAll('[style*="background-image"]')) {
      if (/page_bg|library_hero|store_item_assets.*\/(page_bg|bg)/i.test(el.getAttribute('style') || '') && el.getBoundingClientRect().width >= page - 4) el.setAttribute('data-ps5-cart', 'bg');
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
    try { buildHero(); } catch (e) { console.warn('[PS5] store hero', e); }
    try { markArrows(); } catch (e) { /* arrows keep Steam's look */ }
    Wish.init();
    try { markCart(); } catch (e) { /* the cart keeps Steam's layout */ }
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
