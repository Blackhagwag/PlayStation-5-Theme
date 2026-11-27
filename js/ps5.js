/* ==========================================================================
   PlayStation 5 — Millennium theme · runtime for the main Steam window
   --------------------------------------------------------------------------
   Builds the PS5 interface on top of Steam's own:
     · Home Screen      (library home: row of games, art background, Play)
     · Game Library     (full-screen grid: Installed / All, search, sort, filter)
     · Control Center   (profile, friends, notifications, voice, music,
                         downloads, settings, power)
     · Game hub strip   (game page: activity cards, description, screenshots)
     · Top bar extras   (Library / Control Center buttons, avatar, clock)
   All data comes from the Steam client itself (window.opener: appStore,
   collectionStore, appDetailsStore, SteamUIStore, SteamClient, FriendStore)
   and from Steam's public store API; every action goes through Steam
   (SteamClient.Apps.RunGame, steam:// URLs, SteamUIStore.Navigate).
   Nothing here edits Steam's files.

   Performance rules followed below:
     · one MutationObserver (on .MainPanel), work batched to one frame
     · a 2 s fallback tick that stops while the window is hidden
     · heavy rebuilds only when a signature of the data changes
     · images lazy-loaded, library grid rendered in pages
     · everything registered is released in destroy() (hot reload safe)
   ========================================================================== */
