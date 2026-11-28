// Test harness only: drives js/ps5.js against the mock Steam window in Chromium.
//   node tests/run.mjs            → checks only
//   node tests/run.mjs --shots    → also writes README screenshots to assets/
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { pages as WEB } from './web-pages.mjs';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = process.argv.includes('--shots');
const PORT = 8765;
const srv = spawn(process.execPath, [path.join(DIR, 'server.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 600));
const results = [];
const check = (name, ok, extra = '') => { results.push([ok, name]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: SHOTS ? 2 : 1, locale: 'en-US' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(DIR, '..', 'assets', name), type: 'jpeg', quality: 82 }); };
try {
  await page.goto(`http://localhost:${PORT}/tests/harness.html`);
  await page.waitForSelector('#ps5-home .ps5-tile.selected', { timeout: 5000 });
  check('boot overlay shown once', await page.locator('#ps5-boot').count() === 1);
  await page.waitForTimeout(2600);
  check('boot overlay removed after animation', await page.locator('#ps5-boot').count() === 0);
  const tiles = await page.locator('#ps5-home .ps5-tile').count();
  check('home rail has games + library tile', tiles === 13, `tiles=${tiles}`);
  check('first tile = most recently played', (await page.locator('.ps5-tile.selected').getAttribute('title')) === 'Neon Drift Racing');
  check('game list hidden on home', await page.locator('.LeftListSizableContainer').isHidden());
  check('top bar extras mounted in SuperNavBar', await page.locator('.SuperNavBar > #ps5-top').count() === 1);
  check('clock shows time', /^\d\d:\d\d$/.test(await page.locator('#ps5-clock').textContent()));
  check('background art applied', await page.locator('#ps5-bg.has-art').count() === 1);
  await page.waitForTimeout(400);
  check('logo art shown', await page.locator('#ps5-home.has-logo').count() === 1);
  check('description from store API', (await page.locator('.ps5-home-desc').textContent()).includes('"test"'));
  check('Steam shelves kept under home', await page.evaluate(() => { const h = document.getElementById('ps5-home'), l = document.querySelector('.LibraryHome'); return !!l && !!(h.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING); }));
  await shot('preview-home.jpg');

  // ---- v1.1.0: one profile button, bottom bar, What's New
  check('Steam account button hidden (single PS5 profile button)', await page.locator('#acct').isHidden());
  await page.addStyleTag({ content: ':root{--ps5-account:show}', }).then(h => h.evaluate(n => n.id = 'acct-opt'));
  await page.waitForTimeout(2200);
  check('option «Steam account button → Visible» brings it back', await page.locator('#acct').isVisible());
  await page.evaluate(() => document.getElementById('acct-opt').remove());
  await page.waitForTimeout(2200);
  check('bottom bar: friends online badge', (await page.locator('.FriendsButton .ps5-friends-badge').textContent()) === '6');
  check('bottom bar: downloading state from SteamClient.Downloads', await page.evaluate(() => document.documentElement.classList.contains('ps5-downloading')));
  const pill = await page.locator('.AddGameButton').evaluate(n => [getComputedStyle(n).borderTopLeftRadius, getComputedStyle(n.querySelector('.Icon'), '::before').content]);
  check('bottom bar: Add a Game is a PS5 pill with icon', pill[0] === '999px' && pill[1] !== 'none', pill.join(' '));
  const dl = await page.locator('.DownloadStatus').boundingBox();
  const bar = await page.locator('.BottomBar').boundingBox();
  check('bottom bar: Downloads is a compact capsule (Steam stretches it to the full bar)', dl.width <= 340 && dl.height <= 40, JSON.stringify(dl));
  check('bottom bar: Downloads stays centred', Math.abs((dl.x + dl.width / 2) - (bar.x + bar.width / 2)) < 40, `${dl.x + dl.width / 2} vs ${bar.x + bar.width / 2}`);
  check('bottom bar: progress kept inside the capsule', await page.locator('.DownloadStatus .ProgressBar').isVisible() && (await page.locator('.DownloadStatus .Percentage').textContent()) === '60%');

  // ---- v1.2.0: black strip, home order, top menu, tabs
  check('no black strip: empty .URLBarReplacement taken out of the layout', (await page.locator('.URLBarReplacement').evaluate(n => n.offsetHeight)) === 0);
  check('PS5 Home is the first block of the home scroller (above What\'s New)', await page.evaluate(() => { const b = document.querySelector('.Body.InnerContainer'); return b.firstElementChild.id === 'ps5-home' && b.children[1].classList.contains('whatsnew-shelf'); }));
  const rm = await page.locator('.RootMenuButton').nth(1).evaluate(n => [getComputedStyle(n, '::before').maskImage || getComputedStyle(n, '::before').webkitMaskImage, getComputedStyle(n, '::after').content]);
  check('top menu: icon per item and separators', /svg/.test(rm[0]) && rm[1] !== 'none');
  const tab = await page.locator('.SuperNavMenu.Selected > .MenuButton').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n, '::before').content, getComputedStyle(n, '::after').transform]);
  check('nav tabs: active tab lit (white pill, icon, blue indicator)', tab[0] === 'rgb(255, 255, 255)' && tab[1] !== 'none' && tab[2] !== 'none', tab.join(' | '));
  const prof = await page.locator('.SuperNavMenu:nth-of-type(4) > .MenuButton').evaluate(n => getComputedStyle(n).getPropertyValue('--ps5-tab-icon'));
  check('nav tabs: profile tab gets the person icon', /circle/.test(prof));
  // ---- v1.3.0: tab proportions (Steam fixes .SuperNavMenu at 101 px; the mock does too)
  const tabs = await page.$$eval('.SuperNavMenu > .MenuButton', ns => ns.map(n => { const c = getComputedStyle(n); return { h: Math.round(n.getBoundingClientRect().height), fs: c.fontSize, tt: c.textTransform, fits: n.scrollWidth <= n.clientWidth + 1 }; }));
  check('tabs: one height (32 px) and one type size (13.5 px), no uppercase', tabs.every(t => t.h === 32 && t.fs === '13.5px' && t.tt === 'none'), JSON.stringify(tabs));
  check('tabs: every label fits (no squeeze in Steam\'s fixed 101 px box)', tabs.every(t => t.fits), JSON.stringify(tabs));
  // ---- v1.3.0: address panel
  check('address panel: first in the top strip, Steam arrows hidden', await page.evaluate(() => document.querySelector('.SuperNavBar').firstElementChild.id === 'ps5-addr') && await page.locator('#steam-back').isHidden());
  check('address panel: names the section in the library', (await page.locator('#ps5-addr .ps5-addr-text').textContent()) === 'Library · Home');
  check('address panel: forward disabled when Steam\'s is', await page.locator('#ps5-addr .ps5-addr-fwd').isDisabled() && !(await page.locator('#ps5-addr .ps5-addr-back').isDisabled()));
  await page.click('#ps5-addr .ps5-addr-back');
  check('address panel: back presses Steam\'s own arrow', (await page.evaluate(() => window.__back)) === 1);
  check('address panel: no reload outside web pages', await page.locator('#ps5-addr .ps5-addr-reload').isHidden());
  const ab = await page.locator('#ps5-addr').boundingBox();
  check('address panel: compact (≤ 340 × 36)', ab.width <= 340 && Math.round(ab.height) === 36, JSON.stringify(ab));
  // ---- v1.3.0: soft background blur on the selected game's art
  const blur = await page.locator('#ps5-bg .ps5-bg-layer.on').evaluate(n => getComputedStyle(n).filter);
  check('Home background: light blur (10 px, new slider key) on the art layer only', /blur\(10px\)/.test(blur), blur);
  check('Home tiles stay sharp', (await page.locator('.ps5-tile.selected img').evaluate(n => getComputedStyle(n).filter)) === 'none');
  const wn = await page.locator('.PartnerEventRowCapsule_Container > div').first().evaluate(n => getComputedStyle(n).borderTopLeftRadius);
  check("What's New: content cards restyled", wn === '16px', wn);
  const wnBox = await page.locator('.PartnerEventRowCapsule_Container > div').first().evaluate(n => { const c = getComputedStyle(n); return [c.borderTopWidth, c.paddingTop, c.display, n.getBoundingClientRect().height]; });
  check("What's New: Steam's box sizes untouched (no border / padding / display change)", wnBox[0] === '0px' && wnBox[1] === '0px' && wnBox[2] === 'flex' && wnBox[3] === 230, wnBox.join(' '));
  const ut = await page.locator('.UpdatesContainer').evaluate(n => getComputedStyle(n).paddingTop);
  check("What's New: shelf container keeps Steam's padding", ut === '0px', ut);
  await page.locator('#route').evaluate(n => { n.scrollTop = n.querySelector('.UpdatesContainer').offsetTop - 120; });
  await page.locator('.PartnerEventRowCapsule_Container > div').first().hover();
  await page.waitForTimeout(350);
  await shot('preview-whatsnew.jpg');
  await page.locator('#route').evaluate(n => { n.scrollTop = 0; });

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  check('ArrowRight selects next game', (await page.locator('.ps5-tile.selected').getAttribute('title')) === 'Iron Tactics');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  check('hidden game skipped on home', (await page.locator('.ps5-tile.selected').getAttribute('title')) === 'Starfall Odyssey');
  check('achievements card for game with trophies', (await page.locator('.ps5-home-cards').textContent()).includes('34/50'));
  await page.click('.ps5-btn-play');
  let calls = await page.evaluate(() => window.__steamCalls);
  check('Play → SteamClient.Apps.RunGame(appid)', calls.some(c => c[0] === 'RunGame' && c[1] === '101' && c[3] === -1 && c[4] === 100));
  await shot('preview-home-2.jpg');

  await page.keyboard.press('Control+Shift+KeyL');
  await page.waitForSelector('#ps5-library.open');
  await page.waitForTimeout(500);
  const installedCount = await page.locator('.ps5-gcard').count();
  check('library: installed tab lists only installed games', installedCount === 28, `cards=${installedCount}`);
  await shot('preview-library.jpg');
  await page.click('[data-tab="all"]');
  await page.waitForTimeout(150);
  const allCount = await page.locator('.ps5-gcard').count();
  check('library: first page rendered lazily (60 of 60)', allCount === 60, `cards=${allCount}`);
  check('library: count label', (await page.locator('.ps5-lib-count').textContent()) === '60 games');
  await page.locator('.ps5-lib-scroll').evaluate(n => { n.scrollTop = n.scrollHeight; });
  await page.waitForTimeout(300);
  check('library: hidden game excluded, shortcut included', await page.locator('.ps5-gcard[data-app="110"]').count() === 0 && await page.locator('.ps5-gcard[data-app="3000000001"]').count() === 1);
  await page.fill('.ps5-lib-search input', 'neon');
  await page.waitForTimeout(300);
  check('library: search filters', await page.locator('.ps5-gcard').count() === 6);
  await page.fill('.ps5-lib-search input', '');
  await page.selectOption('.ps5-lib-sort', 'playtime');
  await page.waitForTimeout(300);
  check('library: sort by playtime', (await page.locator('.ps5-gcard').first().getAttribute('title')) === 'Pixel Farmstead');
  await page.click('[data-filter="hidden"]');
  await page.waitForTimeout(150);
  check('library: hidden filter shows hidden only', await page.locator('.ps5-gcard').count() === 1);
  await page.click('[data-filter="hidden"]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('library: Esc closes', await page.locator('#ps5-library.open').count() === 0);

  await page.keyboard.press('Control+Shift+Space');
  await page.waitForSelector('#ps5-cc.open');
  await page.waitForTimeout(450);
  check('CC: profile card shows persona', (await page.locator('.ps5-cc-card').textContent()).includes('Vasya_PS5'));
  await shot('preview-control-center.jpg');
  await page.click('[data-act="status-away"]');
  calls = await page.evaluate(() => window.__steamCalls);
  check('CC: status → steam://friends/status/away', calls.some(c => c[1] === 'steam://friends/status/away'));
  await page.click('[data-sec="friends"]');
  await page.waitForTimeout(350);
  const fr = await page.locator('.ps5-cc-friend').count();
  check('CC: online friends listed (offline excluded)', fr === 6, `friends=${fr}`);
  check('CC: in-game friends first', (await page.locator('.ps5-cc-friend').first().textContent()).includes('Starfall Odyssey') || (await page.locator('.ps5-cc-friend').first().textContent()).includes('Iron Tactics'));
  await shot('preview-friends.jpg');
  await page.click('[data-sec="downloads"]');
  await page.waitForTimeout(350);
  check('CC: live download progress', (await page.locator('.ps5-cc-dl').textContent()).includes('Iron Tactics') && (await page.locator('.ps5-cc-dl').textContent()).includes('%'));
  await shot('preview-downloads.jpg');
  await page.click('[data-sec="power"]');
  await page.click('[data-act="exit"]');
  calls = await page.evaluate(() => window.__steamCalls);
  check('CC: exit needs confirmation', !calls.some(c => c[0] === 'StartShutdown'));
  await page.click('[data-act="exit"]');
  calls = await page.evaluate(() => window.__steamCalls);
  check('CC: second press → SteamClient.User.StartShutdown', calls.some(c => c[0] === 'StartShutdown'));
  await page.keyboard.press('Control+Shift+Space');
  await page.keyboard.press('Control+Shift+Space');
  await page.waitForTimeout(100);
  await page.click('[data-sec="music"]');
  await page.click('[data-act="soundtracks"]');
  calls = await page.evaluate(() => window.__steamCalls);
  check('CC: Music → steam://open/library/view/soundtracks', calls.some(c => c[1] === 'steam://open/library/view/soundtracks'));
  check('downloads: one shared listener (bottom bar + CC), not one per opening', calls.filter(c => c[0] === 'RegisterDownloads').length === 1);

  // ---- v1.2.0: the "…" button opens a game actions menu (no navigation, no second view)
  await page.evaluate(() => { window.__steamCalls.length = 0; });
  const selId = await page.evaluate(() => window.appStore.allApps.find(a => a.display_name === document.querySelector('.ps5-tile.selected').title).appid);
  await page.click('#ps5-home [data-act="details"]');
  await page.waitForSelector('#ps5-gamemenu.open');
  calls = await page.evaluate(() => window.__steamCalls);
  check('"…" opens the game actions menu', await page.locator('#ps5-gamemenu:not([hidden])').count() === 1);
  check('"…" does not navigate away from Home', !calls.some(c => c[0] === 'Navigate') && await page.locator('#ps5-home').count() === 1);
  check('"…" leaves the page structure alone (no injected game strip, list still hidden)', await page.locator('#ps5-details').count() === 0 && await page.locator('.LeftListSizableContainer').isHidden());
  const gm = await page.locator('#ps5-gamemenu').boundingBox();
  check('game menu inside the window', gm.x >= 0 && gm.y >= 0 && gm.x + gm.width <= 1440 && gm.y + gm.height <= 860, JSON.stringify(gm));
  check('game menu: real actions listed', await page.locator('#ps5-gamemenu [data-act]').count() >= 8);
  await shot('preview-game-menu.jpg');
  await page.click('#ps5-gamemenu [data-act="properties"]');
  calls = await page.evaluate(() => window.__steamCalls);
  check('menu: Properties → SteamClient.Apps.OpenAppSettingsDialog', calls.some(c => c[0] === 'OpenAppSettingsDialog' && c[1] === selId));
  check('menu closes after an action', await page.locator('#ps5-gamemenu:not([hidden])').count() === 0);
  await page.click('#ps5-home [data-act="details"]');
  await page.keyboard.press('Escape');
  check('menu closes with Esc', await page.locator('#ps5-gamemenu:not([hidden])').count() === 0);
  await page.click('#ps5-home [data-act="details"]');
  await page.mouse.click(900, 300);
  check('menu closes on a click outside', await page.locator('#ps5-gamemenu:not([hidden])').count() === 0);
  await page.click('#ps5-home [data-act="details"]');
  await page.click('#ps5-home [data-act="details"]');
  check('menu: one instance, second click toggles it shut', await page.locator('#ps5-gamemenu').count() === 1 && await page.locator('#ps5-gamemenu:not([hidden])').count() === 0);
  await page.click('#ps5-home [data-act="details"]');
  await page.click('#ps5-gamemenu [data-act="hub"]');
  await page.waitForTimeout(600);
  calls = await page.evaluate(() => window.__steamCalls);
  check('menu: Game hub → SteamUIStore.Navigate(/library/app/id)', calls.some(c => c[0] === 'Navigate' && c[1] === '/library/app/' + selId));
  check('game page: one view only (Steam\'s page, nothing injected)', await page.locator('#ps5-details, #ps5-lightbox').count() === 0 && await page.locator('.AppDetailsMain').count() === 1);
  check('game page: no game list on the left (PS5 mode default)', await page.locator('.LeftListSizableContainer').isHidden());
  // ---- v1.4.0: the library game page, rebuilt from the user's screenshot (Cyberpunk 2077)
  await page.waitForTimeout(300);
  const pb = await page.locator('.PlayButtonContainer').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n.querySelector('.ButtonText')).color, getComputedStyle(n).borderTopLeftRadius]);
  check('game page: Install/Play is a white pill with READABLE dark text', pb[0] === 'rgb(255, 255, 255)' && pb[1] === 'rgb(11, 11, 15)' && pb[2] === '999px', pb.join(' | '));
  const gs = await page.locator('#gstat').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n).borderTopLeftRadius]);
  check('game page: play-bar stats are plain text, no pill boxes', gs[0] === 'rgba(0, 0, 0, 0)' && gs[1] === '0px', gs.join(' | '));
  const pbRow = await page.locator('.AppDetailsOverviewPanel .Row').evaluate(n => getComputedStyle(n).borderTopLeftRadius);
  check('game page: play bar is one flat card (12 px)', pbRow === '12px', pbRow);
  const ft = await page.locator('#feat').evaluate(n => { const c = getComputedStyle(n); const p = document.getElementById('featsec').getBoundingClientRect(), r = n.getBoundingClientRect(); return [c.borderImageSource, c.borderTopLeftRadius, c.overflow]; });
  check('game page: "Featured" update restyled itself (no square blue border-image spilling out)', ft[0] === 'none' && ft[1] === '12px' && ft[2] === 'hidden', ft.join(' | '));
  const lk = await page.locator('.LinksSection .AppDetailsSectionContainer').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n).boxShadow]);
  check('game page: links row without a frame', lk[0] === 'rgba(0, 0, 0, 0)' && lk[1] === 'none', lk.join(' | '));
  const rv = await page.locator('.ReviewContainer').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n).borderTopLeftRadius]);
  check('game page: "would you recommend" card in the theme (not Steam blue)', !/59, 90, 122/.test(rv[0]) && rv[1] === '12px', rv.join(' | '));
  const radii = await page.$$eval('.AppDetailsMain .AppDetailsSectionContainer:not(.LinksSection *)', ns => [...new Set(ns.map(n => getComputedStyle(n).borderTopLeftRadius))]);
  check('game page: one radius for all sections', radii.length === 1 && radii[0] === '12px', radii.join(','));
  const bgArt = await page.locator('#ps5-bg').evaluate(n => [n.classList.contains('has-art'), [...n.querySelectorAll('.ps5-bg-layer')].map(l => getComputedStyle(l).opacity).join(',')]);
  check('game page: no game art washed over the whole page', !bgArt[0] || bgArt[1] === '0,0', bgArt.join(' | '));
  await shot('preview-game.jpg');
  await page.addStyleTag({ content: ':root{--ps5-home-sidebar:home}' }).then(h => h.evaluate(n => n.id = 'side-opt'));
  await page.waitForTimeout(2200);
  check('option «Game list → Hidden on Home only» shows it on game pages', await page.locator('.LeftListSizableContainer').isVisible());
  await page.evaluate(() => document.getElementById('side-opt').remove());
  await page.waitForTimeout(2200);

  await page.evaluate(() => window.SteamUIStore.Navigate('/library/home'));
  await page.waitForTimeout(300);
  check('home remounts after route back', await page.locator('#ps5-home').count() === 1);

  // ---- v1.1.0: panels over web pages (the native web view)
  await page.evaluate(() => { window.__steamCalls.length = 0; window.SteamUIStore.Navigate('/browser'); });
  await page.waitForTimeout(400);
  check('web page detected (ps5-on-web)', await page.evaluate(() => document.documentElement.classList.contains('ps5-on-web')));
  check('address panel: host › path on web pages', (await page.locator('#ps5-addr .ps5-addr-text').textContent()) === 'store.steampowered.com › app/101/Starfall_Odyssey');
  check('address panel: Steam\'s wide address strip is hidden', await page.locator('.BrowserWrapper .URLBar').isHidden());
  await page.click('#ps5-addr .ps5-addr-reload');
  check('address panel: reload presses Steam\'s own reload', (await page.evaluate(() => window.__reload)) === 1);
  await page.setViewportSize({ width: 980, height: 700 });
  await page.waitForTimeout(300);
  const strip = await page.locator('.SuperNavBar').evaluate(n => [n.scrollWidth, n.clientWidth]);
  const tabs2 = await page.$$eval('.SuperNavMenu > .MenuButton', ns => ns.every(n => n.scrollWidth <= n.clientWidth + 1));
  check('narrow window (980 px): top strip does not overflow, labels still fit', strip[0] <= strip[1] + 1 && tabs2, strip.join(' / '));
  if (SHOTS) await page.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-topbar-narrow.jpg'), type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 980, height: 120 } });
  await page.setViewportSize({ width: 1440, height: 860 });
  await page.waitForTimeout(200);
  await page.click('.ps5-top-avatar');
  await page.waitForSelector('#ps5-cc.open');
  calls = await page.evaluate(() => window.__steamCalls);
  check('profile on a web page hides the native web view', calls.some(c => c[0] === 'SetVisible' && c[1] === false) && await page.evaluate(() => document.documentElement.classList.contains('ps5-web-hidden')));
  check('profile panel opens on the Profile section', (await page.locator('.ps5-cc-icon.on').getAttribute('data-sec')) === 'profile');
  check('profile panel shows the wallet from Steam\'s account button', (await page.locator('.ps5-cc-wallet').textContent()).includes('12,50€'));
  const gear = await page.locator('.ps5-cc-icon[data-sec="settings"] svg').innerHTML();
  check('Settings icon is the standard cog (Lucide "settings"), not a sun', gear.includes('M12.22 2h-.44') && gear.includes('r="3"') && !gear.includes('M12 2.8v2.4'));
  const gearBox = await page.locator('.ps5-cc-icon[data-sec="settings"] .ps5-ico').boundingBox();
  check('Settings icon size matches the other Control Center icons', Math.round(gearBox.width) === 26 && Math.round(gearBox.height) === 26, JSON.stringify(gearBox));
  await page.addStyleTag({ path: path.join(DIR, '..', 'css', 'options', 'privacy-blur.css') });
  await page.mouse.move(2, 2); await page.waitForTimeout(350);
  check('option «Privacy blur»: wallet blurred until hovered', /blur\(6px\)/.test(await page.locator('.ps5-cc-wallet').evaluate(n => getComputedStyle(n).filter)));
  check('profile panel has the account section (replaces Steam account menu)', await page.locator('[data-act="account"]').count() === 1 && await page.locator('[data-act="store-prefs"]').count() === 1);
  await page.waitForTimeout(450);   // let the opening animation finish
  const box = await page.locator('.ps5-cc-panel').boundingBox();
  const vp = page.viewportSize();
  check('profile panel fully inside the window', box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width && box.y + box.height <= vp.height, JSON.stringify(box));
  await shot('preview-profile-store.jpg');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  calls = await page.evaluate(() => window.__steamCalls);
  check('closing restores the web view', calls.filter(c => c[0] === 'SetVisible').pop()[1] === true && !(await page.evaluate(() => document.documentElement.classList.contains('ps5-web-hidden'))));
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.click('.ps5-top-avatar');
  await page.waitForTimeout(500);
  const sb = await page.locator('.ps5-cc-panel').boundingBox();
  const tbb = await page.locator('.TitleBar').boundingBox();
  check('small window (1000×600): profile panel stays inside, below the title bar', sb.y >= tbb.y + tbb.height && sb.y + sb.height <= 600 && sb.x >= 0 && sb.x + sb.width <= 1000, JSON.stringify(sb));
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 860 });
  for (let i = 0; i < 3; i++) { await page.click('.ps5-top-avatar'); await page.keyboard.press('Escape'); }
  check('no duplicate panels after reopening', await page.locator('#ps5-cc').count() === 1 && await page.locator('#ps5-top').count() === 1);
  await page.keyboard.press('Control+Shift+KeyL');
  await page.waitForTimeout(200);
  calls = await page.evaluate(() => window.__steamCalls);
  check('Game Library on a web page hides the web view too', calls.filter(c => c[0] === 'SetVisible').pop()[1] === false);
  await page.keyboard.press('Control+Shift+Space');
  await page.waitForTimeout(100);
  calls = await page.evaluate(() => window.__steamCalls);
  check('switching Library → Control Center keeps the view hidden', calls.filter(c => c[0] === 'SetVisible').pop()[1] === false && await page.locator('#ps5-library.open').count() === 0);
  await page.evaluate(() => window.SteamUIStore.Navigate('/library/home'));
  await page.waitForTimeout(300);
  check('navigation closes Control Center', await page.locator('#ps5-cc.open').count() === 0);

  // ---- v1.5.0: Millennium's own UI (options sidebar, swatches)
  await page.evaluate(() => {
    const sb = document.createElement('div');
    sb.className = 'MillenniumDesktopSidebar';
    sb.innerHTML = '<div class="MillenniumDesktopSidebar_Title Panel">PlayStation 5</div><div class="PanelSectionTitle">Theme settings</div><div role="tablist"><button aria-selected="true">Home Screen</button><button>Look</button></div><div class="Field" style="display:flex"><div class="FieldLeftColumn"><div class="FieldLabelRow"><div class="FieldLabel">Home Screen</div></div><div class="FieldDescription">The PS5 Home Screen…</div></div><div class="FieldRightColumn"><select><option>PlayStation 5</option></select></div></div><input type="color" class="MillenniumColorPicker" value="#0070d1">';
    document.body.appendChild(sb);
  });
  const ms = await page.evaluate(() => { const f = document.querySelector('.MillenniumDesktopSidebar .Field'), t = document.querySelector('.MillenniumDesktopSidebar [role=tablist] button[aria-selected=true]'), d = document.querySelector('.MillenniumDesktopSidebar .FieldDescription'); return [getComputedStyle(f).borderTopLeftRadius, getComputedStyle(t).backgroundColor, getComputedStyle(d).flexBasis, getComputedStyle(document.querySelector('.MillenniumColorPicker')).borderTopLeftRadius]; });
  check('Millennium options sidebar: PS5 cards, white active tab, description on its own line, round swatches', ms[0] === '12px' && ms[1] === 'rgb(255, 255, 255)' && ms[2] === '100%' && ms[3] === '10px', ms.join(' | '));
  await page.evaluate(() => document.querySelector('.MillenniumDesktopSidebar').remove());

  await page.evaluate(() => window.__ps5Theme.destroy());
  await page.waitForTimeout(100);
  const left = await page.evaluate(() => document.querySelectorAll('[id^="ps5-"]').length);
  check('destroy() removes every element it built', left === 0, `left=${left}`);
  check('no page errors', errors.length === 0, errors.join(' | '));
  // ---- menus (popup window)
  const mp = await ctx.newPage();
  await mp.setViewportSize({ width: 320, height: 330 });
  await mp.goto(`http://localhost:${PORT}/tests/menu.html`);
  const menu = await mp.locator('.contextMenuContents').evaluate(n => [getComputedStyle(n).borderTopLeftRadius, getComputedStyle(n).backgroundColor]);
  check('Steam popup menus: rounded dark-blue panel', menu[0] === '14px' && /rgba\(9, 20, 46/.test(menu[1]), menu.join(' '));
  const foc = await mp.locator('.MenuItem.Focus').evaluate(n => getComputedStyle(n).backgroundColor);
  check('Steam popup menus: blue highlight', foc === 'rgb(0, 112, 209)', foc);
  await mp.waitForTimeout(300);
  if (SHOTS) await mp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-menu.jpg'), type: 'jpeg', quality: 85 });
  await mp.close();

  // ---- v1.6.0: friends list + chat windows (PS5 Game Base)
  const fp = await ctx.newPage();
  const ferr = [];
  fp.on('pageerror', e => ferr.push(String(e)));
  await fp.route(/steamstatic\.com/, r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="460" height="215"><rect width="460" height="215" fill="#2a4d8f"/></svg>' }));
  await fp.setViewportSize({ width: 340, height: 760 });
  await fp.goto(`http://localhost:${PORT}/tests/friends.html`);
  await fp.waitForTimeout(250);
  check('friends: list window marked (.ps5-fl)', await fp.evaluate(() => document.documentElement.classList.contains('ps5-fl')));
  const fcard = await fp.locator('#fr-a').evaluate(n => [n.dataset.ps5Art, n.dataset.ps5Game, n.style.getPropertyValue('--ps5-fl-art'), getComputedStyle(n, '::after').content, getComputedStyle(n).minHeight]);
  check('friends: in-game friend = Game Base card with the game\'s art (appid from the icon)', fcard[0] === '620' && /apps\/620\/library_hero\.jpg/.test(fcard[2]) && fcard[4] === '92px', fcard.slice(0, 3).join(' | '));
  check('friends: game title on the card', fcard[1] === 'Starfall Odyssey' && /Starfall Odyssey/.test(fcard[3]), fcard[3]);
  check('friends: non-Steam game keeps a plain row (no art)', !(await fp.locator('#fr-ns').getAttribute('data-ps5-art')));
  check('friends: a game group carries the art on its header', (await fp.locator('#grp-game').getAttribute('data-ps5-art')) === '440');
  const fav = await fp.evaluate(() => ['#fr-on .avatarHolder', '#fr-a .avatarHolder', '#av-away', '#av-off'].map(s => { const n = document.querySelector(s); const a = getComputedStyle(n, '::after'); return [getComputedStyle(n.querySelector('img')).borderTopLeftRadius, a.backgroundColor, a.borderTopColor, a.borderTopWidth]; }));
  check('friends: round avatars', fav.every(a => a[0] === '50%'), fav.map(a => a[0]).join(' '));
  check('friends: status dots — online blue, in game green, away amber, offline ring', fav[0][1] === 'rgb(45, 155, 255)' && fav[1][1] === 'rgb(63, 209, 90)' && fav[2][1] === 'rgb(255, 181, 71)' && fav[3][1] === 'rgba(0, 0, 0, 0)' && fav[3][3] === '2px', fav.map(a => a[1]).join(' / '));
  check('friends: Steam\'s status strip hidden', await fp.locator('#fr-on .avatarStatus').isHidden());
  const fprof = await fp.locator('.currentUserContainer').evaluate(n => [getComputedStyle(n).borderTopLeftRadius, getComputedStyle(n.querySelector('.currentUserAvatar .avatarHolder')).width]);
  check('friends: profile card (rounded, 54 px avatar)', fprof[0] === '22px' && fprof[1] === '54px', fprof.join(' '));
  check('friends: Steam\'s header glow hidden', await fp.locator('.statusHeaderGlow').isHidden());
  const ftab = await fp.locator('.friendTab.activeTab > .tabLabel').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n).borderTopLeftRadius, getComputedStyle(n.parentElement).textTransform]);
  check('friends: active tab = white pill, no caps', ftab[0] === 'rgb(255, 255, 255)' && ftab[2] === 'none', ftab.join(' '));
  const fbtn = await fp.locator('.addFriendButton').evaluate(n => [getComputedStyle(n).width, getComputedStyle(n).borderTopLeftRadius]);
  check('friends: round 34 px icon buttons', fbtn[0] === '34px' && fbtn[1] === '50%', fbtn.join(' '));
  check('friends: group header — count chip, no caps', await fp.locator('.onlineFriends .groupName').evaluate(n => getComputedStyle(n).textTransform === 'none' && getComputedStyle(n.querySelector('.groupCount')).borderTopLeftRadius === '99px'));
  const fx = await fp.evaluate(() => {
    const g = s => document.querySelector(s), r = s => g(s).getBoundingClientRect();
    return { tabBg: getComputedStyle(g('.friendTab.activeTab')).backgroundColor, frame: getComputedStyle(g('#afr')).display,
      plusY: Math.abs((r('#gn-on .ExpandPlusMinus').top + r('#gn-on .ExpandPlusMinus').height / 2) - (r('#gn-on').top + r('#gn-on').height / 2)),
      titleL: r('#gn-on').left, otherL: r('.offlineFriends .groupName').left, qa: getComputedStyle(g('#qa .quickAccessFriendsMessageDismiss')).position,
      qaIn: r('#qa .quickAccessFriendsMessageDismiss').right <= r('#qa').right + 1, card: r('.currentUserContainer').top, close: getComputedStyle(g('#wclose')).borderTopLeftRadius };
  });
  check('friends fix: the Friends tab with its buttons is no longer one white plate', fx.tabBg === 'rgba(0, 0, 0, 0)', fx.tabBg);
  check('friends fix: group titles start at the left, the +/- sits on the title line', Math.abs(fx.titleL - fx.otherL) < 2 && fx.plusY <= 2, `${fx.titleL}/${fx.otherL} dy=${fx.plusY}`);
  check('friends fix: "drag favourites here" box tidy, "Got it" inside it', fx.qa === 'static' && fx.qaIn);
  check('friends fix: Steam\'s square avatar frame hidden, card below the window buttons', fx.frame === 'none' && fx.card >= 30 && fx.close === '8px', `${fx.frame} top=${fx.card}`);
  await fp.hover('#fr-on');
  await fp.waitForTimeout(300);
  check('friends: hover = PS5 white focus ring', /rgba\(255, 255, 255, 0\.9\) 0px 0px 0px 2px/.test(await fp.locator('#fr-on').evaluate(n => getComputedStyle(n).boxShadow)));
  if (SHOTS) { await fp.mouse.move(0, 0); await fp.waitForTimeout(300); await fp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-friends-list.jpg'), type: 'jpeg', quality: 85 }); }
  await fp.addStyleTag({ path: path.join(DIR, '..', 'css', 'options', 'friends-faces.css') });
  await fp.waitForTimeout(100);
  const face = await fp.locator('.offlineFriends .friend').evaluate(n => [getComputedStyle(n).width, getComputedStyle(n).borderTopLeftRadius, getComputedStyle(n.querySelector('.labelHolder')).display, n.dataset.ps5Name]);
  check('option «Offline friends: Faces»: round faces, name kept for the hover label', face[0] === '46px' && face[1] === '50%' && face[2] === 'none' && face[3] === 'Ghost', face.join(' '));
  await fp.setViewportSize({ width: 520, height: 560 });
  await fp.goto(`http://localhost:${PORT}/tests/friends.html?chat`);
  await fp.waitForTimeout(200);
  check('chat: window marked (.ps5-chat)', await fp.evaluate(() => document.documentElement.classList.contains('ps5-chat')));
  const ch = await fp.evaluate(() => {
    const cs = (q, p) => getComputedStyle(document.querySelector(q), p);
    return {
      bubble: cs('.ChatMessageBlock .msgText').backgroundColor, disp: cs('.ChatMessageBlock .msgText').display,
      tab: cs('.ChatTab.Active').boxShadow, tabH: cs('.ChatTab.Active').height,
      area: cs('.chatEntry textarea').borderTopLeftRadius, send: cs('.chatSubmitButton').backgroundColor,
      entry: cs('.chatEntry').boxShadow, strip: cs('.chatWindow .avatarHolder .avatarStatus').display,
      bg: cs('.chatWindow').backgroundImage,
    };
  });
  check('chat: Steam\'s layout kept — no bubbles or forced sizes on messages and tabs', ch.bubble === 'rgba(0, 0, 0, 0)' && ch.disp === 'block' && ch.tabH === '30px', `${ch.bubble} ${ch.disp} ${ch.tabH}`);
  check('chat: active tab = soft pill with a white hairline', /rgba\(255, 255, 255, 0\.28\)/.test(ch.tab), ch.tab);
  check('chat: rounded field, Send in the accent, hairline over the entry row', ch.area === '12px' && ch.send === 'rgb(0, 112, 209)' && /inset/.test(ch.entry), `${ch.area} ${ch.send}`);
  check('chat: Steam\'s status strip hidden, PS5 ground', ch.strip === 'none' && /radial-gradient/.test(ch.bg));
  if (SHOTS) await fp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-chat.jpg'), type: 'jpeg', quality: 85 });
  check('friends/chat: no script errors', ferr.length === 0, ferr.join(' | '));
  await fp.close();

  // ---- v1.7.0: sign-in window + Settings window
  const lp = await ctx.newPage();
  await lp.setViewportSize({ width: 700, height: 440 });
  await lp.goto(`http://localhost:${PORT}/tests/login.html`);
  await lp.waitForTimeout(200);
  const lg = await lp.evaluate(() => { const c = s => document.querySelector(s); return [getComputedStyle(c('.SpinnerLoaderContainer > img.Small')).opacity, getComputedStyle(c('.SpinnerLoaderContainer'), '::before').borderTopColor, getComputedStyle(c('.SpinnerLoaderContainer'), '::before').animationName, getComputedStyle(c('.Percent')).backgroundColor, getComputedStyle(c('.UserContainer')).borderTopLeftRadius, getComputedStyle(c('#status')).backgroundImage]; });
  check('sign-in: Steam\'s blue spinner replaced by a white PS5 ring', lg[0] === '0' && lg[1] === 'rgb(255, 255, 255)' && lg[2] === 'ps5-login-spin', lg.slice(0, 3).join(' '));
  check('sign-in: white progress bar, account as a pill, PS5 ground', lg[3] === 'rgb(255, 255, 255)' && lg[4] === '999px' && /linear-gradient/.test(lg[5]), lg.slice(3, 5).join(' '));
  if (SHOTS) await lp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-login.jpg'), type: 'jpeg', quality: 85 });
  await lp.goto(`http://localhost:${PORT}/tests/login.html?chooser`);
  await lp.waitForTimeout(200);
  const ch2 = await lp.evaluate(() => [getComputedStyle(document.querySelector('#u1 .Icon')).borderTopLeftRadius, getComputedStyle(document.querySelector('.WhosPlaying')).fontSize]);
  check('sign-in: "Who\'s playing?" with round avatars (PS5 user select)', ch2[0] === '50%' && ch2[1] === '30px', ch2.join(' '));
  await lp.hover('#u1');
  await lp.waitForTimeout(350);
  check('sign-in: hovered account gets the white PS5 ring', /rgb\(255, 255, 255\) 0px 0px 0px 3px/.test(await lp.locator('#u1 .Icon').evaluate(n => getComputedStyle(n).boxShadow)));
  if (SHOTS) await lp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-login-chooser.jpg'), type: 'jpeg', quality: 85 });
  await lp.setViewportSize({ width: 900, height: 560 });
  await lp.goto(`http://localhost:${PORT}/tests/settings.html`);
  await lp.waitForTimeout(200);
  const st = await lp.evaluate(() => { const c = s => getComputedStyle(document.querySelector(s)); return [c('#pi-a').backgroundColor, c('#pi-a').textTransform, c('#fd-1').borderTopLeftRadius, c('#dd-1').borderTopLeftRadius, c('#db-1').borderTopLeftRadius, c('.PagedSettingsDialog_PageListColumn').backgroundColor]; });
  check('settings window: selected page white, no caps', st[0] === 'rgb(255, 255, 255)' && st[1] === 'none', st.slice(0, 2).join(' '));
  check('settings window: rows as rounded cards, pill dropdowns and buttons', st[2] === '14px' && st[3] === '999px' && st[4] === '999px', st.slice(2, 5).join(' '));
  check('settings window: Steam\'s grey column gone', st[5] !== 'rgb(42, 45, 52)', st[5]);
  if (SHOTS) await lp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-settings.jpg'), type: 'jpeg', quality: 85 });
  await lp.close();

  // ---- web pages on the real hostnames, injected the way Millennium does
  const wp = await ctx.newPage();
  const werr = [];
  wp.on('pageerror', e => werr.push(String(e)));
  await wp.route('https://millennium.host/v1/themes/PS5/**', r => {
    const rel = new URL(r.request().url()).pathname.replace('/v1/themes/PS5/', '');
    const file = path.join(DIR, '..', rel);
    r.fulfill({ status: 200, contentType: rel.endsWith('.css') ? 'text/css' : 'text/javascript', body: fs.readFileSync(file) });
  });
  await wp.route('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/**', async r => {
    const m = /apps\/(\d+)\/(library_hero\.jpg|logo\.png|library_600x900\.jpg|header\.jpg)/.exec(r.request().url());
    if (!m || (m[1] === '202' && m[2] === 'logo.png')) return r.fulfill({ status: 404, body: '' });
    const res = await fetch(`http://localhost:${PORT}/assets/${m[1]}/${m[2]}`);
    r.fulfill({ status: res.status, contentType: 'image/svg+xml', body: Buffer.from(await res.arrayBuffer()) });
  });
  const removed = [];
  const WL = { '76561190000000001': [[107, 3, 1709251200], [109, 1, 1707696000], [105, 2, 1704067200], [103, 4, 1703030400], [110, 5, 1700000000], [101, 6, 1690000000]], '76561190000000002': [[999, 1, 1700000000]] };
  const NAMES = { 107: 'Shadow Protocol', 109: 'Last Frontier', 105: 'Ocean of Echoes', 103: 'Hollow Kingdom', 110: 'Crystal Caves', 101: 'Starfall Odyssey', 999: 'Somebody Else' };
  const PCT = { 107: 40, 105: 20, 110: 75 };
  await wp.route('https://api.steampowered.com/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname.includes('GetWishlist')) {
      const list = (WL[u.searchParams.get('steamid')] || []).map(([appid, priority, date_added]) => ({ appid, priority, date_added }));
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ response: { items: list } }) });
    }
    if (u.pathname.includes('GetItems')) {
      const input = JSON.parse(u.searchParams.get('input_json'));
      const store_items = input.ids.map(({ appid }) => ({ appid, name: NAMES[appid], assets: { asset_url_format: `steam/apps/${appid}/\${FILENAME}`, library_capsule: 'library_600x900.jpg', header: 'header.jpg' },
        best_purchase_option: { packageid: appid * 10, discount_pct: PCT[appid] || 0, final_price_in_cents: Math.round(2999 * (100 - (PCT[appid] || 0)) / 100), formatted_final_price: ((2999 * (100 - (PCT[appid] || 0)) / 100) / 100).toFixed(2).replace('.', ',') + '€', formatted_original_price: '29,99€' },
        reviews: { summary_filtered: { review_score_label: 'Very Positive', percent_positive: 80 + (appid % 15) } }, release: { steam_release_date: 1600000000 + appid * 1000 } }));
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ response: { store_items } }) });
    }
    r.fulfill({ status: 404, body: '' });
  });
  await wp.route('https://store.steampowered.com/api/removefromwishlist', r => {
    removed.push(Object.fromEntries(new URLSearchParams(r.request().postData() || '')));
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
  });
  await wp.route('https://cdn.ps5-mock.test/**', async r => {
    const u = r.request().url().replace('https://cdn.ps5-mock.test/', `http://localhost:${PORT}/`);
    const res = await fetch(u);
    r.fulfill({ status: res.status, contentType: res.headers.get('content-type') || 'image/svg+xml', body: Buffer.from(await res.arrayBuffer()) });
  });
  await wp.route(/https:\/\/(store\.steampowered\.com|steamcommunity\.com|checkout\.steampowered\.com|example\.com)\/.*/, r => {
    if (/\/api\//.test(r.request().url())) return r.fallback();
    const fn = WEB[r.request().url()];
    r.fulfill(fn ? { status: 200, contentType: 'text/html', body: fn() } : { status: 404, body: '' });
  });
  const cls = () => wp.evaluate(() => document.documentElement.className);
  await wp.goto('https://store.steampowered.com/');
  await wp.waitForTimeout(500);
  check('store: PS5 layer active on store.steampowered.com', /ps5-web/.test(await cls()) && /ps5-store/.test(await cls()) && /ps5-p-home/.test(await cls()), await cls());
  check('store: web header hidden in client', await wp.locator('#global_header').isHidden());
  const cap = await wp.locator('.store_capsule').first().evaluate(n => getComputedStyle(n).borderTopLeftRadius);
  check('store: game cards rounded', cap === '14px', cap);
  const disc = await wp.locator('.discount_pct').first().evaluate(n => getComputedStyle(n).backgroundColor);
  check('store: discount badge in PS5 blue', disc === 'rgb(0, 112, 209)', disc);
  check('store: React mount capsules marked', await wp.locator('[data-ps5-cap="1"]').count() === 3);
  const navbg = await wp.locator('.store_nav').evaluate(n => getComputedStyle(n).borderTopLeftRadius);
  check('store: navigation is a rounded glass bar', navbg === '20px', navbg);
  // double discount: Steam's struck-through bundle note must not become a second badge
  const bb = await wp.locator('#dev-trending .bundle_base_discount').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n).fontSize, getComputedStyle(n, '::before').content]);
  const dp = await wp.locator('#dev-trending .discount_pct').evaluate(n => getComputedStyle(n).backgroundColor);
  check('discounts: -55% is the one sale badge', dp === 'rgb(0, 112, 209)', dp);
  check('discounts: bundle "-10%" stays Steam\'s small struck-through note (no second badge)', bb[0] === 'rgba(0, 0, 0, 0)' && bb[1] === '11px' && bb[2] !== 'none', bb.join(' | '));
  check('discounts: nothing recomputed or duplicated (DOM unchanged)', (await wp.locator('#dev-trending .discount_pct').count()) === 1 && (await wp.locator('#dev-trending').textContent()).match(/%/g).length === 2);
  // arrows: compact disc, no big white circle
  await wp.locator('.carousel_container .arrow.right').hover();
  await wp.waitForTimeout(250);
  const ar = await wp.locator('.carousel_container .arrow.right').evaluate(n => { const d = n.firstElementChild, r = n.getBoundingClientRect(), q = d.getBoundingClientRect(); return [getComputedStyle(n).backgroundColor, Math.round(r.width), Math.round(r.height), Math.round(q.width), getComputedStyle(d).backgroundColor, Math.round((q.left + q.width / 2) - (r.left + r.width / 2)), Math.round((q.top + q.height / 2) - (r.top + r.height / 2)), getComputedStyle(d, '::before').maskImage || getComputedStyle(d, '::before').webkitMaskImage]; });
  check('arrows: hit area transparent and unchanged (45×108)', ar[0] === 'rgba(0, 0, 0, 0)' && ar[1] === 45 && ar[2] === 108, ar.join(' | '));
  check('arrows: 38 px disc IS the chevron box (centred, no drift), blue on hover', ar[3] === 38 && ar[4] === 'rgb(0, 112, 209)' && Math.abs(ar[5]) <= 1 && Math.abs(ar[6]) <= 1 && /svg/.test(ar[7]), ar.join(' | '));
  if (SHOTS) await wp.locator('.carousel_container').screenshot({ path: path.join(DIR, '..', 'assets', 'preview-store-arrows.jpg'), type: 'jpeg', quality: 82 });
  await wp.locator('#cbr').hover();
  await wp.waitForTimeout(250);
  const cb = await wp.locator('#cbr').evaluate(n => [n.getAttribute('data-ps5-arrow'), getComputedStyle(n).backgroundColor, getComputedStyle(n, '::before').width, getComputedStyle(n, '::before').backgroundColor, Math.round(n.getBoundingClientRect().width), Math.round(n.getBoundingClientRect().height)]);
  check('React carousel arrows (.CarouselBtnRight): marked, transparent hit area at Steam\'s size', cb[0] === '' && cb[1] === 'rgba(0, 0, 0, 0)' && cb[4] === 48 && cb[5] === 96, cb.join(' | '));
  check('React carousel arrows: 36 px disc, blue on hover — no white circle', cb[2] === '36px' && cb[3] === 'rgb(0, 112, 209)', cb.join(' | '));
  const cc = await wp.locator('#cbr').evaluate(n => [getComputedStyle(n.querySelector('svg')).display, getComputedStyle(n, '::after').width, getComputedStyle(n, '::after').marginLeft]);
  check('React carousel arrows: chevron drawn at the button centre (Steam\'s off-centre svg hidden)', cc[0] === 'none' && cc[1] === '14px', cc.join(' | '));
  await wp.mouse.move(700, 600);
  await wp.locator('#cbl').focus();
  const cbf = await wp.locator('#cbl').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n).outlineStyle]);
  check('React carousel arrows: focus state also transparent, no outline ring', cbf[0] === 'rgba(0, 0, 0, 0)' && cbf[1] === 'none', cbf.join(' | '));
  const homeW = await wp.locator('.page_content').evaluate(n => getComputedStyle(n).maxWidth);
  check('store home keeps Steam\'s centred column (no left-aligned max-width)', homeW !== '1240px', homeW);
  const v7 = await wp.evaluate(() => getComputedStyle(document.body).getPropertyValue('--color-greyneutral-2').trim());
  check('store palette: Steam\'s own colour variables remapped to PS5', v7 === '#061230', v7);
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-store.jpg'), type: 'jpeg', quality: 82 });
  await wp.evaluate(() => history.pushState({}, '', '/search/?term=space'));
  await wp.waitForTimeout(400);
  check('store: SPA navigation updates page kind', /ps5-p-search/.test(await cls()) && !/ps5-p-home/.test(await cls()));
  await wp.goto('https://store.steampowered.com/app/101/Starfall_Odyssey/');
  await wp.waitForTimeout(500);
  await wp.waitForTimeout(400);
  check('store game page: PS Store hero built once', await wp.locator('[data-ps5-hero]').count() === 1 && /ps5-hero-on/.test(await cls()));
  check('hero: title, logo, chips (sale + reviews + date + developer)', (await wp.locator('.ps5-hero-chip').count()) === 4 && await wp.locator('.ps5-hero.has-logo').count() === 1);
  check('hero: sale chip reads Steam\'s own percent and countdown', (await wp.locator('.ps5-hero-chip.sale').textContent()) === '-25% · Offer ends 4 December');
  check('hero: price is Steam\'s strings of the base edition, one percent only', (await wp.locator('.ps5-hero-price').textContent()) === '-25%59,99€44,99€' && (await wp.locator('.ps5-hero-price .pct').count()) === 1);
  await wp.click('.ps5-hero-btn.primary');
  check('hero: primary button clicks Steam\'s own Add to Cart', (await wp.evaluate(() => window.__cart)) === 1 && (await wp.locator('.ps5-hero-btn.primary').textContent()) === 'Add to Cart');
  await wp.click('.ps5-hero-btn.wish');
  await wp.waitForTimeout(450);
  check('hero: heart drives Steam\'s wishlist links', (await wp.locator('.ps5-hero-btn.wish').getAttribute('aria-pressed')) === 'true' && await wp.locator('#add_to_wishlist_area_success').isVisible());
  await wp.click('.ps5-hero-btn.wish');
  await wp.waitForTimeout(450);
  check('hero: heart removes again', (await wp.locator('.ps5-hero-btn.wish').getAttribute('aria-pressed')) === 'false');
  const rowsL = await wp.$$eval('.ps5-info-col:first-child .ps5-info-label', ns => ns.map(n => n.textContent));
  const rowsR = await wp.$$eval('.ps5-info-col:last-child .ps5-info-label', ns => ns.map(n => n.textContent));
  check('about: left column = release, developer, publisher', rowsL.join('|') === 'Release date|Developer|Publisher', rowsL.join('|'));
  check('about: right column = genres, tags', rowsR.join('|') === 'Genres|Tags', rowsR.join('|'));
  check('about: values are Steam\'s (links kept, tags moved with their "+")', (await wp.locator('.ps5-info-link').first().getAttribute('href')) === 'https://store.steampowered.com/developer/mock' && await wp.locator('.ps5-info-value .glance_tags_ctn .app_tag').count() === 3 && (await wp.locator('.ps5-info-col:last-child .ps5-info-value').first().textContent()) === 'Action, RPG');
  const sp = await wp.evaluate(() => { const m = document.querySelector('.ps5-split-media').getBoundingClientRect(), d = document.querySelector('.ps5-split-side').getBoundingClientRect(); return [Math.round(m.left), Math.round(d.left), !!document.querySelector('.ps5-split-media #game_highlights'), document.querySelectorAll('.ps5-split-side > .ps5-info, .ps5-split-side > .ps5-reviews').length]; });
  check('media on one side (left), about + reviews stacked on the other', sp[0] < sp[1] && sp[2] && sp[3] === 2, sp.join(' / '));
  check('reviews: score, label and count from Steam\'s rows', (await wp.locator('.ps5-rev-share').textContent()) === '92%' && (await wp.locator('.ps5-rev-label').textContent()) === 'Very Positive' && await wp.locator('a.ps5-rev-link[href="#app_reviews_hash"]').count() === 1);
  check('Steam\'s glance box steps back, gallery takes the full column', await wp.locator('.glance_ctn').isHidden() && /ps5-glance-off/.test(await cls()));
  const ga = await wp.locator('#galprev').evaluate(n => [n.getAttribute('data-ps5-arrow'), getComputedStyle(n).backgroundColor]);
  check('gallery paging arrow (Steam\'s white 50% circle) gets the compact disc', ga[0] === '' && ga[1] === 'rgba(0, 0, 0, 0)', ga.join(' | '));
  await wp.locator('#game_highlights').hover();
  await wp.click('.ps5-gal-full');
  await wp.waitForTimeout(250);
  check('gallery: full-screen viewer', await wp.locator('.ps5-viewer.open').count() === 1);
  await wp.keyboard.press('Escape');
  check('hero: Steam\'s duplicated title / snippet step back', await wp.locator('.apphub_AppName').isHidden() && await wp.locator('.glance_ctn .game_description_snippet').isHidden());
  check('hero: editions + media buttons (2 editions on the page)', (await wp.locator('.ps5-hero-btn.ghost:not(.wish)').count()) === 2);
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-store-hero.jpg'), type: 'jpeg', quality: 84 });
  await wp.click('.ps5-hero-shot >> nth=1');
  await wp.waitForTimeout(200);
  await wp.click('.ps5-hero-shot >> nth=1');
  await wp.waitForTimeout(300);
  check('hero: thumbnail → background, second click → viewer', await wp.locator('.ps5-viewer.open').count() === 1 && (await wp.locator('.ps5-viewer .count').textContent()) === '2 / 5');
  await wp.keyboard.press('ArrowRight');
  check('viewer: arrow keys page through', (await wp.locator('.ps5-viewer .count').textContent()) === '3 / 5');
  await wp.keyboard.press('Escape');
  check('viewer: Esc closes', await wp.locator('.ps5-viewer.open').count() === 0);
  // purchase rows sit inside their cards (Steam hangs them 17 px below the edge)
  const pa = await wp.$$eval('.game_area_purchase_game', ns => ns.map(n => { const b = n.getBoundingClientRect(), a = n.querySelector('.game_purchase_action').getBoundingClientRect(); return Math.round(b.bottom - a.bottom); }));
  check('store: "Add to Cart" rows stay inside their card (no overlap with the next one)', pa.every(d => d >= 8), pa.join(','));
  if (SHOTS) { await wp.evaluate(() => document.querySelector('#game_area_purchase').scrollIntoView({ block: 'center' })); await wp.waitForTimeout(150); await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-store-buy.jpg'), type: 'jpeg', quality: 84 }); }
  if (SHOTS) { await wp.evaluate(() => document.querySelector('.ps5-split').scrollIntoView({ block: 'start' })); await wp.waitForTimeout(200); await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-store-about.jpg'), type: 'jpeg', quality: 84 }); await wp.evaluate(() => scrollTo(0, 0)); }
  check('store game page: kind + art from the page', /ps5-p-app/.test(await cls()) && /library_hero/.test(await wp.evaluate(() => document.documentElement.style.getPropertyValue('--ps5-page-art'))));
  const buy = await wp.locator('.game_area_purchase_game').first().evaluate(n => getComputedStyle(n).borderTopLeftRadius);
  const btn = await wp.locator('.btn_green_steamui').first().evaluate(n => [getComputedStyle(n).borderTopLeftRadius, getComputedStyle(n).backgroundColor]);
  check('store game page: PS Store buy panel and blue pill button', buy === '12px' && btn[0] === '999px' && btn[1] === 'rgb(0, 112, 209)', buy + ' ' + btn.join(' '));
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-store-game.jpg'), type: 'jpeg', quality: 82 });
  await wp.goto('https://store.steampowered.com/wishlist/id/vasya/');
  await wp.waitForTimeout(500);
  check('wishlist: page kind', /ps5-p-wishlist/.test(await cls()));
  await wp.click('.ps5-wview').catch(() => {});
  const row = await wp.locator('[data-rfd-draggable-id] > .Panel').first().evaluate(n => getComputedStyle(n).borderTopLeftRadius);
  check('wishlist: every game is a PS5 card', row === '20px', row);
  const add = await wp.locator('[data-rfd-draggable-id] button[type=button] > span').first().evaluate(n => getComputedStyle(n).backgroundColor);
  check('wishlist: Add to Cart is the blue primary action', add === 'rgb(0, 112, 209)', add);
  await wp.locator('[data-rfd-draggable-id] > .Panel').nth(1).hover();
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-wishlist.jpg'), type: 'jpeg', quality: 82 });
  // ---- a different game: long title, no logo, one screenshot, no reviews, no publisher
  await wp.goto('https://store.steampowered.com/app/202/Long/');
  await wp.waitForTimeout(700);
  check('game #2: hero built without a logo (text title)', await wp.locator('[data-ps5-hero]').count() === 1 && await wp.locator('.ps5-hero.has-logo').count() === 0 && await wp.locator('h1.ps5-hero-title').isVisible());
  const t2 = await wp.locator('h1.ps5-hero-title').evaluate(n => [n.scrollWidth <= n.clientWidth + 1, Math.round(n.getBoundingClientRect().height)]);
  check('game #2: long title wraps inside the hero (≤ 3 lines, smaller size)', t2[0] && t2[1] <= 130, t2.join(' / '));
  const d2 = await wp.locator('.ps5-hero-desc').evaluate(n => n.getBoundingClientRect().height);
  check('game #2: long description clamped to 3 lines', d2 < 80, String(d2));
  check('game #2: no invented rows (no developer / publisher / genres / reviews)', (await wp.$$eval('.ps5-info-label', ns => ns.map(n => n.textContent))).join('|') === 'Release date' && await wp.locator('.ps5-reviews').count() === 0);
  check('game #2: a single screenshot → no lonely thumbnail strip', await wp.locator('.ps5-hero-shot').count() === 0);
  const al = await wp.evaluate(() => [Math.round(document.querySelector('.ps5-hero-main').getBoundingClientRect().left), Math.round(document.querySelector('.ps5-split').getBoundingClientRect().left)]);
  check('hero text and the cards below share one left edge', Math.abs(al[0] - al[1]) <= 2, al.join(' / '));
  const hh = await wp.locator('.ps5-hero').evaluate(n => n.getBoundingClientRect().height);
  check('hero height kept moderate (≤ 600 px at 860 px window)', hh <= 600, String(hh));
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-store-hero-2.jpg'), type: 'jpeg', quality: 84 });

  // ---- wishlist grid on real data
  await wp.goto('https://store.steampowered.com/wishlist/id/vasya/');
  await wp.waitForSelector('#ps5-wish .ps5-wview', { timeout: 6000 }).catch(() => {});
  if (!/ps5-wish-grid/.test(await cls())) await wp.click('.ps5-wview');
  check('wishlist: PS5 grid built from Steam\'s wishlist API', await wp.locator('#ps5-wish .ps5-wcard').count() === 6 && /ps5-wish-grid/.test(await cls()));
  check('wishlist: Steam\'s list hidden behind the grid (not removed)', await wp.locator('[data-ps5-wnative=""]').count() === 1 && await wp.locator('[data-ps5-wnative=""]').isHidden());
  check('wishlist: Steam\'s duplicate search/sort bar hidden in grid mode', await wp.locator('[data-ps5-wnative="tools"]').isHidden());
  const edge = await wp.evaluate(() => [Math.round(document.querySelector('#StoreTemplate h1').getBoundingClientRect().left), Math.round(document.querySelector('.ps5-wgrid').getBoundingClientRect().left)]);
  check('wishlist: page title and grid share one left edge', Math.abs(edge[0] - edge[1]) <= 20, edge.join(' / '));
  const gw = await wp.locator('.ps5-wgrid').evaluate(n => { const r = n.getBoundingClientRect(); return [getComputedStyle(n).gridTemplateColumns.split(' ').length, Math.round(r.width), Math.round(r.left), Math.round(innerWidth - r.right)]; });
  check('wishlist: grid uses the width (≥ 6 columns at 1440 px, centred, no empty right side)', gw[0] >= 6 && gw[1] >= 1200 && Math.abs(gw[2] - gw[3]) <= 24, gw.join(' / '));
  check('wishlist: card shows Steam\'s price, discount, reviews and date added', (await wp.locator('.ps5-wcard[data-app="110"] .ps5-wcard-pct').textContent()) === '-75%' && (await wp.locator('.ps5-wcard[data-app="110"] .ps5-wcard-price').textContent()) === '29,99€7,50€' && /Added/.test(await wp.locator('.ps5-wcard[data-app="110"] .ps5-wcard-meta').textContent()));
  check('wishlist: default order = your rank', (await wp.locator('.ps5-wcard').first().getAttribute('data-app')) === '109');
  await wp.selectOption('.ps5-wsort', 'discount');
  check('wishlist: sort by discount', (await wp.locator('.ps5-wcard').first().getAttribute('data-app')) === '110');
  await wp.click('.ps5-wchip');
  check('wishlist: "On sale" filter', await wp.locator('.ps5-wcard').count() === 3 && (await wp.locator('.ps5-wcount').textContent()) === '3 games');
  await wp.click('.ps5-wchip');
  await wp.fill('.ps5-wsearch', 'ocean');
  await wp.waitForTimeout(250);
  check('wishlist: search', await wp.locator('.ps5-wcard').count() === 1);
  await wp.fill('.ps5-wsearch', '');
  await wp.waitForTimeout(250);
  await wp.click('.ps5-wcard[data-app="105"] [data-act="cart"]');
  check('wishlist: Add to Cart calls Steam\'s addToCart(packageid)', JSON.stringify(await wp.evaluate(() => window.__carted)) === '[1050]');
  await wp.click('.ps5-wcard[data-app="105"] [data-act="remove"]');
  check('wishlist: remove asks for a second press', removed.length === 0 && await wp.locator('.ps5-wcard[data-app="105"] [data-act="remove"].confirm').count() === 1);
  await wp.click('.ps5-wcard[data-app="105"] [data-act="remove"]');
  await wp.waitForTimeout(500);
  check('wishlist: remove → POST /api/removefromwishlist {sessionid, appid}', removed.length === 1 && removed[0].sessionid === 'sess42' && removed[0].appid === '105' && await wp.locator('.ps5-wcard[data-app="105"]').count() === 0);
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-wishlist.jpg'), type: 'jpeg', quality: 82 });
  await wp.click('.ps5-wview');
  check('wishlist: switch back to Steam\'s own list (and its toolbar)', !/ps5-wish-grid/.test(await cls()) && await wp.locator('[data-ps5-wnative=""]').isVisible() && await wp.locator('[data-ps5-wnative="tools"]').isVisible());
  await wp.click('.ps5-wview');
  await wp.goto('https://store.steampowered.com/wishlist/profiles/76561190000000002/');
  await wp.waitForTimeout(1500);
  check('wishlist: API list ≠ rows on the page → grid not built, Steam\'s list stays', await wp.locator('#ps5-wish').count() === 0 && await wp.locator('[data-rfd-draggable-id]').first().isVisible());

  await wp.goto('https://steamcommunity.com/id/vasya/');
  await wp.waitForTimeout(500);
  check('community profile: left exactly as Steam draws it (theme layer off)', !/ps5-web/.test(await cls()));
  const av = await wp.locator('.playerAvatar.profile_header_size').evaluate(n => getComputedStyle(n).borderTopLeftRadius);
  check('community profile: Steam\'s square avatar', av === '0px', av);
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-profile-psn.jpg'), type: 'jpeg', quality: 82 });
  // ---- v1.6.0: profile tabs get the theme (the profile page above stays Steam's)
  await wp.goto('https://steamcommunity.com/id/vasya/friends/');
  await wp.waitForTimeout(400);
  check('profile tabs: friends page themed', /ps5-web/.test(await cls()) && /ps5-p-friends/.test(await cls()));
  const fnav = await wp.locator('.friends_nav a.icon_item.active').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n).borderTopLeftRadius]);
  check('friends page: menu as pills, current one white', fnav[0] === 'rgb(255, 255, 255)' && fnav[1] === '999px', fnav.join(' '));
  const fgrid = await wp.locator('.responsive_friendblocks').evaluate(n => getComputedStyle(n).display);
  const fb = await wp.locator('#fb-1').evaluate(n => [getComputedStyle(n).borderTopLeftRadius, getComputedStyle(n.querySelector('.player_avatar img')).borderTopLeftRadius, getComputedStyle(n.querySelector('.player_avatar')).borderRightWidth, getComputedStyle(n.querySelector('.player_avatar img')).boxShadow]);
  check('friends page: friends as a grid of PS5 cards', fgrid === 'grid' && fb[0] === '14px', fgrid + ' ' + fb[0]);
  check('friends page: round avatars with a green ring in game, no Steam status strip', fb[1] === '50%' && fb[2] === '0px' && /rgb\(63, 209, 90\)/.test(fb[3]), fb.slice(1).join(' | '));
  check('friends page: search field is a pill', (await wp.locator('.friends_search_text_box').evaluate(n => getComputedStyle(n).borderTopLeftRadius)) === '999px');
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-community-friends.jpg'), type: 'jpeg', quality: 82 });
  await wp.goto('https://steamcommunity.com/id/vasya/home/');
  await wp.waitForTimeout(300);
  const blk = await wp.locator('#bb-1').evaluate(n => [getComputedStyle(n).borderTopLeftRadius, getComputedStyle(n).backgroundColor]);
  check('activity: events as PS5 cards (Steam\'s light-blue fill gone)', /ps5-p-activity/.test(await cls()) && blk[0] === '20px' && !/103, 193, 245/.test(blk[1]), blk.join(' '));
  check('activity: day label pill', (await wp.locator('.blotter_day_header_date').evaluate(n => getComputedStyle(n).borderTopLeftRadius)) === '999px');
  await wp.goto('https://steamcommunity.com/id/vasya/badges/');
  await wp.waitForTimeout(300);
  const br = await wp.locator('#br-1').evaluate(n => [getComputedStyle(n).borderTopLeftRadius, getComputedStyle(n.parentElement).display, getComputedStyle(n).backgroundColor]);
  check('badges: grid of rounded cards', /ps5-p-badges/.test(await cls()) && br[0] === '20px' && br[1] === 'grid' && br[2] !== 'rgb(0, 0, 0)', br.join(' '));
  check('badges: level bar in the accent', (await wp.locator('.profile_xp_block_remaining_bar_progress').evaluate(n => getComputedStyle(n).backgroundColor)) === 'rgb(0, 112, 209)');
  await wp.goto('https://steamcommunity.com/id/vasya/inventory/');
  await wp.waitForTimeout(300);
  const it = await wp.evaluate(() => [getComputedStyle(document.querySelector('a.games_list_tab.active')).backgroundColor, getComputedStyle(document.querySelector('a.games_list_tab')).borderTopLeftRadius, getComputedStyle(document.querySelector('#ih-1')).borderTopLeftRadius]);
  check('inventory: game tabs as pills (current white), rounded item tiles', /ps5-p-inventory/.test(await cls()) && it[0] === 'rgb(255, 255, 255)' && it[1] === '999px' && it[2] === '12px', it.join(' '));
  await wp.goto('https://steamcommunity.com/id/vasya/screenshots/');
  await wp.waitForTimeout(300);
  const sc = await wp.evaluate(() => [getComputedStyle(document.querySelector('#st-1')).backgroundColor, getComputedStyle(document.querySelector('#pm-1 .imgWallItem')).borderTopLeftRadius, getComputedStyle(document.querySelector('#pm-1 .imgWallItem')).borderTopWidth]);
  check('content tabs: white active pill, rounded wall without Steam\'s black border', /ps5-p-screenshots/.test(await cls()) && sc[0] === 'rgb(255, 255, 255)' && sc[1] === '14px' && sc[2] === '0px', sc.join(' '));
  // ---- v1.8.0: cart + checkout
  await wp.goto('https://store.steampowered.com/cart/');
  await wp.waitForTimeout(500);
  const cart = await wp.evaluate(() => {
    const g = s => document.querySelector(s);
    return { item: g('#cl-1').dataset.ps5Cart, total: g('#ct-1').dataset.ps5Cart, recs: !!document.querySelector('.recs [data-ps5-cart]'), bg: g('.cartbg').dataset.ps5Cart,
      itemR: getComputedStyle(g('#cl-1')).borderTopLeftRadius, btn: getComputedStyle(g('#ct-1 .DialogButton.Primary')), bgImg: getComputedStyle(g('.cartbg')).backgroundImage };
  });
  check('cart: lines and the total box found by structure (recommendations left alone)', cart.item === 'item' && cart.total === 'total' && !cart.recs, `${cart.item} ${cart.total} recs=${cart.recs}`);
  const cbtn = await wp.locator('#ct-1 .DialogButton.Primary').evaluate(n => [getComputedStyle(n).backgroundColor, getComputedStyle(n).borderTopLeftRadius]);
  check('cart: lines as rounded cards, "Continue to payment" as the white PS5 button', cart.itemR === '18px' && cbtn[0] === 'rgb(255, 255, 255)' && cbtn[1] === '999px', `${cart.itemR} ${cbtn.join(' ')}`);
  check('cart: Steam\'s full-width background art removed', cart.bg === 'bg' && cart.bgImg === 'none', cart.bgImg);
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-cart.jpg'), type: 'jpeg', quality: 82 });
  await wp.goto('https://checkout.steampowered.com/checkout/?purchasetype=self');
  await wp.waitForTimeout(400);
  const co = await wp.evaluate(() => { const c = (s, p) => getComputedStyle(document.querySelector(s), p); return [c('#tab-on').backgroundColor, c('#pf').borderTopLeftRadius, c('#card_number').borderTopLeftRadius, c('#submit_payment_info_btn').backgroundColor, c('.cart_tab_left_on').display, c('.rightcol', '::before').content, document.documentElement.className]; });
  check('checkout: CSS-only PS5 look (no theme script on payment pages)', !/ps5-web/.test(co[6]) && co[0] === 'rgb(255, 255, 255)' && co[1] === '20px' && co[2] === '999px', co.slice(0, 3).join(' '));
  check('checkout: white main button, Steam\'s PNG tab notches gone, placeholder card shown', co[3] === 'rgb(255, 255, 255)' && co[4] === 'none' && /••••/.test(co[5]), `${co[3]} ${co[4]} ${co[5]}`);
  await wp.focus('#security_code');
  await wp.waitForTimeout(700);
  check('checkout: the card turns over for the security code (no field value read)', /CVC/.test(await wp.evaluate(() => getComputedStyle(document.querySelector('.rightcol'), '::before').content)));
  if (SHOTS) await wp.screenshot({ path: path.join(DIR, '..', 'assets', 'preview-checkout.jpg'), type: 'jpeg', quality: 82 });
  await wp.addStyleTag({ content: ':root{--ps5-web:off}' });
  await wp.waitForTimeout(100);
  check('checkout: «Store and Community → Steam default» turns it off', (await wp.evaluate(() => getComputedStyle(document.querySelector('#submit_payment_info_btn')).backgroundColor)) !== 'rgb(255, 255, 255)');
  await wp.goto('https://example.com/');
  await wp.waitForTimeout(300);
  check('other websites untouched', !/ps5-web/.test(await cls()));
  await wp.goto('https://store.steampowered.com/');
  await wp.addStyleTag({ content: ':root{--ps5-web:off}' });
  await wp.evaluate(() => history.pushState({}, '', '/?x'));
  await wp.waitForTimeout(400);
  check('«Store and Community → Steam default» switches the layer off', !/ps5-web/.test(await cls()));
  check('no errors on web pages', werr.length === 0, werr.join(' | '));
  await wp.close();
} catch (e) {
  check('harness run', false, String(e));
} finally {
  await browser.close();
  srv.kill();
}
const failed = results.filter(r => !r[0]).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
