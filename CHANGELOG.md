# Changelog

All notable changes to the PlayStation 5 Millennium Theme.
Versions follow [Semantic Versioning](https://semver.org/). Every version ships as one complete
ZIP on [GitHub Releases](https://github.com/Blackhagwag/PlayStation-5-Millennium-Theme/releases).

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
