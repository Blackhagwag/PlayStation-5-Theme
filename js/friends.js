/* ==========================================================================
   PlayStation 5 — Millennium theme
   friends.js: the Friends list / chat windows (patch ".friendsui-container").

   Steam gives a friend in game only a small game icon (.FriendInGameIcon img,
   …/apps/<appid>/<hash>.jpg) and a game group only its icon in the header.
   The appid in that address gives the game's art on Steam's CDN; it is set as
   --ps5-fl-art on the row / group so css/friends.css can draw a PS5 Game Base
   card, plus data-ps5-game with the game's name for the card title.
   Nothing in Steam's markup is moved or removed: only attributes and an inline
   custom property are added, so Steam's own React rendering stays in charge.
   ========================================================================== */
(() => {
  'use strict';
  if (window.__ps5Friends) return;
  window.__ps5Friends = true;

  const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/';
  const art = id => `url("${CDN}${id}/library_hero.jpg"), url("${CDN}${id}/header.jpg")`;
  const appidOf = img => {
    const m = /\/apps\/(\d+)\//.exec((img && (img.currentSrc || img.getAttribute('src'))) || '');
    return m ? m[1] : '';
  };
  const root = document.documentElement;

  const mark = () => {
    if (document.querySelector('.FriendsListContent, .friendlistListContainer')) root.classList.add('ps5-fl');
    if (document.querySelector('.chatWindow, .ChatTabs, .chatEntry')) root.classList.add('ps5-chat');
  };

  const setArt = (node, id, game) => {
    if (!id) {
      if (node.hasAttribute('data-ps5-art')) { node.removeAttribute('data-ps5-art'); node.style.removeProperty('--ps5-fl-art'); }
      return;
    }
    if (node.getAttribute('data-ps5-art') !== id) {
      node.setAttribute('data-ps5-art', id);
      node.style.setProperty('--ps5-fl-art', art(id));
    }
    if (game != null && node.getAttribute('data-ps5-game') !== game) node.setAttribute('data-ps5-game', game);
  };

  const paint = () => {
    mark();
    // single friends in game (also inside the mixed "In game" group)
    for (const row of document.querySelectorAll('.friend.ingame')) {
      // rows inside a one-game group: the group's header already shows the game
      if (row.closest('.currentUserContainer, .quickAccessFriends, .friendInviteContainer, .MemberListColumn, .friendGroup.gameGroup:not(.OtherGamesGroup)')) { setArt(row, '', null); continue; }
      const id = appidOf(row.querySelector('.FriendInGameIcon img, img.gameIcon'));
      const label = row.querySelector('.richPresenceLabel, .gameName');
      setArt(row, id, label ? label.textContent.trim() : '');
    }
    // offline friends: the name, for the "Faces" option's hover label
    for (const row of document.querySelectorAll('.friendGroup.offlineFriends .friend')) {
      const n = row.querySelector('.playerName');
      const name = n ? n.textContent.trim() : '';
      if (name && row.getAttribute('data-ps5-name') !== name) row.setAttribute('data-ps5-name', name);
    }
    // a game group (two friends or more in one game): the header carries the art
    for (const g of document.querySelectorAll('.friendGroup.gameGroup:not(.OtherGamesGroup)')) {
      const head = g.querySelector(':scope > .groupName');
      const id = appidOf(head && head.querySelector('img')) || appidOf(g.querySelector('.FriendInGameIcon img, img.gameIcon'));
      setArt(g, id, null);
    }
  };

  let frame = 0;
  const queue = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(); }); };
  const start = () => {
    if (!document.body) return false;
    paint();
    new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, characterData: true });
    return true;
  };
  if (!start()) document.addEventListener('DOMContentLoaded', start, { once: true });
})();
