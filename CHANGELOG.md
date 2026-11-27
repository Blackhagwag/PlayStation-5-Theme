# Changelog

All notable changes to the PlayStation 5 Millennium Theme.
Versions follow [Semantic Versioning](https://semver.org/). Every version ships as one complete
ZIP on [GitHub Releases](https://github.com/Blackhagwag/PlayStation-5-Millennium-Theme/releases).

## [1.1.0] — 2026-11-27 — Complete UI Overhaul & Bug Fixes

### Fixed
- **Store, Community, Profile and Wishlist were not themed at all.** Two causes, found in
  Millennium's source: web patches are matched with `std::regex_match` against the *whole* URL
  (the old pattern `https://store\.steampowered\.com` never matched a real page), and
  conditional web CSS is only applied after the option has been saved once. The web layer now
  uses Millennium's global `webkitCSS` / `webkitJS` hooks, and `js/web.js` decides per host and
  per page where the PS5 design applies.
- **Profile / Control Center broken on web pages** (Store, Community, Wishlist…): those pages are
  a native browser view laid over the window, so panels opened under it or were cut off. The
  theme now hides that view while a panel is open (`MainWindowBrowserManager.m_browser.SetVisible`,
  the same way Millennium shows its own panels) and restores it on close.
- Control Center could reach past the window edge in small windows; it is now limited to the
  space below the title bar and scrolls inside.
- Control Center and Game Library close on navigation; reopening never creates a second instance.
- Steam menus (Steam / View / Friends / Games / Help, account, Add a Game, notifications,
  right-click menus) stayed grey: they live in their own windows (`body.ContextMenuPopupBody`)
  that the old `Menu$` patch did not reach. They are now matched by window class.
- Notification toasts and settings / properties dialogs are matched by their window classes
  (`DesktopToastContainer`, `ModalDialogBody`).
- Accent presets now also reach web pages (corrected URL pattern).

### Added
- **PlayStation Store design** for the whole store: floating glass navigation bar with PS5 pills
  (also the React menu strip and its flyouts), big rounded hero carousel, game cards with hover
  lift and focus glow, PS5 pill tabs (New & Trending, Top Sellers…), blue discount badges, PS Store
  product page (title, highlights and screenshot strip, buy panel with blue pill button, wishlist
  / follow buttons, description, system requirements, reviews, DLC), search results, cart and
  account pages, hover cards, pop-ups and drop-downs.
- **Wishlist** as PS5 cards: cover, title, price and discount, Add to Cart as the primary action,
  quiet remove / categories buttons, PS5 search field, sort and filter buttons. All of Steam's
  wishlist actions (sort, filter, search, drag to reorder, remove, add to cart) keep working.
- **Community**: PlayStation Network-style profile (round avatar with glow, level, showcases,
  counts), profile games / achievements / friends / badges / inventory pages, hubs, Workshop,
  Discussions, Guides, Screenshots, Videos, Market and groups as PS5 cards with pill tabs.
- **What's New** shelf as a row of PS5 content cards (rounded, image zoom, glow on hover, date
  chips, two-line titles, game chips). Real Steam events, Steam's own click handling.
  Option: PS5 cards / Hidden.
- **Single profile button**: Steam's account button gives way to the PS5 avatar; its contents
  moved into Control Center → Profile → Account (account details, wallet & purchases, store
  preferences, language, change account; status and profile links were already there).
  Option «Steam account button → Visible» brings it back.
- **Bottom bar** redesigned: Downloads, Add a Game and Friends & Chat as PS5 pills with icons,
  blue animated state and progress line while downloading (live data from
  `SteamClient.Downloads`), online friends badge on Friends & Chat. Steam's own Add a Game menu
  (non-Steam game, activate a product…) and the friends window open as before.
  Option: PS5 / Steam default.
- Friends & chat window restyled for today's Steam markup (status colours, round avatars,
  glass, pill input); Downloads page cards; settings dialogs (sidebar, toggles, drop-downs).
- Tests: 76 automated checks (was 40), including web pages served on the real store /
  community hostnames with the theme injected the way Millennium injects it.

### Changed
- One download listener for the whole theme instead of one per Control Center opening.
- The store keeps Steam's own font (the store measures its text itself; swapping the face clips
  prices and buttons); colours, surfaces, radii, buttons, cards and motion follow the PS5 design
  system shared with the desktop windows.

## [1.0.0] — 2026-11-27 — Initial Release

### Added
- **PS5 Home Screen** on the library home: a row of your recently played games (installed, or the
  whole library), the selected game's hero art as a full-window background with a smooth
  crossfade, its logo, last activity, play time, trophies (achievements) and storage cards, the
  store description, and a **Play** button that launches through `SteamClient.Apps.RunGame`
  (it turns into Stop / Cancel / Install like Steam's own button). Arrow keys switch games,
  Enter plays, double-click opens the game page. Steam's own shelves stay below.
- **Game Library**: full-screen PS5-style grid with *Installed*, *Your Collection* and
  *Recently Played* tabs, search, sorting (recently played, name, play time, size on disk),
  Non-Steam and Hidden filters, portrait covers, hover Play/Install. Pages of 60 cards and
  lazy-loaded images keep it fast with thousands of games.
- **Control Center** (Ctrl+Shift+Space or the controller button): Home, Profile (avatar, name,
  online status switcher, links to profile, games, achievements, friends, badges), Game Base
  (online friends and what they play, opens chats), Notifications, Voice Chat, Music
  (Soundtracks, music player), live Downloads progress, Settings, Power (restart / exit with
  confirmation, change account, go offline, Big Picture).
- **Game hub** on game pages: big hero art, white PS5 Play button, glass play bar, activity
  cards, "About" from the store, your own screenshots plus store screenshots with a lightbox.
- **Top bar**: PS5 text tabs for Store / Library / Community, Game Library, search and Control
  Center buttons, your avatar with status dot and a clock (24 h / 12 h / hidden).
- PS5 look for the **friends & chat** windows, **context menus**, **notification toasts**,
  **settings dialogs**, and — optionally — the **Store**, **Community** and a
  **PlayStation Network-style profile** page.
- Theme options in Millennium: Home Screen on/off, home games, Steam shelves, game list on
  home, 5 accent presets + custom accent in the Colors tab, background (game art / PS5
  waves / black), background blur slider, reduced animations, boot animation, clock, store
  styling, theme language (English / Русский / auto).
- Bundled Inter variable font (OFL), PS5-style boot fade.

### Notes
- Tested against a mock of the Steam client window in Chromium (40 automated checks:
  Home, Library, Control Center, game hub, cleanup). Steam changes its interface often;
  please report anything that looks off in a real client on GitHub Issues.
