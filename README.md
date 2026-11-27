# PlayStation 5 — Millennium Theme for Steam

A PlayStation 5 style shell for the Steam desktop client, built for
[Millennium](https://steambrew.app/). Not just recoloured Steam: a PS5 **Home Screen** with your
real games, a **Game Library**, a **Control Center**, PS5 **game hubs**, a PSN-style profile,
glass panels and smooth motion — while every Steam function keeps working underneath.

![PS5 Home Screen in a real Steam client](assets/real/home.jpg)

*Real capture: the PS5 Home Screen running in the Steam client.*

> Unofficial fan project. Not affiliated with or endorsed by Sony Interactive Entertainment or
> Valve. "PlayStation" and "PS5" are trademarks of Sony Interactive Entertainment. No Sony logos
> or assets are included. Game art in the real captures belongs to its publishers; harness renders use placeholder art.

**[⬇ Download the latest ZIP from GitHub Releases](https://github.com/Blackhagwag/PlayStation-5-Theme/releases/latest)**

## Screenshots

Real captures from a Steam client running the theme:

| PlayStation Store | Store product page |
|---|---|
| ![Store](assets/real/store.jpg) | ![Store product page](assets/real/store-game.jpg) |
| **Library game page** | **Control Center (profile)** |
| ![Library game page](assets/real/game-page.jpg) | ![Control Center](assets/real/control-center.jpg) |
| **Wishlist grid** | |
| ![Wishlist](assets/real/wishlist.jpg) | |

*Friends' names and avatars are blurred in the real captures.*

Rendered by the test harness (placeholder game art):

![Home Screen](assets/preview-home.jpg)

| Game Library | Control Center |
|---|---|
| ![Game Library](assets/preview-library.jpg) | ![Control Center](assets/preview-control-center.jpg) |
| **PlayStation Store** | **PS Store product page** |
| ![Store](assets/preview-store.jpg) | ![Store product page](assets/preview-store-hero.jpg) |
| **About this game + reviews + gallery** | **Wishlist grid** |
| ![About](assets/preview-store-about.jpg) | ![Wishlist](assets/preview-wishlist.jpg) |
| **Game actions menu ("…")** | **Store arrows** |
| ![Game menu](assets/preview-game-menu.jpg) | ![Arrows](assets/preview-store-arrows.jpg) |
| **Long titles (second game)** | **Purchase options** |
| ![Store hero 2](assets/preview-store-hero-2.jpg) | ![Buy](assets/preview-store-buy.jpg) |
| **What's New + bottom bar** | **Profile panel over the Store** |
| ![What's New](assets/preview-whatsnew.jpg) | ![Profile panel](assets/preview-profile-store.jpg) |
| **Game hub** | **Steam menus** |
| ![Game hub](assets/preview-game.jpg) | ![Menus](assets/preview-menu.jpg) |

## Features

- **PS5 Home Screen** — row of recently played games; the selected game's hero art fills the
  window and crossfades as you switch; logo, last played, play time, trophies, storage,
  description; **Play** really launches the game (`SteamClient.Apps.RunGame`), and becomes
  Stop / Cancel / Install like Steam's own button. ← → to switch, Enter to play.
- **Game Library** (`Ctrl+Shift+L`) — *Installed*, *Your Collection*, *Recently Played*;
  search, sort, Non-Steam / Hidden filters, covers, hover Play. Rendered in pages with lazy
  images, so thousands of games stay smooth.
- **Control Center** (`Ctrl+Shift+Space`) — Profile with status switcher, Game Base (online
  friends), Notifications, Voice Chat, Music, live Downloads, Settings, Power. Everything uses
  real Steam functions (`steam://` URLs and `SteamClient`), nothing is faked.
- **Game hub** — large art, PS5 white Play button, activity cards, About, screenshots
  (yours + store) with a lightbox. Steam's achievements, news and activity stay on the page.
- **PlayStation Store** — Steam's own store palette remapped to PS5 (classic and React pages),
  glass navigation bar, big banners, game cards with hover glow, pill tabs, compact arrows,
  correct discounts. **Product pages** open on a full-width PS Store hero: key art, logo,
  sale / reviews / date / developer chips, price, Add to Cart (Steam's own button), wishlist
  heart, editions and media shortcuts, screenshot viewer — Steam's gallery, editions,
  description and reviews below.
- **Game actions menu** — "…" on the Home Screen: Play, Game hub, Store page, Achievements,
  Screenshots, Community hub, Controller layout, Desktop shortcut, Properties, Uninstall — all
  real Steam actions.
- **Wishlist** — a PS5 grid on your real wishlist (Steam's Web API): covers, prices,
  discounts, reviews, date added, Add to Cart and remove through Steam, search, sorting,
  "On sale" filter; one click back to Steam's own list.
- **Address panel** — compact capsule at the top left: back, forward, reload, where you are.
- **Community** — hubs, Workshop, Discussions, Guides, Screenshots, Market in the PS5 style;
  user profiles stay exactly as Steam (and their owners) draw them.
- **One profile button** — the PS5 avatar replaces Steam's account button; account details,
  wallet, store preferences, language, status and change account are in its panel. The panel
  works the same on every page, including on top of the Store (the native web view is hidden
  while it is open, exactly as Millennium does for its own panels).
- **What's New** as PS5 content cards; **bottom bar** (Downloads with live progress, Add a
  Game, Friends & Chat with online count) as PS5 pills; **every Steam menu** (Steam / View /
  Friends / Games / Help, right-click, account, notifications) as dark-blue rounded panels with
  blue highlight — all items and commands untouched.
- **Everywhere else** — PS5 top tabs with clock and avatar, glass game list, downloads page,
  friends & chat, notifications, settings and properties dialogs.
- **Options** in Millennium → Themes → PlayStation 5, in five tabs — *Home Screen*, *Look*,
  *Bars*, *Store & Web*, *Language* — and a *Colors* tab: accent colour (5 presets or your own),
  background (game art / PS5 waves / black), blur, reduced motion, boot animation, clock
  format, home layout, store styling, theme language (English / Русский).

## Compatibility

| | |
|---|---|
| Millennium | current releases (themes in `<Steam>/millennium/themes/`, `skin.json` Patches + Conditions) |
| Steam | the current desktop client (new library UI). Windows and Linux |
| Sections | Library, Home, What's New, game pages, Downloads, Store, Wishlist, Community, Profile, Workshop, Discussions, Friends & Chat, menus, notifications, dialogs, bottom bar |
| Left untouched | Big Picture Mode and the in-game overlay (so games and the overlay can never break) |

The theme only adds CSS and one script to Steam's windows through Millennium. It does not
modify Steam's files, does not change login, purchases or downloads, and has no installer.

## Installation

**From the Millennium theme store** (once listed on [steambrew.app](https://steambrew.app/)): open
Millennium → Themes, find **PlayStation 5**, install, select it.

### Manual installation (ZIP)

No installer, no Node.js, no Python — just the ZIP.

1. Install [Millennium](https://docs.steambrew.app/users/getting-started/installation) if you
   haven't yet, and start Steam once.
2. Download **`PlayStation-5-Millennium-Theme-vX.Y.Z.zip`** from
   [Releases](https://github.com/Blackhagwag/PlayStation-5-Theme/releases/latest).
3. Open Millennium's themes folder (the Themes page in Millennium's settings links to it in
   recent versions; otherwise open it yourself):
   - Windows: `C:\Program Files (x86)\Steam\millennium\themes\`
   - Linux: `~/.local/share/Steam/millennium/themes/` (or `~/.steam/steam/millennium/themes/`)
   - Older Millennium versions use `<Steam>/steamui/skins/` instead.
4. Extract the ZIP **into that folder**. You should end up with
   `themes/PlayStation-5-Millennium-Theme/skin.json` (one folder, `skin.json` directly inside it).
5. Back in **Millennium → Themes**, pick **PlayStation 5** and let Steam reload.
6. Optional: open the theme's settings (gear next to it) to choose accent, background,
   language and the rest.

**Updating:** delete the old `PlayStation-5-Millennium-Theme` folder, extract the new ZIP the same
way, reload Steam. **Removing:** pick another theme (or Default) and delete the folder.

## Shortcuts

| Key | Action |
|---|---|
| `Ctrl+Shift+Space` | Open / close Control Center |
| `Ctrl+Shift+L` | Open / close Game Library |
| `←` `→` | Switch games on Home (or sections in Control Center) |
| `Enter` | Play the selected game on Home |
| `Esc` | Close Control Center, Game Library or a screenshot |

## Development

```
skin.json            Millennium manifest: patches per window, options (Conditions)
css/root.css         colours editable in Millennium's Colors tab
css/shared.css       tokens, font, buttons, inputs, dialogs (all desktop windows)
css/main.css         main window: top bar, game list, home shelves, game page, downloads
css/components.css   the PS5 components built by the script
css/friends.css      friends & chat     css/menus.css   all Steam menus
css/toasts.css       notifications      css/webkit/web.css  Store, Wishlist, Community, Profile
css/options/         one small file per option value
js/ps5.js            runtime for the main window (Home, Library, Control Center, game hub, bottom bar)
js/web.js            runtime for store / community pages (page detection, marks for web.css)
fonts/inter/         Inter variable font (OFL)
tests/               mock Steam window + Playwright checks (not shipped)
scripts/             validate.mjs, package.sh (not shipped)
```

How it works: Millennium injects the CSS/JS listed in `skin.json` into matching Steam windows
(by window title or body class: `^Steam$` for the main window, `.friendsui-container` for chat,
`ContextMenuPopupBody` for menus, `ModalDialogBody` for dialogs, `DesktopToastContainer` for
notifications). Web pages get `css/webkit/web.css` and `js/web.js` through Millennium's global
`webkitCSS` / `webkitJS` hooks — URL patches are matched against the whole URL, and conditional
web CSS only applies once an option is saved, so the script itself picks store and community
pages and leaves every other site alone. `js/ps5.js` reads Steam's own stores
(`appStore`, `collectionStore`, `appDetailsStore`, `SteamUIStore`, `FriendStore`) and acts only
through Steam (`SteamClient.Apps.RunGame`, `SteamClient.Downloads`, `steam://…`).

Performance: one `MutationObserver` (on Steam's main panel) batched to one animation frame, a
2-second fallback tick that pauses while Steam is hidden, rebuilds only when the data actually
changes, lazy images, paged library grid, listeners released on close, and a full `destroy()`
on reload.

Checks (developer only, needs Node 18+ and Playwright):

```
node scripts/validate.mjs     # manifest, referenced files, CSS urls, JS syntax
node tests/run.mjs            # 175 checks: mock Steam window, menus, store/community pages
scripts/package.sh            # builds + verifies dist/PlayStation-5-Millennium-Theme-vX.Y.Z.zip
```

Releases: bump `version` in `skin.json`, add a section to `CHANGELOG.md`, push a `vX.Y.Z` tag (or
run the *Build & Release* workflow) — GitHub Actions validates, builds the ZIP, verifies it and
publishes the release with the ZIP attached.

Limits of the tests: there is no Steam client in CI, so the checks run against a faithful mock
of Steam's markup (the readable class names Millennium adds, Steam's stores and APIs, store
pages on their real hostnames). Steam changes its markup often.

Found something broken after a Steam update? Open an issue with a screenshot and your
Millennium version.

## License

MIT (code) · Inter font under SIL OFL 1.1. See [LICENSE](LICENSE).
