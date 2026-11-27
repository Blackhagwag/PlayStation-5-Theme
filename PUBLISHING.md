# Publishing to the Millennium theme store

Millennium lists themes on [steambrew.app](https://steambrew.app/) from the
[`SteamClientHomebrew/ThemeDatabase`](https://github.com/SteamClientHomebrew/ThemeDatabase)
repository. This repository already meets its requirements:

| Requirement (ThemeDatabase README) | Here |
|---|---|
| `skin.json` at the repository root | ✅ |
| a `github` block whose `owner` / `repo_name` match the entry | ✅ `Blackhagwag` / `PlayStation-5-Theme` |
| `header_image` and `splash_image`: `https` URLs that load an image | ✅ `assets/real/header.jpg` (real capture) |
| `README.md` (shown on the theme page) | ✅ |

`node scripts/validate.mjs` checks the same rules before every release.

## Submit (one pull request, done once)

1. Fork `SteamClientHomebrew/ThemeDatabase`.
2. In `metadata.json`, add this entry to the `themes` array (keep the file's ordering):

   ```json
   { "owner": "Blackhagwag", "repo": "PlayStation-5-Theme" }
   ```

3. Open the pull request. A check validates `skin.json`; once it is merged the theme appears on
   the site automatically.

## Updates

The site reads the repository's **default branch**: pushing there updates the listing, no new
pull request needed. Keep `version` in `skin.json` and `CHANGELOG.md` in step; GitHub Releases
keep carrying the full ZIP for manual installs.

## What the store installs

Millennium downloads the default branch and copies it into `<Steam>/millennium/themes/`. The
theme needs only `skin.json`, `css/`, `js/` and `fonts/`; `tests/`, `scripts/` and `assets/` are
inert there (no patch references them).
