# Changelog

All notable changes to the PlayStation 5 Millennium Theme.
Versions follow [Semantic Versioning](https://semver.org/). Every version ships as one complete
ZIP on [GitHub Releases](https://github.com/Blackhagwag/PlayStation-5-Millennium-Theme/releases).

## [1.3.0] — 2026-11-27 — Visual Polish & Store Redesign

### Fixed
- **Navigation tabs had uneven sizes** — Steam fixes each tab at ~101 px with its own type
  size; the icon, padding and longer labels (Сообщество, a long user name) were squeezed into
  that box. Tabs now size to their label: one height (32 px), one type size (13.5 px), one
  capsule, white active pill with a small blue dot; icons drop first in narrow windows.
- **Store arrows: the white circles** — v1.2.0 only covered the legacy carousel. The React
  carousels (`.CarouselBtnLeft/Right`) and the game gallery's paging arrows (Steam's own white
  50 % discs) and thumbnail-scrollbar arrows are now marked by the script (with a structural
  fallback) and all draw the same 36 px glass disc, blue on hover, unchanged in active/focus;
  hit areas keep Steam's size.
- **Wishlist and store home pushed to the left** — a `max-width` added in v1.2.0 without
  centring. Removed.
- **Profile text cut off** — v1.1.0 enlarged the nickname to 32 px and gave text blocks
  `overflow: hidden` with large radii and 1 px borders that add width to Steam's fixed-pixel
  layout. Steam's own sizes are back, no clipping, 12 px radius, hairlines drawn as inset shadows
  (no extra width) across store and community, long names wrap.
- **Settings icon** — now the standard cog (Lucide "settings"), same size as the other icons,
  rotates and turns blue on hover.
- Library game pages: one glass layer per section (nested panels were doubled), room under the
  last section above the bottom bar.

### Added
- **Address panel** (top left): back · forward · reload (web pages) · where you are — "Library ·
  Home", "Library · <game>", or host › path on web pages (click copies the URL). It presses
  Steam's own arrows and reload, replacing Steam's wide address strip over web pages.
- **Store game page redesign** — hero tuned (lower, aligned to the page column, smaller logo,
  long titles reduced to three lines, thumbnails only when there are at least two); new **About
  this game** card in two balanced columns (release date · developer · publisher | genres ·
  tags, with icons; rows without data are not drawn); a compact **User reviews** card (share,
  label, count, recent score, link); Steam's glance box steps back and the **gallery** (Steam's
  own carousel, trailers included) takes the full column in a PS5 frame with rounded media,
  lit thumbnails, slim scrollbar and a full-screen viewer.
- **Wishlist grid** — a PS5 grid on Steam's real wishlist: covers, name, reviews, date added,
  Steam's prices and discount, Add to Cart (Steam's own `addToCart`) and remove (Steam's
  `/api/removefromwishlist`, with confirmation), search, 7 sort orders, "On sale" filter, count,
  and a button back to Steam's list. Data from Steam's Web API (GetWishlist + GetItems); built
  only when that list matches the rows Steam renders, otherwise Steam's list stays.
- **Home background blur** — the selected game's art is softly blurred (12 px by default,
  slider 0–40) with a crossfade; tiles and covers stay sharp.
- Tests: 166 checks (was 116) — tabs, address panel, blur, all arrow kinds and states, the about
  and reviews cards, a second game (long title, no logo, one screenshot, no reviews), wishlist
  grid actions and fallback, long nicknames.

### Notes
- The two videos mentioned for this version did not reach the session (no video file was
  attached), so fixes follow the written report and an audit of the code.

## [1.2.0] — 2026-11-27 — Major UI Rework & Bug Fixes

