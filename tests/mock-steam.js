/* Test harness only (not shipped in the theme ZIP).
   A small imitation of the Steam client's main window: the readable class names Millennium
   adds, and the stores/APIs js/ps5.js reads (appStore, collectionStore, appDetailsStore,
   SteamUIStore, SteamClient, g_FriendsUIApp). Lets the theme be exercised in plain Chromium. */
(() => {
  const now = Math.floor(Date.now() / 1000);
  const G = [
    [101, 'Starfall Odyssey', 9, 5400, true, 6.2e10], [102, 'Neon Drift Racing', 1, 920, true, 2.1e10],
    [103, 'Hollow Kingdom', 30, 3100, true, 9.8e9], [104, 'Iron Tactics', 3, 260, true, 1.6e10],
    [105, 'Ocean of Echoes', 60, 75, true, 4.4e9], [106, 'Pixel Farmstead', 120, 12000, true, 1.2e9],
    [107, 'Shadow Protocol', 400, 2200, false, 0], [108, 'Sky Citadel', 0, 0, true, 3.3e10],
    [109, 'Last Frontier', 800, 600, false, 0], [110, 'Crystal Caves', 5, 45, true, 8e8],
  ];
  const hue = id => (id * 47) % 360;
  const apps = [];
  for (let k = 0; k < 6; k++) {
    for (const [id, name, days, mins, inst, size] of G) {
      const appid = id + k * 100;
      apps.push({
        appid, display_name: k ? `${name} ${['', 'II', 'III', 'Remastered', 'Origins', 'Zero'][k]}` : name,
        sort_as: name.toLowerCase(), app_type: 1, visible_in_game_list: true,
        rt_last_time_played: k === 0 && days ? now - days * 3600 : (k && days && k < 3 ? now - (days + k * 500) * 3600 : 0),
        minutes_playtime_forever: k ? Math.round(mins / (k + 1)) : mins, minutes_playtime_last_two_weeks: k === 0 && days < 100 ? Math.min(mins, 300) : 0,
        per_client_data: [{ installed: k === 0 ? inst : k % 2 === 0 }], size_on_disk: String(size),
        display_status: 0,
      });
    }
  }
  apps.push({ appid: 3000000001, display_name: 'My Emulator (non-Steam)', app_type: 1073741824, visible_in_game_list: true, rt_last_time_played: now - 90000, minutes_playtime_forever: 0, per_client_data: [{ installed: true }], size_on_disk: '0' });
  const byId = new Map(apps.map(a => [a.appid, a]));
  const listeners = new Set();
  const history = {
    location: { pathname: '/library/home' },
    listen(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    push(p) { this.location = { pathname: p }; listeners.forEach(f => f(this.location)); window.__mockRoute(p); },
  };
  const calls = window.__steamCalls = [];
  window.appStore = {
    allApps: apps,
    GetAppOverviewByAppID: id => byId.get(Number(id)) || null,
    GetCachedLandscapeImageURL: a => `/assets/${a.appid}/header.jpg`,
    GetCachedVerticalCapsuleURL: a => `/assets/${a.appid}/library_600x900.jpg`,
  };
  window.collectionStore = { BIsHidden: id => id === 110 };
  window.appDetailsStore = { GetAppDetails: () => ({}), RequestAppDetails: () => Promise.resolve() };
  window.appAchievementProgressCache = { m_achievementProgress: { mapCache: new Map([[101, { unlocked: 34, total: 50, percentage: 68 }], [103, { unlocked: 12, total: 40 }]]) } };
  window.SteamUIStore = { Navigate: p => { calls.push(['Navigate', p]); history.push(p); }, WindowStore: { MainWindowInstance: { m_history: history } } };
  let dlCb = null;
  window.SteamClient = {
    Apps: { RunGame: (...a) => calls.push(['RunGame', ...a]), TerminateApp: (...a) => calls.push(['TerminateApp', ...a]), CancelLaunch: (...a) => calls.push(['CancelLaunch', ...a]) },
    URL: { ExecuteSteamURL: u => calls.push(['ExecuteSteamURL', u]) },
    User: { StartRestart: () => calls.push(['StartRestart']), StartShutdown: () => calls.push(['StartShutdown']) },
    Downloads: { RegisterForDownloadOverview: cb => { dlCb = cb; cb({ update_appid: 104, update_state: 'Updating', update_bytes_to_download: 16e9, update_bytes_downloaded: 9.7e9, update_network_bytes_per_second: 48e6, update_seconds_remaining: 140, paused: false }); return { unregister: () => { dlCb = null; calls.push(['UnregisterDownloads']); } }; } },
    Screenshots: { GetAllAppsLocalScreenshotsCount: () => Promise.resolve(0), GetAllAppsLocalScreenshotsRange: () => Promise.resolve([]) },
  };
  const friend = (n, s, g) => ({ display_name: n, persona: { m_strPlayerName: n, m_ePersonaState: s, m_strGameExtraInfo: g || '', avatar_url_medium: `/avatar/${n}.svg`, m_steamid: { ConvertTo64BitString: () => '7656119' + String(n.length).padStart(10, '0') } } });
  window.g_FriendsUIApp = { FriendStore: { self: { display_name: 'Vasya_PS5', persona: { m_ePersonaState: 1, avatar_url_medium: '/avatar/me.svg' } },
    all_friends: [friend('Kratos_Fan', 1, 'Starfall Odyssey'), friend('Aloy', 1), friend('Ratchet', 3), friend('Nathan', 1, 'Iron Tactics'), friend('Jin', 0), friend('Ellie', 2), friend('Sackboy', 1)] } };
  window.fetch = url => {
    const m = /appids=(\d+)/.exec(String(url));
    const id = m && m[1];
    const a = id && byId.get(Number(id));
    return Promise.resolve({ json: () => Promise.resolve(a ? { [id]: { success: true, data: {
      short_description: `${a.display_name} is a sweeping adventure across shattered worlds. Explore, fight and uncover the secrets of a forgotten civilisation in this &quot;test&quot; description.`,
      screenshots: [1, 2, 3, 4].map(i => ({ path_thumbnail: `${location.origin}/shot/${id}/${i}.svg`, path_full: `${location.origin}/shot/${id}/${i}.svg` })),
      genres: [{ description: 'Action' }, { description: 'Adventure' }], release_date: { date: '12 Mar, 2024' }, developers: ['Mock Studio'] } } } : {}) });
  };
  window.__hue = hue;
})();