(() => {
  'use strict';

  if (window.__ps5Theme && typeof window.__ps5Theme.destroy === 'function') {
    try { window.__ps5Theme.destroy(); } catch (e) { /* old instance already gone */ }
  }

  const VERSION = '1.7.0';
  const doc = document;
  const root = doc.documentElement;

  /* ───────────────────────── lifecycle bookkeeping ───────────────────────── */

  const cleanups = [];
  const onCleanup = fn => cleanups.push(fn);
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    onCleanup(() => target.removeEventListener(type, fn, opts));
  };
  const every = (fn, ms) => {
    const id = setInterval(fn, ms);
    onCleanup(() => clearInterval(id));
    return id;
  };

  /* ───────────────────────── Steam access ───────────────────────── */

  // The main window is a popup of Steam's shared JS context: the stores live on window.opener.
  const S = () => {
    try {
      if (window.opener && window.opener.appStore) return window.opener;
    } catch (e) { /* cross-context access refused */ }
    return window.appStore ? window : null;
  };
  const SC = () => {
    const o = S();
    return (o && o.SteamClient) || window.SteamClient || null;
  };
  const friendsApp = () => {
    for (const host of [S(), window]) {
      try { if (host && host.g_FriendsUIApp && host.g_FriendsUIApp.FriendStore) return host.g_FriendsUIApp; } catch (e) { /* none */ }
    }
    return null;
  };
  const safe = (fn, fallback) => { try { const v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } };

  const steamURL = url => {
    try { SC().URL.ExecuteSteamURL(url); return true; } catch (e) { console.warn('[PS5] steam url failed', url, e); return false; }
  };
  const openWeb = url => steamURL('steam://openurl/' + url);
  const navigate = path => {
    const o = S();
    try { o.SteamUIStore.Navigate(path); return; } catch (e) { /* older client */ }
    const m = /^\/library\/app\/(\d+)/.exec(path);
    if (m) steamURL('steam://nav/games/details/' + m[1]);
    else steamURL('steam://open/library/view/home');
  };
  const currentPath = () => safe(() => S().SteamUIStore.WindowStore.MainWindowInstance.m_history.location.pathname, '') || '';

  /* ───────────────────────── small helpers ───────────────────────── */

  const cssVar = name => getComputedStyle(root).getPropertyValue(name).trim();
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const h = (tag, cls, html) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const decodeEntities = (() => {
    const ta = doc.createElement('textarea');
    return s => { ta.innerHTML = String(s || '').replace(/<[^>]*>/g, ' '); return ta.value.replace(/\s+/g, ' ').trim(); };
  })();
  const inTextField = () => {
    const a = doc.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  };

  /* ───────────────────────── language ───────────────────────── */

  const STR = {
    en: {
      play: 'Play', stop: 'Stop', cancel: 'Cancel', install: 'Install', details: 'Game hub', more: 'More',
      library: 'Game Library', libraryHint: 'All your games', controlCenter: 'Control Center',
      lastPlayed: 'Last played', never: 'Not played yet', playtime: 'Play time', achievements: 'Trophies',
      storage: 'Storage', installed: 'Installed', notInstalled: 'Not installed', twoWeeks: 'last 2 weeks',
      hours: n => `${n} h`, minutes: n => `${n} min`,
      justNow: 'just now', minutesAgo: n => `${n} min ago`, hoursAgo: n => `${n} h ago`, daysAgo: n => (n === 1 ? 'yesterday' : `${n} days ago`),
      monthsAgo: n => `${n} mo ago`, yearsAgo: n => `${n} y ago`,
      tabInstalled: 'Installed', tabAll: 'Your Collection', tabRecent: 'Recently Played',
      search: 'Search your games', sortRecent: 'Recently played', sortName: 'Name (A–Z)', sortPlaytime: 'Play time', sortSize: 'Size on disk',
      filterGames: 'Steam games', filterShortcuts: 'Non-Steam', filterHidden: 'Hidden', games: n => `${n} games`, empty: 'No games here',
      profile: 'Profile', friends: 'Game Base', notifications: 'Notifications', voice: 'Voice Chat', music: 'Music',
      downloads: 'Downloads', settings: 'Settings', power: 'Power',
      online: 'Online', away: 'Away', busy: 'Busy', invisible: 'Appear offline', offline: 'Offline',
      viewProfile: 'View profile', myGames: 'Games', myAchievements: 'Achievements', myFriends: 'Friends', badges: 'Badges',
      openFriends: 'Open Friends & Chat', noFriendsOnline: 'No friends online', inGame: 'In game', friendsOnline: n => `${n} online`,
      openNotifications: 'Open notifications', notifHint: 'Gifts, comments, trades and invites from Steam.', communityNotifs: 'Community notifications',
      voiceHint: 'Voice chat lives in Steam Chat: open a friend or a group chat and start a voice channel.', voiceSettings: 'Voice settings', openChat: 'Open Steam Chat',
      soundtracks: 'Soundtracks', musicPlayer: 'Music player', musicHint: 'Your Steam soundtracks.',
      noDownloads: 'No active downloads', openDownloads: 'Open Downloads', paused: 'Paused', remaining: 'left',
      steamSettings: 'Steam Settings', steamSettingsHint: 'Account, storage, interface, in-game, controller…', bigPicture: 'Big Picture Mode',
      restart: 'Restart Steam', exit: 'Exit Steam', changeUser: 'Change account', goOffline: 'Go offline', confirm: 'Press again to confirm',
      launching: name => `Starting ${name}…`, screenshots: 'Screenshots', about: 'About', loading: 'Loading…',
      keysHint: 'Ctrl+Shift+Space Control Center · Ctrl+Shift+L Game Library',
      storePage: 'Store page', communityHub: 'Community hub', controllerLayout: 'Controller layout', desktopShortcut: 'Create desktop shortcut',
      properties: 'Properties', uninstall: 'Uninstall', shortcutDone: 'Desktop shortcut created', walletBalance: 'Wallet',
      account: 'Account', accountDetails: 'Account details', wallet: 'Wallet & purchases', storePrefs: 'Store preferences', language: 'Language',
    },
    ru: {
      play: 'Играть', stop: 'Остановить', cancel: 'Отмена', install: 'Установить', details: 'Центр игры', more: 'Ещё',
      library: 'Библиотека игр', libraryHint: 'Все ваши игры', controlCenter: 'Центр управления',
      lastPlayed: 'Последний запуск', never: 'Ещё не запускалась', playtime: 'Время в игре', achievements: 'Достижения',
      storage: 'Память', installed: 'Установлена', notInstalled: 'Не установлена', twoWeeks: 'за 2 недели',
      hours: n => `${n} ч`, minutes: n => `${n} мин`,
      justNow: 'только что', minutesAgo: n => `${n} мин назад`, hoursAgo: n => `${n} ч назад`, daysAgo: n => (n === 1 ? 'вчера' : `${n} дн. назад`),
      monthsAgo: n => `${n} мес. назад`, yearsAgo: n => `${n} г. назад`,
      tabInstalled: 'Установленные', tabAll: 'Ваша коллекция', tabRecent: 'Недавние',
      search: 'Поиск по играм', sortRecent: 'Недавно запущенные', sortName: 'Название (А–Я)', sortPlaytime: 'Время в игре', sortSize: 'Размер на диске',
      filterGames: 'Игры Steam', filterShortcuts: 'Сторонние', filterHidden: 'Скрытые', games: n => `Игр: ${n}`, empty: 'Здесь пусто',
      profile: 'Профиль', friends: 'Друзья', notifications: 'Уведомления', voice: 'Голосовой чат', music: 'Музыка',
      downloads: 'Загрузки', settings: 'Настройки', power: 'Питание',
      online: 'В сети', away: 'Нет на месте', busy: 'Не беспокоить', invisible: 'Невидимка', offline: 'Не в сети',
      viewProfile: 'Открыть профиль', myGames: 'Игры', myAchievements: 'Достижения', myFriends: 'Друзья', badges: 'Значки',
      openFriends: 'Открыть друзей и чат', noFriendsOnline: 'Никого нет в сети', inGame: 'В игре', friendsOnline: n => `В сети: ${n}`,
      openNotifications: 'Открыть уведомления', notifHint: 'Подарки, комментарии, обмены и приглашения Steam.', communityNotifs: 'Уведомления сообщества',
      voiceHint: 'Голосовой чат — в чате Steam: откройте чат с другом или группой и начните голосовой канал.', voiceSettings: 'Настройки голоса', openChat: 'Открыть чат Steam',
      soundtracks: 'Саундтреки', musicPlayer: 'Музыкальный плеер', musicHint: 'Ваши саундтреки Steam.',
      noDownloads: 'Нет активных загрузок', openDownloads: 'Открыть загрузки', paused: 'Пауза', remaining: 'осталось',
      steamSettings: 'Настройки Steam', steamSettingsHint: 'Аккаунт, хранилище, интерфейс, в игре, контроллер…', bigPicture: 'Режим Big Picture',
      restart: 'Перезапустить Steam', exit: 'Выйти из Steam', changeUser: 'Сменить аккаунт', goOffline: 'Перейти в офлайн', confirm: 'Нажмите ещё раз для подтверждения',
      launching: name => `Запуск: ${name}…`, screenshots: 'Скриншоты', about: 'Об игре', loading: 'Загрузка…',
      keysHint: 'Ctrl+Shift+Space Центр управления · Ctrl+Shift+L Библиотека',
      storePage: 'Страница в магазине', communityHub: 'Центр сообщества', controllerLayout: 'Раскладка контроллера', desktopShortcut: 'Ярлык на рабочем столе',
      properties: 'Свойства', uninstall: 'Удалить', shortcutDone: 'Ярлык создан', walletBalance: 'Кошелёк',
      account: 'Аккаунт', accountDetails: 'Об аккаунте', wallet: 'Кошелёк и покупки', storePrefs: 'Настройки магазина', language: 'Язык',
    },
  };
  const lang = () => {
    const forced = cssVar('--ps5-lang');
    if (forced === 'ru' || forced === 'en') return forced;
    const sys = (navigator.language || 'en').toLowerCase();
    return /^(ru|uk|be|kk)/.test(sys) ? 'ru' : 'en';
  };
  const T = () => STR[lang()];

  /* ───────────────────────── formatting ───────────────────────── */

  const fmtPlaytime = min => {
    min = Number(min) || 0;
    if (min < 60) return T().minutes(min);
    const hrs = min / 60;
    return T().hours(hrs < 10 ? Math.round(hrs * 10) / 10 : Math.round(hrs));
  };
  const fmtAgo = unix => {
    if (!unix) return T().never;
    const s = Math.max(0, Date.now() / 1000 - unix);
    if (s < 90) return T().justNow;
    if (s < 3600) return T().minutesAgo(Math.round(s / 60));
    if (s < 86400) return T().hoursAgo(Math.round(s / 3600));
    if (s < 86400 * 31) return T().daysAgo(Math.round(s / 86400));
    if (s < 86400 * 365) return T().monthsAgo(Math.round(s / (86400 * 30)));
    return T().yearsAgo(Math.round(s / (86400 * 365)));
  };
  const fmtBytes = b => {
    b = Number(b) || 0;
    if (b <= 0) return '—';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b < 10 && i > 2 ? b.toFixed(1) : Math.round(b)} ${u[i]}`;
  };
  const fmtTime = secs => {
    secs = Math.max(0, Math.round(Number(secs) || 0));
    const hh = Math.floor(secs / 3600), mm = Math.floor((secs % 3600) / 60), ss = secs % 60;
    return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
  };

  /* ───────────────────────── library data ───────────────────────── */

  const SHORTCUT = 1073741824;
  const isGame = a => a && (a.app_type === 1 || a.app_type === SHORTCUT);
  const isInstalled = a => {
    try {
      if (a.per_client_data) return [...a.per_client_data].some(c => c && c.installed);
    } catch (e) { /* fall through */ }
    return !!(a && a.installed);
  };
  const sizeOnDisk = a => Number(safe(() => a.size_on_disk, 0)) || 0;
  const isHidden = (o, id) => safe(() => !!o.collectionStore.BIsHidden(id), false);
  const gameIdOf = a => String((a && (a.gameid || a.m_gameid || a.appid)) || '');
  const appById = id => safe(() => S().appStore.GetAppOverviewByAppID(Number(id)), null);

  // allApps is walked at most once every 3 s; everything else reads this cache.
  let appsCache = { at: 0, len: -1, list: [] };
  const allGames = () => {
    const o = S();
    if (!o) return [];
    const apps = safe(() => o.appStore.allApps, []) || [];
    const now = Date.now();
    if (apps.length === appsCache.len && now - appsCache.at < 3000) return appsCache.list;
    const list = [];
    for (const a of apps) {
      if (!isGame(a) || a.visible_in_game_list === false) continue;
      list.push(a);
    }
    appsCache = { at: now, len: apps.length, list };
    return list;
  };

  // EDisplayStatus values Steam uses for the Play button
  const LAUNCHING = 1, RUNNING = 4, TERMINATING = 36;
  const playState = app => {
    const status = safe(() => {
      const local = app.local_per_client_data;
      return local && local.display_status !== undefined ? local.display_status : app.display_status;
    }, undefined);
    if (status === LAUNCHING) return 'cancel';
    if (status === RUNNING || status === TERMINATING) return 'stop';
    return isInstalled(app) ? 'play' : 'install';
  };

  const snack = (() => {
    let node = null, timer = 0;
    return text => {
      if (!node) { node = h('div', '', ''); node.id = 'ps5-snack'; doc.body.appendChild(node); }
      node.textContent = text;
      node.classList.add('on');
      clearTimeout(timer);
      timer = setTimeout(() => node && node.classList.remove('on'), 2600);
    };
  })();
  onCleanup(() => { const n = doc.getElementById('ps5-snack'); if (n) n.remove(); });

  const runAction = (app, state) => {
    const sc = SC();
    if (!sc || !app) return;
    const id = gameIdOf(app);
    try {
      if (state === 'stop') sc.Apps.TerminateApp(id, false);
      else if (state === 'cancel') sc.Apps.CancelLaunch(id);
      else if (state === 'install') steamURL('steam://install/' + app.appid);
      else { sc.Apps.RunGame(id, '', -1, 100); snack(T().launching(app.display_name)); }
    } catch (e) {
      console.warn('[PS5] action failed, falling back to steam://', e);
      steamURL(state === 'install' ? 'steam://install/' + app.appid : 'steam://rungameid/' + id);
    }
  };

  /* ───────────────────────── artwork ───────────────────────── */

  const CDN = id => `https://shared.steamstatic.com/store_item_assets/steam/apps/${id}`;
  const listFrom = (o, fn, app) => safe(() => { const v = o.appStore[fn](app); return Array.isArray(v) ? v : v ? [v] : []; }, []);
  const detailsArt = (o, fn, key, app) => safe(() => { const l = o.appDetailsStore[fn](app)[key]; return Array.isArray(l) ? l.filter(Boolean) : []; }, []);
  const uniq = l => [...new Set(l.filter(Boolean))];

  // Newer games keep library art in hashed folders listed in the app details; ask for them once.
  const detailsAsked = new Map();
  const ensureDetails = app => {
    const o = S();
    if (!o || !app) return Promise.resolve();
    let p = detailsAsked.get(app.appid);
    if (p) return p;
    let ask = null;
    try { if (!o.appDetailsStore.GetAppDetails(app.appid)) ask = o.appDetailsStore.RequestAppDetails(app.appid); } catch (e) { /* plain paths only */ }
    p = ask ? Promise.race([Promise.resolve(ask), new Promise(r => setTimeout(r, 1500))]).catch(() => {}) : Promise.resolve();
    detailsAsked.set(app.appid, p);
    if (detailsAsked.size > 400) detailsAsked.delete(detailsAsked.keys().next().value);
    return p;
  };

  const artFor = app => {
    const o = S();
    const id = app.appid;
    const custom = fn => (app.rt_custom_image_mtime ? listFrom(o, fn, app) : []);
    return {
      portrait: uniq([...custom('GetCustomVerticalCapsuleURLs'), ...listFrom(o, 'GetCachedVerticalCapsuleURL', app),
        ...listFrom(o, 'GetVerticalCapsuleURLForApp', app), `/assets/${id}/library_600x900.jpg`, `${CDN(id)}/library_600x900.jpg`]),
      landscape: uniq([...listFrom(o, 'GetCachedLandscapeImageURL', app), ...listFrom(o, 'GetLandscapeImageURLForApp', app),
        `/assets/${id}/header.jpg`, `${CDN(id)}/header.jpg`]),
      hero: uniq([...custom('GetCustomHeroImageURLs'), ...detailsArt(o, 'GetHeroImages', 'rgHeroImages', app),
        `/assets/${id}/library_hero.jpg`, `${CDN(id)}/library_hero.jpg`]),
      logo: uniq([...custom('GetCustomLogoImageURLs'), ...detailsArt(o, 'GetLogoImages', 'rgLogoImages', app),
        `/assets/${id}/logo.png`, `${CDN(id)}/logo.png`]),
      icon: uniq([safe(() => app.icon_data ? `data:image/${app.icon_data_format || 'jpeg'};base64,${app.icon_data}` : '', ''),
        safe(() => app.icon_hash ? `/assets/${id}/${app.icon_hash}.jpg` : '', ''),
        safe(() => app.icon_hash ? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${id}/${app.icon_hash}.jpg` : '', '')]),
    };
  };

  // point an <img> at the first candidate that decodes; `none` runs when none does
  const chain = (img, urls, none) => {
    let i = 0;
    const next = () => {
      if (i >= urls.length) { img.onerror = null; if (none) none(); return; }
      img.src = urls[i++];
    };
    img.onerror = next;
    next();
  };
  const loadFirst = urls => new Promise(resolve => {
    let i = 0;
    const next = () => {
      if (i >= urls.length) { resolve(null); return; }
      const src = urls[i++];
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve(src);
      im.onerror = next;
      im.src = src;
    };
    next();
  });

  /* ───────────────────────── store details (description, screenshots) ───────────────────────── */

  const storeCache = new Map();
  const storeInfo = appid => {
    if (!appid || appid >= SHORTCUT) return Promise.resolve(null);
    if (storeCache.has(appid)) return storeCache.get(appid);
    const p = fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,screenshots,genres,release_date,developers`)
      .then(r => r.json())
      .then(j => {
        const d = j && j[appid] && j[appid].success && j[appid].data;
        if (!d) return null;
        return {
          desc: decodeEntities(d.short_description || ''),
          shots: (d.screenshots || []).map(s => ({ thumb: s.path_thumbnail, full: s.path_full })).filter(s => /^https?:\/\//.test(s.thumb || '')).slice(0, 10),
          genres: (d.genres || []).map(g => g.description).slice(0, 3),
          release: d.release_date && d.release_date.date,
          developer: (d.developers || [])[0] || '',
        };
      })
      .catch(() => { storeCache.delete(appid); return null; });
    storeCache.set(appid, p);
    if (storeCache.size > 200) storeCache.delete(storeCache.keys().next().value);
    return p;
  };

  const achievementsOf = app => safe(() => {
    const e = S().appAchievementProgressCache.m_achievementProgress.mapCache.get(app.appid);
    return e && e.total > 0 ? e : null;
  }, null);


  /* ───────────────────────── icons (inline SVG, no external files) ───────────────────────── */

  const I = {
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.9-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
    cross: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M6.5 6.5l11 11m0-11l-11 11"/></svg>',
    install: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5.5 19.5h13"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><g fill="currentColor"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></g></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 11l8-6.5 8 6.5V20h-5.5v-5h-5v5H4z"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
    friends: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="3.4"/><path d="M3 19.5c.8-3.2 3.2-5 6-5s5.2 1.8 6 5" stroke-linecap="round"/><circle cx="17" cy="8" r="2.6"/><path d="M16.5 13.2c2.3.2 3.9 1.7 4.5 4.3" stroke-linecap="round"/></g></svg>',
    mic: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></g></svg>',
    music: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M9 17.5V6l10-2v11.5" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></g></svg>',
    download: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M12 3.5v11m-4.5-4.5L12 14.5 16.5 10M4.5 19.5h15"/></svg>',
    // Lucide "settings" (ISC licence): the cog people read as Settings at any size
    gear: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></g></svg>',
    back: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
    fwd: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
    reload: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5M12 3.5C9.6 5.9 8.5 8.7 8.5 12s1.1 6.1 3.5 8.5"/></g></svg>',
    bag: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 10V7a3 3 0 0 1 6 0v3" stroke-linecap="round"/></g></svg>',
    image: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/></g></svg>',
    link: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></g></svg>',
    trash: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/></g></svg>',
    controller2: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 3.6l1 5a2.6 2.6 0 0 1-4.6 2.1L15.5 15h-7l-1.8 2.7a2.6 2.6 0 0 1-4.6-2.1l1-5A4.5 4.5 0 0 1 7.5 7z" stroke-linejoin="round"/><path d="M12 3v4"/></g></svg>',
    power: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M12 3.5v8"/><path d="M7 6.3a7.5 7.5 0 1 0 10 0"/></g></svg>',
    user: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" stroke-linecap="round"/></g></svg>',
    trophy: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3.5M8.5 20.5h7M9.5 17.5h5v3h-5z"/></g></svg>',
    clock: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2" stroke-linecap="round"/></g></svg>',
    disk: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="6" width="17" height="12" rx="2.5"/><circle cx="16.5" cy="12" r="1.3" fill="currentColor"/></g></svg>',
    controller: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M7.5 7h9a4.5 4.5 0 0 1 4.4 3.6l1 5a2.6 2.6 0 0 1-4.6 2.1L15.5 15h-7l-1.8 2.7a2.6 2.6 0 0 1-4.6-2.1l1-5A4.5 4.5 0 0 1 7.5 7z"/><path d="M8 10v3M6.5 11.5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="15.5" cy="10.5" r="1" fill="currentColor"/><circle cx="17.5" cy="12.5" r="1" fill="currentColor"/></svg>',
    tv: '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7"/></g></svg>',
    swap: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 8h12l-3.5-3.5M19 16H7l3.5 3.5"/></svg>',
    restart: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.8A3.6 3.6 0 0 1 17.5 18.5zM4 4l16 16"/></svg>',
  };
  const icon = (name, cls) => `<span class="ps5-ico${cls ? ' ' + cls : ''}" aria-hidden="true">${I[name] || ''}</span>`;

  /* ───────────────────────── web pages: the native web view ─────────────────────────
     Store, Community, Profile, Wishlist… are drawn by a native browser view (CEF) laid OVER
     the main window's page, so nothing in this document can be painted above it: that is why
     a panel opened on a web page ended up under the page or cut off. Millennium solves the
     same problem for its own panels by hiding that view (MainWindowBrowserManager.m_browser
     .SetVisible(false)) while they are open; the theme does the same, and shows it again
     when the last panel closes. */
  const WebView = (() => {
    let holders = 0, hidden = false;
    const browser = () => safe(() => S().MainWindowBrowserManager.m_browser, null);
    const onWebPage = () => {
      const lc = doc.querySelector('.LocalContentContainer');
      const web = doc.querySelector('.BrowserWrapper');
      if (web && web.offsetParent !== null && (!lc || lc.style.display === 'none' || lc.offsetParent === null)) return true;
      return /^\/browser/.test(currentPath());
    };
    const setVisible = v => { const b = browser(); try { if (b && typeof b.SetVisible === 'function') b.SetVisible(v); } catch (e) { /* nothing to hide */ } };
    const hold = () => {
      holders++;
      if (!hidden && onWebPage()) { hidden = true; setVisible(false); root.classList.add('ps5-web-hidden'); }
    };
    const release = () => {
      holders = Math.max(0, holders - 1);
      if (holders || !hidden) return;
      hidden = false;
      root.classList.remove('ps5-web-hidden');
      if (onWebPage()) setVisible(true);
    };
    // Steam re-shows the view on resizes and page loads; while a panel is open it stays hidden
    const enforce = () => { if (hidden && holders) setVisible(false); };
    onCleanup(() => { if (hidden) { hidden = false; root.classList.remove('ps5-web-hidden'); setVisible(true); } });
    return { hold, release, enforce, onWebPage };
  })();

  /* ───────────────────────── downloads: one listener for the bottom bar and Control Center ───────────────────────── */

  const Downloads = (() => {
    let overview = null, un = null;
    const subs = new Set();
    const active = () => !!(overview && overview.update_appid && overview.update_state && overview.update_state !== 'None' && !overview.paused);
    const start = () => {
      if (un) return;
      try {
        const reg = SC().Downloads.RegisterForDownloadOverview(ov => {
          overview = ov;
          root.classList.toggle('ps5-downloading', active());
          subs.forEach(fn => { try { fn(ov); } catch (e) { /* a listener failed */ } });
        });
        un = () => { try { if (reg && reg.unregister) reg.unregister(); } catch (e) { /* gone */ } };
      } catch (e) { un = null; }
    };
    onCleanup(() => { if (un) un(); un = null; subs.clear(); root.classList.remove('ps5-downloading'); });
    return { start, get overview() { return overview; }, on: fn => { subs.add(fn); return () => subs.delete(fn); } };
  })();

  /* ───────────────────────── background art layer ───────────────────────── */

  const Bg = (() => {
    let node = null, layers = [], front = 0, key = '';
    const mount = () => {
      if (node && node.isConnected) return;
      node = doc.getElementById('ps5-bg') || h('div', '', '<div class="ps5-bg-waves"></div><div class="ps5-bg-layer"></div><div class="ps5-bg-layer"></div><div class="ps5-bg-shade"></div>');
      node.id = 'ps5-bg';
      node.setAttribute('aria-hidden', 'true');
      if (node.parentElement !== doc.body) doc.body.insertBefore(node, doc.body.firstChild);
      layers = [...node.querySelectorAll('.ps5-bg-layer')];
    };
    const show = src => {
      mount();
      const next = layers[1 - front];
      next.style.backgroundImage = `url("${String(src).replace(/"/g, '%22')}")`;
      next.classList.add('on');
      layers[front].classList.remove('on');
      front = 1 - front;
      node.classList.add('has-art');
    };
    const clear = () => {
      mount();
      key = '';
      layers.forEach(l => l.classList.remove('on'));
      node.classList.remove('has-art');
    };
    // urls: candidates, first that loads wins; k: identity so stale loads are dropped
    const set = (k, urls) => {
      mount();
      if (k === key) return;
      key = k;
      if (!urls || !urls.length) { clear(); return; }
      loadFirst(urls).then(src => { if (key !== k) return; if (src) show(src); else clear(); });
    };
    onCleanup(() => { if (node) node.remove(); node = null; });
    return { mount, set, clear, get key() { return key; } };
  })();

  /* ───────────────────────── boot animation ───────────────────────── */

  const boot = () => {
    if (cssVar('--ps5-boot') === 'off' || doc.getElementById('ps5-boot')) return;
    if (safe(() => sessionStorage.getItem('ps5-booted'), null)) return;
    safe(() => sessionStorage.setItem('ps5-booted', '1'));
    const n = h('div', '', '<div class="ps5-boot-glow"></div><div class="ps5-boot-mark"><i></i><i></i><i></i><i></i></div>');
    n.id = 'ps5-boot';
    n.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(n);
    const done = () => n.remove();
    n.addEventListener('animationend', e => { if (e.target === n) done(); });
    setTimeout(done, 3000);   // in case animations are disabled
  };

  /* ───────────────────────── address panel (top-left) ─────────────────────────
     A compact capsule: back · forward · reload (web pages) · where you are.
     Back / forward press Steam's own arrows (.SuperNav svg.Arrow), reload presses the
     web strip's own reload button, so Steam's navigation history stays the only one.
     On a web page the address shows as host › path (a click copies the full URL);
     in the library it names the section ("Library · Home", "Library · <game>"). */
  const Address = (() => {
    let node = null, lastSig = '';
    const steamArrows = () => [...doc.querySelectorAll('.SuperNav svg.Arrow, .SuperNavBar svg.Arrow')];
    const press = n => {
      if (!n) return false;
      try { n.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return true; } catch (e) { return false; }
    };
    const webURL = () => safe(() => S().MainWindowBrowserManager.m_URL, '') || ((doc.querySelector('.BrowserWrapper .URLBar .URL') || {}).textContent || '');
    const sectionLabel = path => {
      const t = T();
      const ru = lang() === 'ru';
      let m;
      if ((m = /^\/library\/app\/(\d+)/.exec(path))) {
        const app = appById(m[1]);
        return [ru ? 'Библиотека' : 'Library', app ? app.display_name : '#' + m[1]];
      }
      if (/^\/library\/home/.test(path) || path === '/library' || path === '/library/') return [ru ? 'Библиотека' : 'Library', ru ? 'Главная' : 'Home'];
      if (/downloads/.test(path)) return [t.downloads, ''];
      if (/^\/library\/collection/.test(path)) return [ru ? 'Библиотека' : 'Library', ru ? 'Коллекции' : 'Collections'];
      if (/^\/library/.test(path)) return [ru ? 'Библиотека' : 'Library', ''];
      if (/^\/(settings|millennium)/i.test(path)) return [t.settings, ''];
      const seg = (path.split('/').filter(Boolean)[0] || 'Steam');
      return [seg.charAt(0).toUpperCase() + seg.slice(1), ''];
    };
    const build = () => {
      node = h('div', '', `
        <button class="ps5-addr-btn ps5-addr-back" type="button">${I.back}</button>
        <button class="ps5-addr-btn ps5-addr-fwd" type="button">${I.fwd}</button>
        <button class="ps5-addr-btn ps5-addr-reload" type="button" hidden>${I.reload}</button>
        <span class="ps5-addr-sep" aria-hidden="true"></span>
        <button class="ps5-addr-where" type="button" tabindex="-1"><span class="ps5-addr-ico"></span><span class="ps5-addr-text"></span></button>`);
      node.id = 'ps5-addr';
      node.setAttribute('role', 'navigation');
      node.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        const [backA, fwdA] = steamArrows();
        if (b.classList.contains('ps5-addr-back')) {
          if (!press(backA)) safe(() => S().SteamUIStore.WindowStore.MainWindowInstance.m_history.goBack());
        } else if (b.classList.contains('ps5-addr-fwd')) {
          if (!press(fwdA)) safe(() => S().SteamUIStore.WindowStore.MainWindowInstance.m_history.goForward());
        } else if (b.classList.contains('ps5-addr-reload')) {
          const btn = doc.querySelector('.BrowserWrapper .URLBar .ReloadButton, .BrowserWrapper .URLBar [class*="Reload"]');
          if (btn) btn.click();
          else safe(() => S().MainWindowBrowserManager.m_browser.Reload());
          node.classList.add('loading');
          setTimeout(() => node && node.classList.remove('loading'), 1200);
        } else if (b.classList.contains('ps5-addr-where') && b.classList.contains('copyable')) {
          const url = webURL();
          if (url && navigator.clipboard) navigator.clipboard.writeText(url).then(() => snack(lang() === 'ru' ? 'Адрес скопирован' : 'Address copied'), () => {});
        }
      });
    };
    const update = () => {
      const bar = doc.querySelector('.SuperNavBar');
      if (!bar) { if (node) node.remove(); root.classList.remove('ps5-addr-on'); return; }
      if (!node) build();
      if (node.parentElement !== bar || bar.firstElementChild !== node) bar.insertBefore(node, bar.firstElementChild);
      root.classList.add('ps5-addr-on');
      const [backA, fwdA] = steamArrows();
      const en = a => !a || !a.classList.contains('Disabled');
      node.querySelector('.ps5-addr-back').disabled = !en(backA);
      node.querySelector('.ps5-addr-fwd').disabled = !en(fwdA);
      const web = WebView.onWebPage();
      const where = node.querySelector('.ps5-addr-where');
      let html, title;
      if (web) {
        const url = webURL();
        let host = '', rest = '';
        try { const u = new URL(url); host = u.hostname.replace(/^www\./, ''); rest = (u.pathname + u.search).replace(/\/$/, ''); } catch (e) { host = url; }
        html = `<b>${esc(host)}</b>${rest ? `<i> › ${esc(rest.replace(/^\//, ''))}</i>` : ''}`;
        title = url;
      } else {
        const [a, b] = sectionLabel(currentPath());
        html = `<b>${esc(a)}</b>${b ? `<i> · ${esc(b)}</i>` : ''}`;
        title = b ? `${a} · ${b}` : a;
      }
      const t = T();
      const sig = html + web + lang();
      if (sig !== lastSig) {
        lastSig = sig;
        node.querySelector('.ps5-addr-text').innerHTML = html;
        node.querySelector('.ps5-addr-ico').innerHTML = web ? I.globe : I.home;
        where.title = web ? `${title}\n${lang() === 'ru' ? 'Нажмите, чтобы скопировать' : 'Click to copy'}` : title;
        where.classList.toggle('copyable', web);
        node.querySelector('.ps5-addr-reload').hidden = !web;
        const lbl = { back: lang() === 'ru' ? 'Назад' : 'Back', fwd: lang() === 'ru' ? 'Вперёд' : 'Forward', reload: lang() === 'ru' ? 'Обновить' : 'Reload' };
        for (const [cls, l] of [['back', lbl.back], ['fwd', lbl.fwd], ['reload', lbl.reload]]) {
          const b = node.querySelector('.ps5-addr-' + cls); b.title = l; b.setAttribute('aria-label', l);
        }
        void t;
      }
    };
    onCleanup(() => { if (node) node.remove(); node = null; root.classList.remove('ps5-addr-on'); });
    return { update };
  })();

  /* ───────────────────────── top bar: library / control center / avatar / clock ───────────────────────── */

  const Topbar = (() => {
    let node = null;
    const selfPersona = () => {
      const fa = friendsApp();
      const self = safe(() => fa.FriendStore.self, null);
      if (!self) return null;
      return {
        name: safe(() => self.display_name, '') || safe(() => self.persona.m_strPlayerName, '') || '',
        avatar: safe(() => self.persona.avatar_url_medium || self.persona.avatar_url_full || self.persona.avatar_url, '') || '',
        state: safe(() => self.persona.m_ePersonaState, 1),
        level: safe(() => self.persona.m_nPlayerLevel || self.persona.player_level, 0) || 0,
      };
    };
    const mount = () => {
      const bar = doc.querySelector('.SuperNavBar');
      if (!node) {
        node = h('div', '', `
          <button class="ps5-top-btn" data-act="library" title="">${icon('grid')}</button>
          <button class="ps5-top-btn" data-act="search" title="">${icon('search')}</button>
          <button class="ps5-top-btn" data-act="cc" title="">${icon('controller')}</button>
          <button class="ps5-top-avatar" data-act="profile" title=""><img alt=""><span class="ps5-dot"></span></button>
          <span id="ps5-clock"></span>`);
        node.id = 'ps5-top';
        node.addEventListener('click', e => {
          const b = e.target.closest('[data-act]');
          if (!b) return;
          const act = b.dataset.act;
          if (act === 'library') Library.toggle();
          else if (act === 'search') Library.open({ focusSearch: true });
          else if (act === 'cc') CC.toggle();
          else if (act === 'profile') CC.open('profile');
        });
      }
      const host = bar || doc.body;
      node.classList.toggle('floating', !bar);
      if (node.parentElement !== host) host.appendChild(node);
      const t = T();
      const titles = { library: t.library, search: t.search, cc: t.controlCenter, profile: t.profile };
      node.querySelectorAll('[data-act]').forEach(b => { const s = titles[b.dataset.act]; if (b.title !== s) { b.title = s; b.setAttribute('aria-label', s); } });
      paintAvatar();
      paintClock();
    };
    let avatarSrc = '';
    const paintAvatar = () => {
      if (!node) return;
      const me = selfPersona();
      const img = node.querySelector('.ps5-top-avatar img');
      const src = (me && me.avatar) || '';
      if (src && src !== avatarSrc) { avatarSrc = src; img.src = src; }
      node.querySelector('.ps5-top-avatar').dataset.state = me ? String(me.state) : '';
    };
    const paintClock = () => {
      const c = node && node.querySelector('#ps5-clock');
      if (!c) return;
      const mode = cssVar('--ps5-clock');
      if (mode === 'off') return;
      const d = new Date();
      let text;
      if (mode === '12') {
        const hr = d.getHours() % 12 || 12;
        text = `${hr}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
      } else text = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      if (c.textContent !== text) c.textContent = text;
    };
    onCleanup(() => { if (node) node.remove(); node = null; });
    return { mount, paintClock, paintAvatar, selfPersona };
  })();

  /* ───────────────────────── PS5 Home Screen ───────────────────────── */

  const Home = (() => {
    let node = null, games = [], sel = 0, sig = '', checked = 0, infoFor = -1, hero = null;

    const pickGames = () => {
      const o = S();
      const whole = cssVar('--ps5-home-games') === 'all';
      const list = allGames().filter(a => (whole || isInstalled(a)) && !isHidden(o, a.appid));
      const played = list.filter(a => a.rt_last_time_played).sort((a, b) => b.rt_last_time_played - a.rt_last_time_played);
      // nothing played yet: show installed games by name so the row is never empty
      const rest = played.length < 12
        ? list.filter(a => !a.rt_last_time_played).sort((a, b) => String(a.sort_as || a.display_name).localeCompare(String(b.sort_as || b.display_name))).slice(0, 12 - played.length)
        : [];
      return [...played, ...rest].slice(0, 12);
    };

    const build = () => {
      node = h('section', '', `
        <div class="ps5-home-rail" role="listbox" aria-orientation="horizontal"></div>
        <div class="ps5-home-info">
          <div class="ps5-home-title"><img class="ps5-home-logo" alt=""><h1 class="ps5-home-name"></h1></div>
          <div class="ps5-home-sub"></div>
          <div class="ps5-home-actions">
            <button class="ps5-btn-play" data-act="play"></button>
            <button class="ps5-btn-round" data-act="details" title="" aria-haspopup="menu" aria-expanded="false">${icon('dots')}</button>
          </div>
          <p class="ps5-home-desc"></p>
          <div class="ps5-cards ps5-home-cards"></div>
        </div>
        <div class="ps5-home-hint"></div>`);
      node.id = 'ps5-home';
      node.tabIndex = -1;
      node.addEventListener('click', e => {
        const tile = e.target.closest('.ps5-tile');
        if (tile) {
          if (tile.dataset.kind === 'library') { Library.open(); return; }
          const i = Number(tile.dataset.i);
          if (i === sel && e.detail >= 2) { navigate('/library/app/' + games[i].appid); return; }
          select(i);
          return;
        }
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const app = games[sel];
        if (!app) return;
        if (b.dataset.act === 'play') runAction(appById(app.appid) || app, b.dataset.state || 'play');
        else if (b.dataset.act === 'details') GameMenu.open(appById(app.appid) || app, b);
      });
      node.addEventListener('dblclick', e => {
        const tile = e.target.closest('.ps5-tile:not([data-kind])');
        if (tile && games[Number(tile.dataset.i)]) navigate('/library/app/' + games[Number(tile.dataset.i)].appid);
      });
    };

    const renderRail = () => {
      const rail = node.querySelector('.ps5-home-rail');
      rail.innerHTML = games.map((a, i) =>
        `<button class="ps5-tile" role="option" data-i="${i}" title="${esc(a.display_name)}" aria-label="${esc(a.display_name)}"><img alt="" decoding="async"><span class="ps5-tile-name">${esc(a.display_name)}</span></button>`).join('') +
        `<button class="ps5-tile ps5-tile-library" data-kind="library" title="${esc(T().library)}" aria-label="${esc(T().library)}">${icon('grid')}<span class="ps5-tile-name">${esc(T().library)}</span></button>`;
      rail.querySelectorAll('.ps5-tile:not([data-kind]) img').forEach((img, i) => {
        const a = games[i];
        const art = artFor(a);
        // square-ish tiles: the landscape capsule cropped, like PS5 game icons
        chain(img, [...art.landscape, ...art.portrait], () => { img.remove(); });
      });
    };

    const paintPlay = () => {
      if (!node) return;
      const b = node.querySelector('.ps5-btn-play');
      const a = games[sel] && (appById(games[sel].appid) || games[sel]);
      if (!a) return;
      const state = playState(a);
      if (b.dataset.state === state && b.dataset.lang === lang()) return;
      b.dataset.state = state;
      b.dataset.lang = lang();
      const ico = state === 'stop' ? 'stop' : state === 'cancel' ? 'cross' : state === 'install' ? 'install' : 'play';
      b.innerHTML = `${icon(ico)}<span>${esc(T()[state])}</span>`;
    };

    const renderInfo = () => {
      const a = games[sel] && (appById(games[sel].appid) || games[sel]);
      if (!a) return;
      infoFor = a.appid;
      const t = T();
      const logo = node.querySelector('.ps5-home-logo');
      const name = node.querySelector('.ps5-home-name');
      name.textContent = a.display_name;
      node.classList.remove('has-logo');
      logo.removeAttribute('src');
      node.querySelector('[data-act="details"]').title = t.more;
      const appid = a.appid;
      ensureDetails(a).then(() => {
        if (infoFor !== appid) return;
        const art = artFor(a);
        logo.onload = () => { if (infoFor === appid) node.classList.add('has-logo'); };
        chain(logo, art.logo, () => node.classList.remove('has-logo'));
        hero = { key: 'home:' + appid, urls: art.hero };
        if (!Library.isOpen()) Bg.set(hero.key, hero.urls);
      });

      const sub = [];
      if (a.rt_last_time_played) sub.push(`${t.lastPlayed}: ${fmtAgo(a.rt_last_time_played)}`);
      if (a.minutes_playtime_forever > 0) sub.push(fmtPlaytime(a.minutes_playtime_forever));
      node.querySelector('.ps5-home-sub').textContent = sub.join(' · ');

      const ach = achievementsOf(a);
      const cards = [
        { ico: 'clock', label: t.lastPlayed, value: fmtAgo(a.rt_last_time_played) },
        { ico: 'controller', label: t.playtime, value: a.minutes_playtime_forever > 0 ? fmtPlaytime(a.minutes_playtime_forever) : '—',
          note: a.minutes_playtime_last_two_weeks > 0 ? `${fmtPlaytime(a.minutes_playtime_last_two_weeks)} ${t.twoWeeks}` : '' },
        ach ? { ico: 'trophy', label: t.achievements, value: `${ach.unlocked}/${ach.total}`, bar: Math.round(ach.unlocked / ach.total * 100) } : null,
        { ico: 'disk', label: t.storage, value: isInstalled(a) ? fmtBytes(sizeOnDisk(a)) : t.notInstalled, note: isInstalled(a) ? t.installed : '' },
      ].filter(Boolean);
      node.querySelector('.ps5-home-cards').innerHTML = cards.map(c => `
        <div class="ps5-card">
          ${icon(c.ico)}
          <div class="ps5-card-label">${esc(c.label)}</div>
          <div class="ps5-card-value">${esc(c.value)}</div>
          ${c.bar != null ? `<div class="ps5-bar"><i style="width:${c.bar}%"></i></div>` : ''}
          ${c.note ? `<div class="ps5-card-note">${esc(c.note)}</div>` : ''}
        </div>`).join('');

      const desc = node.querySelector('.ps5-home-desc');
      desc.textContent = '';
      desc.classList.remove('on');
      storeInfo(a.appid).then(info => {
        if (infoFor !== appid || !info || !info.desc) return;
        desc.textContent = info.desc;
        desc.classList.add('on');
      });
      paintPlay();
    };

    const select = i => {
      if (!games.length) return;
      sel = Math.max(0, Math.min(games.length - 1, i));
      node.querySelectorAll('.ps5-tile').forEach((t, k) => {
        const on = k === sel && !t.dataset.kind;
        t.classList.toggle('selected', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const tile = node.querySelector('.ps5-tile.selected');
      if (tile) tile.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: cssVar('--ps5-motion') === 'reduced' ? 'auto' : 'smooth' });
      node.classList.remove('swap');
      void node.offsetWidth;   // restart the info fade
      node.classList.add('swap');
      renderInfo();
    };

    const unmount = () => {
      if (node && node.isConnected) node.remove();
      root.classList.remove('ps5-home-mounted');
      GameMenu.close();
    };

    const update = () => {
      const host = doc.querySelector('.LibraryHome');
      if (!host || cssVar('--ps5-home') === 'off' || !S()) { unmount(); return false; }
      if (!node) build();
      // The home is the first thing in the scroller, above Steam's What's New shelf and
      // shelves (both live in .Body.InnerContainer). v1.1.0 sat right before .LibraryHome,
      // i.e. UNDER What's New, which then opened the page.
      const anchor = host.closest('.Body.InnerContainer') || host.parentElement;
      if (node.parentElement !== anchor || anchor.firstElementChild !== node) anchor.insertBefore(node, anchor.firstElementChild);
      root.classList.add('ps5-home-mounted');
      const now = Date.now();
      if (now - checked > 3000 || !games.length) {
        checked = now;
        const picked = pickGames();
        const s = picked.map(a => `${a.appid}:${a.rt_custom_image_mtime || 0}`).join('|') + '|' + lang();
        if (s !== sig) {
          const keep = games[sel] && games[sel].appid;
          sig = s;
          games = picked;
          renderRail();
          const k = games.findIndex(a => a.appid === keep);
          node.querySelector('.ps5-home-hint').textContent = T().keysHint;
          select(k >= 0 ? k : 0);
          return true;
        }
      }
      // same key as before → no reload; after the Library or a game page it comes back
      if (hero && !Library.isOpen()) Bg.set(hero.key, hero.urls);
      paintPlay();
      return true;
    };

    const key = e => {
      if (!node || !node.isConnected || inTextField() || CC.isOpen() || Library.isOpen()) return false;
      if (e.key === 'ArrowRight') { select(sel + 1); return true; }
      if (e.key === 'ArrowLeft') { select(sel - 1); return true; }
      if (e.key === 'Enter' && games[sel] && (doc.activeElement === doc.body || node.contains(doc.activeElement))) {
        runAction(appById(games[sel].appid) || games[sel], playState(appById(games[sel].appid) || games[sel]));
        return true;
      }
      return false;
    };

    onCleanup(unmount);
    return { update, unmount, key, get mounted() { return !!(node && node.isConnected); }, get selected() { return games[sel]; } };
  })();

  /* ───────────────────────── PS5 Game Library ───────────────────────── */

  const Library = (() => {
    let node = null, open = false, tab = 'installed', sort = 'recent', query = '', showShortcuts = true, showHidden = false;
    let list = [], shown = 0, io = null;
    const PAGE = 60;
    try {
      const saved = JSON.parse(localStorage.getItem('ps5-library') || '{}');
      if (saved.tab) tab = saved.tab;
      if (saved.sort) sort = saved.sort;
      if (typeof saved.showShortcuts === 'boolean') showShortcuts = saved.showShortcuts;
    } catch (e) { /* defaults */ }
    const save = () => { try { localStorage.setItem('ps5-library', JSON.stringify({ tab, sort, showShortcuts })); } catch (e) { /* not kept */ } };

    const build = () => {
      node = h('div', '', `
        <div class="ps5-lib-head">
          <h2 class="ps5-lib-title"></h2>
          <div class="ps5-lib-tabs" role="tablist">
            <button data-tab="installed" role="tab"></button>
            <button data-tab="all" role="tab"></button>
            <button data-tab="recent" role="tab"></button>
          </div>
          <button class="ps5-btn-round ps5-lib-close" data-act="close">${icon('cross')}</button>
        </div>
        <div class="ps5-lib-tools">
          <label class="ps5-lib-search">${icon('search')}<input type="text" spellcheck="false" autocomplete="off"></label>
          <select class="ps5-lib-sort">
            <option value="recent"></option><option value="name"></option><option value="playtime"></option><option value="size"></option>
          </select>
          <button class="ps5-chip" data-filter="shortcuts"></button>
          <button class="ps5-chip" data-filter="hidden"></button>
          <span class="ps5-lib-count"></span>
        </div>
        <div class="ps5-lib-scroll"><div class="ps5-lib-grid" role="list"></div><div class="ps5-lib-more"></div></div>`);
      node.id = 'ps5-library';
      node.setAttribute('role', 'dialog');
      node.addEventListener('click', e => {
        const tb = e.target.closest('[data-tab]');
        if (tb) { tab = tb.dataset.tab; if (tab === 'recent') sort = 'recent'; save(); refresh(); return; }
        const f = e.target.closest('[data-filter]');
        if (f) {
          if (f.dataset.filter === 'shortcuts') showShortcuts = !showShortcuts;
          else showHidden = !showHidden;
          save(); refresh(); return;
        }
        if (e.target.closest('[data-act="close"]')) { close(); return; }
        const play = e.target.closest('.ps5-gcard-play');
        if (play) {
          const app = appById(play.dataset.app);
          if (app) runAction(app, playState(app));
          return;
        }
        const card = e.target.closest('.ps5-gcard');
        if (card) { close(); navigate('/library/app/' + card.dataset.app); }
      });
      const input = node.querySelector('.ps5-lib-search input');
      let qt = 0;
      input.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { query = input.value.trim().toLowerCase(); refresh(); }, 120); });
      node.querySelector('.ps5-lib-sort').addEventListener('change', e => { sort = e.target.value; save(); refresh(); });
      doc.body.appendChild(node);
      io = new IntersectionObserver(entries => { if (entries.some(en => en.isIntersecting)) renderMore(); }, { root: node.querySelector('.ps5-lib-scroll'), rootMargin: '600px' });
      io.observe(node.querySelector('.ps5-lib-more'));
    };

    const labels = () => {
      const t = T();
      node.querySelector('.ps5-lib-title').textContent = t.library;
      const tabs = { installed: t.tabInstalled, all: t.tabAll, recent: t.tabRecent };
      node.querySelectorAll('[data-tab]').forEach(b => {
        b.textContent = tabs[b.dataset.tab];
        b.classList.toggle('on', b.dataset.tab === tab);
        b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
      });
      const sorts = { recent: t.sortRecent, name: t.sortName, playtime: t.sortPlaytime, size: t.sortSize };
      node.querySelectorAll('.ps5-lib-sort option').forEach(o => { o.textContent = sorts[o.value]; });
      node.querySelector('.ps5-lib-sort').value = sort;
      node.querySelector('.ps5-lib-search input').placeholder = t.search;
      const fs = node.querySelector('[data-filter="shortcuts"]');
      fs.textContent = t.filterShortcuts; fs.classList.toggle('on', showShortcuts);
      const fh = node.querySelector('[data-filter="hidden"]');
      fh.textContent = t.filterHidden; fh.classList.toggle('on', showHidden);
      node.querySelector('[data-act="close"]').title = 'Esc';
    };

    const compute = () => {
      const o = S();
      let l = allGames().filter(a => {
        const hidden = isHidden(o, a.appid);
        if (showHidden ? !hidden : hidden) return false;
        if (!showShortcuts && a.app_type === SHORTCUT) return false;
        if (tab === 'installed' && !isInstalled(a)) return false;
        if (tab === 'recent' && !a.rt_last_time_played) return false;
        if (query && !String(a.display_name || '').toLowerCase().includes(query)) return false;
        return true;
      });
      const by = {
        recent: (a, b) => (b.rt_last_time_played || 0) - (a.rt_last_time_played || 0) || String(a.sort_as || a.display_name).localeCompare(String(b.sort_as || b.display_name)),
        name: (a, b) => String(a.sort_as || a.display_name).localeCompare(String(b.sort_as || b.display_name)),
        playtime: (a, b) => (b.minutes_playtime_forever || 0) - (a.minutes_playtime_forever || 0),
        size: (a, b) => sizeOnDisk(b) - sizeOnDisk(a),
      }[sort] || (() => 0);
      l = l.slice().sort(by);
      if (tab === 'recent') l = l.slice(0, 60);
      return l;
    };

    const cardHTML = a => {
      const inst = isInstalled(a);
      const meta = sort === 'size' && inst ? fmtBytes(sizeOnDisk(a))
        : sort === 'playtime' ? (a.minutes_playtime_forever > 0 ? fmtPlaytime(a.minutes_playtime_forever) : '—')
        : a.rt_last_time_played ? fmtAgo(a.rt_last_time_played) : (inst ? T().installed : T().notInstalled);
      return `<div class="ps5-gcard${inst ? ' installed' : ''}" role="listitem" data-app="${a.appid}" tabindex="0" title="${esc(a.display_name)}">
        <div class="ps5-gcard-art"><img alt="" loading="lazy" decoding="async"><span class="ps5-gcard-fallback">${esc(a.display_name)}</span></div>
        <div class="ps5-gcard-name">${esc(a.display_name)}</div>
        <div class="ps5-gcard-meta">${esc(meta)}</div>
        <button class="ps5-gcard-play" data-app="${a.appid}" title="${esc(T()[playState(a)])}">${icon(inst ? 'play' : 'install')}</button>
      </div>`;
    };

    const renderMore = () => {
      if (!open || shown >= list.length) return;
      const grid = node.querySelector('.ps5-lib-grid');
      const slice = list.slice(shown, shown + PAGE);
      const frag = doc.createElement('template');
      frag.innerHTML = slice.map(cardHTML).join('');
      const cards = [...frag.content.querySelectorAll('.ps5-gcard')];
      grid.appendChild(frag.content);
      cards.forEach((c, i) => {
        const img = c.querySelector('img');
        img.onload = () => c.classList.add('loaded');
        chain(img, artFor(slice[i]).portrait, () => { img.remove(); c.classList.add('noart'); });
      });
      shown += slice.length;
    };

    const refresh = () => {
      if (!node) return;
      labels();
      list = compute();
      shown = 0;
      node.querySelector('.ps5-lib-grid').innerHTML = list.length ? '' : `<div class="ps5-lib-empty">${esc(T().empty)}</div>`;
      node.querySelector('.ps5-lib-count').textContent = T().games(list.length);
      node.querySelector('.ps5-lib-scroll').scrollTop = 0;
      renderMore();
    };

    const placeBelowTitleBar = () => {
      const tb = doc.querySelector('.TitleBar');
      const top = tb ? Math.round(tb.getBoundingClientRect().bottom) : 32;
      root.style.setProperty('--ps5-top', Math.max(0, top) + 'px');
    };

    const openFn = (opts = {}) => {
      if (!S()) return;
      CC.close();
      if (!node) build();
      placeBelowTitleBar();
      if (!open) WebView.hold();
      open = true;
      node.classList.add('open');
      root.classList.add('ps5-library-open');
      refresh();
      Bg.clear();
      const input = node.querySelector('.ps5-lib-search input');
      if (opts.focusSearch) setTimeout(() => input.focus(), 60);
      else node.focus && node.focus();
    };
    const close = () => {
      if (!open) return;
      open = false;
      node.classList.remove('open');
      root.classList.remove('ps5-library-open');
      WebView.release();
      // drop the rendered cards so the images are released
      setTimeout(() => { if (!open && node) node.querySelector('.ps5-lib-grid').innerHTML = ''; }, 400);
      Shell.soon();
    };
    onCleanup(() => { if (io) io.disconnect(); if (open) WebView.release(); if (node) node.remove(); root.classList.remove('ps5-library-open'); });
    return { open: openFn, close, toggle: () => (open ? close() : openFn()), isOpen: () => open };
  })();

  /* ───────────────────────── Control Center ───────────────────────── */

  const CC = (() => {
    let node = null, open = false, section = 'profile', unDownloads = null, overview = null, confirmAct = '', confirmTimer = 0;
    const SECTIONS = ['home', 'profile', 'friends', 'notifications', 'voice', 'music', 'downloads', 'settings', 'power'];
    const ICONS = { home: 'home', profile: 'user', friends: 'friends', notifications: 'bell', voice: 'mic', music: 'music', downloads: 'download', settings: 'gear', power: 'power' };

    const build = () => {
      node = h('div', '', `
        <div class="ps5-cc-backdrop" data-act="close"></div>
        <div class="ps5-cc-panel">
          <div class="ps5-cc-card"></div>
          <div class="ps5-cc-row" role="toolbar"></div>
        </div>`);
      node.id = 'ps5-cc';
      node.setAttribute('role', 'dialog');
      node.addEventListener('click', onClick);
      doc.body.appendChild(node);
    };

    const row = () => {
      const t = T();
      const names = { home: 'Home', profile: t.profile, friends: t.friends, notifications: t.notifications, voice: t.voice, music: t.music, downloads: t.downloads, settings: t.settings, power: t.power };
      if (lang() === 'ru') names.home = 'Главная';
      node.querySelector('.ps5-cc-row').innerHTML = SECTIONS.map(s =>
        `<button class="ps5-cc-icon${s === section ? ' on' : ''}" data-sec="${s}" title="${esc(names[s])}" aria-label="${esc(names[s])}">${icon(ICONS[s])}<span>${esc(names[s])}</span></button>`).join('');
    };

    const btn = (act, label, ico, extra = '') => `<button class="ps5-cc-btn ${extra}" data-act="${act}">${ico ? icon(ico) : ''}<span>${esc(label)}</span></button>`;

    const friendsData = () => {
      const fa = friendsApp();
      const all = safe(() => fa.FriendStore.all_friends, []) || [];
      const out = [];
      for (const f of all) {
        const p = f && f.persona;
        if (!p) continue;
        const state = Number(p.m_ePersonaState) || 0;
        const gameId = safe(() => p.m_unGamePlayedAppID || (p.m_gameid && Number(p.m_gameid)), 0) || 0;
        const game = safe(() => p.m_strGameExtraInfo, '') || (gameId ? safe(() => appById(gameId).display_name, '') : '');
        if (state === 0 && !game) continue;
        out.push({
          name: safe(() => f.display_name, '') || p.m_strPlayerName || '',
          avatar: p.avatar_url_medium || p.avatar_url || '',
          state, game,
          id: safe(() => p.m_steamid.ConvertTo64BitString(), '') || safe(() => f.steamid64, '') || '',
        });
      }
      out.sort((a, b) => (b.game ? 1 : 0) - (a.game ? 1 : 0) || a.name.localeCompare(b.name));
      return out;
    };

    // the balance Steam shows in its account button (.AccountMenu .WalletBalance), still in the DOM when hidden
    const wallet = () => ((doc.querySelector('.TitleBarControls .AccountMenu .WalletBalance, .AccountMenu .WalletBalance') || {}).textContent || '').trim();

    const STATE_NAME = s => { const t = T(); return [t.offline, t.online, t.busy, t.away, t.away, t.online, t.online, t.invisible][s] || t.online; };

    const card = () => {
      const t = T();
      const c = node.querySelector('.ps5-cc-card');
      let html = '';
      if (section === 'home') {
        const g = Home.selected || allGames().filter(a => a.rt_last_time_played).sort((a, b) => b.rt_last_time_played - a.rt_last_time_played)[0];
        html = `<h3>Home</h3><div class="ps5-cc-actions">
          ${btn('nav-home', lang() === 'ru' ? 'Главный экран' : 'Home Screen', 'home')}
          ${btn('library', t.library, 'grid')}
          ${g ? btn('play-last', `${t.play}: ${g.display_name}`, 'play', 'primary') : ''}
        </div>`;
        if (g) c.dataset.app = g.appid;
      } else if (section === 'profile') {
        const me = Topbar.selfPersona();
        html = `<div class="ps5-cc-profile">
            <div class="ps5-cc-avatar">${me && me.avatar ? `<img src="${esc(me.avatar)}" alt="">` : icon('user')}<span class="ps5-dot" data-state="${me ? me.state : ''}"></span></div>
            <div><h3>${esc(me ? me.name : t.profile)}</h3><div class="ps5-cc-sub">${esc(me ? STATE_NAME(me.state) : '')}${me && me.level ? ` · Lv ${me.level}` : ''}</div></div>
          </div>
          <div class="ps5-cc-actions">
            ${btn('status-online', t.online, '', 'status s1')}${btn('status-away', t.away, '', 'status s3')}${btn('status-busy', t.busy, '', 'status s2')}${btn('status-invisible', t.invisible, '', 'status s7')}${btn('status-offline', t.offline, '', 'status s0')}
          </div>
          <div class="ps5-cc-actions">
            ${btn('profile', t.viewProfile, 'user', 'primary')}${btn('my-games', t.myGames, 'grid')}${btn('my-achievements', t.myAchievements, 'trophy')}${btn('my-friends', t.myFriends, 'friends')}${btn('my-badges', t.badges, '')}
          </div>
          <div class="ps5-cc-subhead">${esc(t.account)}${wallet() ? ` · <span class="ps5-cc-wallet">${esc(t.walletBalance)}: ${esc(wallet())}</span>` : ''}</div>
          <div class="ps5-cc-actions">
            ${btn('account', t.accountDetails, 'gear')}${btn('wallet', t.wallet, '')}${btn('store-prefs', t.storePrefs, '')}${btn('language', t.language, '')}${btn('changeuser', t.changeUser, 'swap')}
          </div>`;
      } else if (section === 'friends') {
        const fr = friendsData();
        html = `<h3>${esc(t.friends)} <small>${esc(t.friendsOnline(fr.length))}</small></h3>
          <div class="ps5-cc-friends">${fr.length ? fr.slice(0, 24).map(f => `
            <button class="ps5-cc-friend" data-act="chat" data-id="${esc(f.id)}" title="${esc(f.name)}">
              <span class="ps5-cc-favatar">${f.avatar ? `<img src="${esc(f.avatar)}" alt="" loading="lazy">` : icon('user')}<span class="ps5-dot" data-state="${f.state}"></span></span>
              <span class="ps5-cc-fname">${esc(f.name)}</span>
              <span class="ps5-cc-fgame">${esc(f.game ? f.game : STATE_NAME(f.state))}</span>
            </button>`).join('') : `<div class="ps5-cc-empty">${esc(t.noFriendsOnline)}</div>`}</div>
          <div class="ps5-cc-actions">${btn('friends', t.openFriends, 'friends', 'primary')}</div>`;
      } else if (section === 'notifications') {
        html = `<h3>${esc(t.notifications)}</h3><p class="ps5-cc-text">${esc(t.notifHint)}</p>
          <div class="ps5-cc-actions">${btn('notifications', t.openNotifications, 'bell', 'primary')}${btn('community-notifs', t.communityNotifs, '')}</div>`;
      } else if (section === 'voice') {
        html = `<h3>${esc(t.voice)}</h3><p class="ps5-cc-text">${esc(t.voiceHint)}</p>
          <div class="ps5-cc-actions">${btn('friends', t.openChat, 'mic', 'primary')}${btn('voice-settings', t.voiceSettings, 'gear')}</div>`;
      } else if (section === 'music') {
        html = `<h3>${esc(t.music)}</h3><p class="ps5-cc-text">${esc(t.musicHint)}</p>
          <div class="ps5-cc-actions">${btn('soundtracks', t.soundtracks, 'music', 'primary')}${btn('musicplayer', t.musicPlayer, '')}</div>`;
      } else if (section === 'downloads') {
        html = `<h3>${esc(t.downloads)}</h3><div class="ps5-cc-dl">${downloadsHTML()}</div>
          <div class="ps5-cc-actions">${btn('downloads', t.openDownloads, 'download', 'primary')}</div>`;
      } else if (section === 'settings') {
        html = `<h3>${esc(t.settings)}</h3><p class="ps5-cc-text">${esc(t.steamSettingsHint)}</p>
          <div class="ps5-cc-actions">${btn('settings', t.steamSettings, 'gear', 'primary')}${btn('bigpicture', t.bigPicture, 'tv')}</div>`;
      } else if (section === 'power') {
        const c2 = a => (confirmAct === a ? ' confirm' : '');
        html = `<h3>${esc(t.power)}</h3>${confirmAct ? `<p class="ps5-cc-text warn">${esc(t.confirm)}</p>` : ''}
          <div class="ps5-cc-actions">
            ${btn('restart', t.restart, 'restart', c2('restart'))}${btn('exit', t.exit, 'power', 'danger' + c2('exit'))}
            ${btn('changeuser', t.changeUser, 'swap')}${btn('offline', t.goOffline, 'cloud')}${btn('bigpicture', t.bigPicture, 'tv')}
          </div>`;
      }
      c.innerHTML = html;
      c.dataset.section = section;
    };

    const downloadsHTML = () => {
      const t = T();
      const ov = overview;
      if (!ov || !ov.update_appid || ov.update_state === 'None') return `<div class="ps5-cc-empty">${esc(t.noDownloads)}</div>`;
      const app = appById(ov.update_appid);
      const total = Number(ov.update_bytes_to_download) || 0;
      const done = Number(ov.update_bytes_downloaded) || 0;
      const pct = total ? Math.min(100, Math.round(done / total * 100)) : 0;
      const speed = Number(ov.update_network_bytes_per_second) || 0;
      return `<div class="ps5-cc-dlrow">
          <div class="ps5-cc-dlname">${esc(app ? app.display_name : '#' + ov.update_appid)}</div>
          <div class="ps5-bar big"><i style="width:${pct}%"></i></div>
          <div class="ps5-cc-dlmeta">${ov.paused ? esc(t.paused) : `${pct}% · ${fmtBytes(done)} / ${fmtBytes(total)} · ${fmtBytes(speed)}/s`}${!ov.paused && ov.update_seconds_remaining > 0 ? ` · ${fmtTime(ov.update_seconds_remaining)} ${esc(t.remaining)}` : ''}</div>
        </div>`;
    };

    // the CC only listens to the shared Downloads module while it is open
    const watchDownloads = on => {
      if (on && !unDownloads) {
        overview = Downloads.overview;
        unDownloads = Downloads.on(ov => {
          overview = ov;
          const box = open && section === 'downloads' && node.querySelector('.ps5-cc-dl');
          if (box) box.innerHTML = downloadsHTML();
        });
      } else if (!on && unDownloads) { unDownloads(); unDownloads = null; }
    };

    const clickNotificationBell = () => {
      const sel = ['.TitleBarControls [class*="Notification"]', '.TitleBarControls [class*="notification"]', '[class*="NotificationButton"]', '[class*="NotificationsButton"]'];
      for (const s of sel) {
        const b = doc.querySelector(s);
        if (b && typeof b.click === 'function') { b.click(); return true; }
      }
      return false;
    };

    const armConfirm = act => {
      if (confirmAct === act) { confirmAct = ''; clearTimeout(confirmTimer); return true; }
      confirmAct = act;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => { confirmAct = ''; if (open && section === 'power') card(); }, 4000);
      card();
      return false;
    };

    const onClick = e => {
      const sec = e.target.closest('[data-sec]');
      if (sec) { setSection(sec.dataset.sec); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      const sc = SC();
      const shut = () => close();
      switch (act) {
        case 'close': shut(); break;
        case 'nav-home': shut(); Library.close(); navigate('/library/home'); break;
        case 'library': shut(); Library.open(); break;
        case 'play-last': { const app = appById(node.querySelector('.ps5-cc-card').dataset.app); if (app) runAction(app, playState(app)); shut(); break; }
        case 'status-online': steamURL('steam://friends/status/online'); setTimeout(card, 400); break;
        case 'status-away': steamURL('steam://friends/status/away'); setTimeout(card, 400); break;
        case 'status-busy': steamURL('steam://friends/status/busy'); setTimeout(card, 400); break;
        case 'status-invisible': steamURL('steam://friends/status/invisible'); setTimeout(card, 400); break;
        case 'status-offline': steamURL('steam://friends/status/offline'); setTimeout(card, 400); break;
        case 'profile': shut(); openWeb('https://steamcommunity.com/my/'); break;
        case 'my-games': shut(); openWeb('https://steamcommunity.com/my/games/?tab=all'); break;
        case 'my-achievements': shut(); openWeb('https://steamcommunity.com/my/achievements/'); break;
        case 'my-friends': shut(); openWeb('https://steamcommunity.com/my/friends/'); break;
        case 'my-badges': shut(); openWeb('https://steamcommunity.com/my/badges/'); break;
        case 'account': shut(); openWeb('https://store.steampowered.com/account/'); break;
        case 'wallet': shut(); openWeb('https://store.steampowered.com/account/history/'); break;
        case 'store-prefs': shut(); openWeb('https://store.steampowered.com/account/preferences/'); break;
        case 'language': shut(); steamURL('steam://settings/interface'); break;
        case 'friends': shut(); steamURL('steam://open/friends'); break;
        case 'chat': shut(); if (b.dataset.id) steamURL('steam://friends/message/' + b.dataset.id); else steamURL('steam://open/friends'); break;
        case 'notifications': shut(); if (!clickNotificationBell()) openWeb('https://steamcommunity.com/my/notifications'); break;
        case 'community-notifs': shut(); openWeb('https://steamcommunity.com/my/notifications'); break;
        case 'voice-settings': shut(); steamURL('steam://settings/voice'); break;
        case 'soundtracks': shut(); steamURL('steam://open/library/view/soundtracks'); break;
        case 'musicplayer': shut(); steamURL('steam://open/musicplayer'); break;
        case 'downloads': shut(); steamURL('steam://open/downloads'); break;
        case 'settings': shut(); steamURL('steam://open/settings'); break;
        case 'bigpicture': shut(); steamURL('steam://open/bigpicture'); break;
        case 'changeuser': shut(); steamURL('steam://changeuser'); break;
        case 'offline': shut(); steamURL('steam://open/gooffline'); break;
        case 'restart':
          if (armConfirm('restart')) { try { sc.User.StartRestart(false); } catch (err) { console.warn('[PS5] restart', err); } }
          break;
        case 'exit':
          if (armConfirm('exit')) { try { sc.User.StartShutdown(false); } catch (err) { steamURL('steam://exit'); } }
          break;
        default: break;
      }
    };

    const setSection = s => {
      section = s;
      confirmAct = '';
      node.querySelectorAll('.ps5-cc-icon').forEach(b => b.classList.toggle('on', b.dataset.sec === s));
      const c = node.querySelector('.ps5-cc-card');
      c.classList.remove('swap'); void c.offsetWidth; c.classList.add('swap');
      card();
    };

    const openFn = s => {
      if (!node) build();
      Library.close();
      if (s) section = s;
      if (!open) WebView.hold();
      open = true;
      const tb = doc.querySelector('.TitleBar');
      root.style.setProperty('--ps5-top', Math.max(0, Math.round(tb ? tb.getBoundingClientRect().bottom : 32)) + 'px');
      row();
      card();
      watchDownloads(true);
      node.classList.add('open');
      root.classList.add('ps5-cc-open');
      const focus = node.querySelector('.ps5-cc-icon.on');
      if (focus) setTimeout(() => focus.focus({ preventScroll: true }), 30);
    };
    const close = () => {
      if (!open) return;
      open = false;
      confirmAct = '';
      node.classList.remove('open');
      root.classList.remove('ps5-cc-open');
      watchDownloads(false);
      WebView.release();
    };
    const key = e => {
      if (!open) return false;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = SECTIONS.indexOf(section) + (e.key === 'ArrowRight' ? 1 : -1);
        setSection(SECTIONS[(i + SECTIONS.length) % SECTIONS.length]);
        const f = node.querySelector('.ps5-cc-icon.on');
        if (f) f.focus({ preventScroll: true });
        return true;
      }
      return false;
    };
    // the friends card refreshes while it is on screen
    every(() => { if (open && !doc.hidden && section === 'friends') card(); }, 15000);
    onCleanup(() => { watchDownloads(false); clearTimeout(confirmTimer); if (open) WebView.release(); if (node) node.remove(); root.classList.remove('ps5-cc-open'); });
    return { open: openFn, close, toggle: s => (open ? close() : openFn(s)), isOpen: () => open, key };
  })();

  /* ───────────────────────── game actions menu ("…") ─────────────────────────
     v1.1.0's "…" on the Home Screen navigated to Steam's game page and the theme then
     injected its own strip (cards, about, screenshots) under Steam's play bar, while the
     sidebar came back: two views of one game, a second scroller and the game list.
     Now "…" opens this menu — one instance, anchored to the button, kept inside the
     window — and every entry is a real Steam action. The game page itself is only
     opened on purpose ("Game hub" entry, double-click on a tile). */
  const GameMenu = (() => {
    let node = null, forApp = null, anchorEl = null;
    const close = () => {
      if (!node || node.hidden) return false;
      node.hidden = true;
      node.classList.remove('open');
      forApp = null;
      if (anchorEl) { anchorEl.setAttribute('aria-expanded', 'false'); try { anchorEl.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
      anchorEl = null;
      return true;
    };
    const items = app => {
      const t = T();
      const state = playState(app);
      const steamApp = app.app_type !== SHORTCUT;
      const inst = isInstalled(app);
      return [
        { act: 'run', ico: state === 'stop' ? 'stop' : state === 'cancel' ? 'cross' : state === 'install' ? 'install' : 'play', label: t[state], primary: true },
        { act: 'hub', ico: 'controller', label: t.details },
        steamApp && { act: 'store', ico: 'bag', label: t.storePage },
        steamApp && { act: 'achievements', ico: 'trophy', label: t.myAchievements },
        { act: 'screenshots', ico: 'image', label: t.screenshots },
        steamApp && { act: 'hubweb', ico: 'friends', label: t.communityHub },
        { sep: true },
        { act: 'controller', ico: 'controller2', label: t.controllerLayout },
        inst && { act: 'shortcut', ico: 'link', label: t.desktopShortcut },
        { act: 'properties', ico: 'gear', label: t.properties },
        inst && steamApp && { act: 'uninstall', ico: 'trash', label: t.uninstall, danger: true },
      ].filter(Boolean);
    };
    const build = () => {
      node = h('div', '');
      node.id = 'ps5-gamemenu';
      node.setAttribute('role', 'menu');
      node.hidden = true;
      node.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || !forApp) return;
        const app = appById(forApp.appid) || forApp;
        const id = app.appid;
        const sc = SC();
        close();
        try {
          switch (b.dataset.act) {
            case 'run': runAction(app, playState(app)); break;
            case 'hub': navigate('/library/app/' + id); break;
            case 'store': try { sc.Apps.ShowStore(id); } catch (err) { openWeb('https://store.steampowered.com/app/' + id + '/'); } break;
            case 'achievements': openWeb('https://steamcommunity.com/my/stats/' + id + '/achievements/'); break;
            case 'screenshots': sc.Apps.BrowseScreenshotsForApp(String(id)); break;
            case 'hubweb': openWeb('https://steamcommunity.com/app/' + id + '/'); break;
            case 'controller': sc.Apps.ShowControllerConfigurator(id); break;
            case 'shortcut': sc.Apps.CreateDesktopShortcutForApp(id); snack(T().shortcutDone); break;
            case 'properties': sc.Apps.OpenAppSettingsDialog(id, ''); break;
            case 'uninstall': try { sc.Installs.OpenUninstallWizard([id], false); } catch (err) { steamURL('steam://uninstall/' + id); } break;
            default: break;
          }
        } catch (err) { console.warn('[PS5] game action failed', b.dataset.act, err); }
      });
      node.addEventListener('keydown', e => {
        const list = [...node.querySelectorAll('[data-act]')];
        const i = list.indexOf(doc.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
        else if (e.key === 'Tab') { close(); }
      });
      doc.body.appendChild(node);
    };
    const open = (app, anchor) => {
      if (!app) return;
      if (!node) build();
      if (!node.hidden && forApp && forApp.appid === app.appid) { close(); return; }
      forApp = app;
      anchorEl = anchor || null;
      node.innerHTML = `<div class="ps5-gm-head">${esc(app.display_name)}</div>` + items(app).map(it => it.sep
        ? '<div class="ps5-gm-sep" role="separator"></div>'
        : `<button class="ps5-gm-item${it.primary ? ' primary' : ''}${it.danger ? ' danger' : ''}" role="menuitem" data-act="${it.act}">${icon(it.ico)}<span>${esc(it.label)}</span></button>`).join('');
      node.hidden = false;
      // position: under the button when it fits, above it otherwise; always inside the window
      const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 2, bottom: innerHeight / 2 };
      const w = node.offsetWidth, hgt = node.offsetHeight, pad = 12;
      let left = Math.min(Math.max(pad, r.left), innerWidth - w - pad);
      let top = r.bottom + 10;
      if (top + hgt > innerHeight - pad) top = Math.max(pad, r.top - hgt - 10);
      node.style.left = left + 'px';
      node.style.top = top + 'px';
      node.classList.remove('open'); void node.offsetWidth; node.classList.add('open');
      if (anchorEl) anchorEl.setAttribute('aria-expanded', 'true');
      const first = node.querySelector('[data-act]');
      if (first) first.focus({ preventScroll: true });
    };
    // a click anywhere else closes it
    listen(doc, 'pointerdown', e => { if (node && !node.hidden && !node.contains(e.target) && !(anchorEl && anchorEl.contains(e.target))) close(); }, true);
    listen(window, 'blur', () => close());
    listen(window, 'resize', () => close(), { passive: true });
    onCleanup(() => { if (node) node.remove(); node = null; });
    return { open, close, isOpen: () => !!(node && !node.hidden) };
  })();

  /* ───────────────────────── game page: background only ─────────────────────────
     Steam's own game page (achievements, activity, news, screenshots, play bar) is
     the single view of a game; the theme only styles it (main.css, html.ps5-on-app)
     and puts the game's art behind the glass. */
  const Details = (() => {
    // the header already shows the art: no second copy washed over the whole page
    const update = () => { if (/^\/library\/app\//.test(currentPath())) Bg.clear(); };
    return { update };
  })();

  /* ───────────────────────── bottom bar: online friends on Friends & Chat ───────────────────────── */

  const BottomBar = (() => {
    let badge = null, counted = 0, count = -1;
    const update = () => {
      const btn = doc.querySelector('.BottomBar .FriendsButton') || doc.querySelector('.BottomBar [class*="FriendsButton"]');
      if (!btn || cssVar('--ps5-bottombar') === 'steam') { if (badge) badge.remove(); return; }
      const now = Date.now();
      if (now - counted > 10000) {
        counted = now;
        const all = safe(() => friendsApp().FriendStore.all_friends, null);
        count = Array.isArray(all) ? all.filter(f => safe(() => f.persona.m_ePersonaState > 0, false)).length : -1;
      }
      if (!badge) { badge = h('span', 'ps5-friends-badge'); badge.setAttribute('aria-hidden', 'true'); }
      badge.hidden = !(count > 0);
      const text = count > 99 ? '99+' : String(Math.max(0, count));
      if (badge.textContent !== text) badge.textContent = text;
      if (badge.parentElement !== btn) btn.appendChild(badge);
    };
    onCleanup(() => { if (badge) badge.remove(); badge = null; });
    return { update };
  })();

  /* ───────────────────────── the shell: one observer, one tick ───────────────────────── */

  const Shell = (() => {
    let queued = 0;
    const tick = () => {
      if (!doc.body) return;
      Bg.mount();
      Topbar.mount();
      const path = currentPath();
      const onHome = Home.update();
      Details.update();
      // background: home → selected game; game page → set by Details; elsewhere → ambient
      if (!onHome && !/^\/library\/app\//.test(path) && !Library.isOpen()) Bg.clear();
      const onApp = /^\/library\/app\//.test(path);
      root.classList.toggle('ps5-on-app', onApp);
      // «Game list»: hidden on Home and game pages (default) · Home only · always visible
      const listMode = cssVar('--ps5-home-sidebar');
      root.classList.toggle('ps5-hide-list', listMode !== 'show' && (onHome || (onApp && listMode !== 'home')));
      root.classList.toggle('ps5-on-web', WebView.onWebPage());
      root.classList.toggle('ps5-account-show', cssVar('--ps5-account') === 'show');
      root.classList.toggle('ps5-bb-steam', cssVar('--ps5-bottombar') === 'steam');
      BottomBar.update();
      Address.update();
      WebView.enforce();
    };
    const soon = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => { queued = 0; try { tick(); } catch (e) { console.warn('[PS5] tick', e); } });
    };
    onCleanup(() => { if (queued) cancelAnimationFrame(queued); });

    // one MutationObserver, moved to .MainPanel once Steam builds it
    const mo = new MutationObserver(soon);
    let watched = null;
    const watch = () => {
      if (watched && watched.isConnected && watched !== doc.body) return;
      const target = doc.querySelector('.MainPanel') || doc.body;
      if (!target || target === watched) return;
      mo.disconnect();
      mo.observe(target, { childList: true, subtree: true });
      watched = target;
    };
    onCleanup(() => mo.disconnect());

    // route changes straight from Steam's router
    let unlisten = null;
    const hookHistory = () => {
      if (unlisten) return;
      const hist = safe(() => S().SteamUIStore.WindowStore.MainWindowInstance.m_history, null);
      if (hist && typeof hist.listen === 'function') {
        try { const u = hist.listen(() => { Library.close(); CC.close(); GameMenu.close(); soon(); }); unlisten = typeof u === 'function' ? u : null; } catch (e) { /* polling covers it */ }
      }
    };
    onCleanup(() => { if (unlisten) unlisten(); });

    const start = () => {
      Downloads.start();
      tick(); watch(); hookHistory(); boot();
      every(() => {
        if (doc.hidden) return;
        watch(); hookHistory(); soon();
        Topbar.paintClock();
      }, 2000);
    };
    return { start, soon };
  })();

  /* ───────────────────────── keyboard ───────────────────────── */

  listen(window, 'keydown', e => {
    if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); CC.toggle(); return; }
    if (e.ctrlKey && e.shiftKey && (e.code === 'KeyL')) { e.preventDefault(); Library.toggle(); return; }
    if (e.key === 'Escape') {
      if (GameMenu.close()) { e.preventDefault(); return; }
      if (CC.isOpen()) { e.preventDefault(); CC.close(); return; }
      if (Library.isOpen()) { e.preventDefault(); Library.close(); return; }
    }
    if (CC.key(e) || Home.key(e)) e.preventDefault();
  }, true);
  listen(doc, 'visibilitychange', () => { if (!doc.hidden) Shell.soon(); });
  listen(window, 'resize', () => { if (Library.isOpen()) root.style.setProperty('--ps5-top', Math.round((doc.querySelector('.TitleBar') || { getBoundingClientRect: () => ({ bottom: 32 }) }).getBoundingClientRect().bottom) + 'px'); }, { passive: true });

  /* ───────────────────────── start ───────────────────────── */

  const api = window.__ps5Theme = {
    version: VERSION,
    openControlCenter: s => CC.open(s),
    openLibrary: () => Library.open(),
    destroy: () => {
      while (cleanups.length) { try { cleanups.pop()(); } catch (e) { /* keep going */ } }
      root.classList.remove('ps5-theme', 'ps5-home-mounted', 'ps5-hide-list', 'ps5-on-app', 'ps5-on-web', 'ps5-account-show', 'ps5-bb-steam');
      if (window.__ps5Theme === api) delete window.__ps5Theme;
    },
  };
  root.classList.add('ps5-theme');
  if (doc.body) Shell.start();
  else doc.addEventListener('DOMContentLoaded', () => Shell.start(), { once: true });
})();