### Fixed (each one traced to its cause)
- **Black strip at the top of the library** — Steam keeps an empty placeholder,
  `.LocalContentContainer > .URLBarReplacement`, as tall as the web pages' address bar and
  paints it dark. It has no content or function; it now leaves the layout. Also added the
  opaque Steam layers that were missing from the transparency list (`.Wrapper`, the home's
  `.Body.InnerContainer`, the game page's scroll containers) and dropped a `.TitleBar` drag
  override.
- **"…" on a game opened several conflicting views** (Steam's game page + the theme's injected
  strip with screenshots + a second scroller + the game list) — the button navigated to Steam's
  page and the theme then inserted its own block under the play bar while the sidebar came back.
  Now "…" opens a **PS5 game actions menu**: Play / Stop / Install, Game hub, Store page,
  Achievements, Screenshots, Community hub, Controller layout, Desktop shortcut, Properties,
  Uninstall — all real Steam calls (`SteamClient.Apps.OpenAppSettingsDialog`, `ShowStore`,
  `BrowseScreenshotsForApp`, `ShowControllerConfigurator`, `CreateDesktopShortcutForApp`,
  `Installs.OpenUninstallWizard`). One instance, kept inside the window, closes on Esc, outside
  click, action or navigation. The injected game strip is gone: Steam's own game page is the
  single view, styled as a PS5 hub. The game list stays hidden on Home *and* game pages (option).
- **Game page rules leaking onto the library home** — the home lives inside `.AppDetailsMain`
  too; every game page rule is now scoped to the game page route.
- **What's New** overlapped, clipped and overflowed — Steam measures and positions that shelf
  itself, and v1.1.0 changed padding, borders, display and heights on its boxes. Rewritten to
  change paint only (radius, clipping, colour, shadows, image zoom inside its frame). The PS5
  Home is now mounted *above* the shelf (it sat under it).
- **Giant Downloads button in the middle of the bottom bar** — Steam stretches `.DownloadStatus`
  across the bar and widens it to ~720 px while downloading; the pill was painted on that box.
  Downloads, Add a Game and Friends & Chat are now compact capsules sized by their content
  (Downloads stays centred, with icon, status, percent and a thin blue progress line). Steam's own
  `.Icon` boxes carry the PS5 icons (no duplicate icons).
- **Settings icon looked like a sun** — replaced by a real cog, rotates on hover.
- **Double discounts** (e.g. -55% plus -10%) — `.bundle_base_discount` is Steam's small,
  struck-through note of a bundle's usual discount, not a second discount; v1.0/1.1 gave it the
  same blue badge as the sale percent. It is shown again as Steam means it. Prices and percents
  are never computed by the theme; the store hero reads only `.discount_pct` of the base edition.
- **Huge white circles on the store arrows** — Steam's carousel arrow is a 45×108 px hit area
  (and the slider arrows 38 px strips); v1.0/1.1 made those boxes round, white and scaled on
  hover. Hit areas now stay transparent and unchanged; a compact 38 px glass disc with Steam's
  chevron turns blue on hover. Slider rail and thumb restyled to match.

### Added
- **PlayStation Store product page**: a full-width hero with the game's key art (library hero,
  else first screenshot), logo, chips (sale + Steam's countdown, review score, release date,
  developer), short description, Steam's price of the base edition, a primary button that
  clicks Steam's own Add to Cart / Play / Install, a wishlist heart driving Steam's wishlist
  links, All editions and Media shortcuts, screenshot thumbnails (background swap + full-screen
  viewer with arrow keys). Steam's release / developer / tag nodes are moved into a facts strip.
  Steam's gallery (trailers included), editions, description, reviews stay below, restyled.
- **Store palette remap**: Steam's own colour variables for both store engines (classic v6 and
  the React v7 pages: `--color-greyneutral-*`, `--color-blue-*`, `--light-ctn-bg`, `--green`…)
  now point at the PS5 palette, so even hashed-class React blocks follow the theme.
- **Top menu bar** (Steam · View · Friends · Games · Help) with icons, hairline separators,
  hover states; title bar buttons restyled.
- **Navigation tabs** (Store · Library · Community · Profile): one glass capsule, icon + label,
  white active pill with a blue indicator, the profile tab with a person icon.
- Wallet balance (read from Steam's account button) in Control Center → Profile.
- Store home: section headings with a blue rule, cleaner capsule captions; wishlist cards polish.
- Tests: 116 checks (was 76), including every bug above.

### Notes
- The wishlist stays a list of PS5 cards, not a grid: Steam's wishlist is a virtual list that
  positions rows by a fixed row height; a grid would break its scrolling, sorting and
  drag-to-reorder. All of its actions stay Steam's.
- No video of the issues reached the session; fixes follow the written report and an audit of
  the theme's own code against captures of the live client published by other themes.

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
