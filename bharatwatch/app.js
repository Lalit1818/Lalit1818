'use strict';

(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el.addEventListener(ev, fn, opts);

  // Mock data
  const categories = ['All','Gaming','Music','Podcasts','Movie','Food','News'];
  const sampleVideos = createSampleVideos();
  const sampleReels = createSampleReels();
  window.Mock = {
    getVideos: async ({ category = 'all', page = 1, pageSize = 20 } = {}) => {
      const slug = (category || 'all').toLowerCase();
      const filtered = sampleVideos.filter(v => slug==='all' ? true : (slug==='movie' ? v.category.toLowerCase()==='entertainment' : v.category.toLowerCase()===slug));
      const start = (page - 1) * pageSize; const end = start + pageSize;
      return { items: filtered.slice(start, end), nextPage: end < filtered.length ? page + 1 : null };
    },
    getReels: async ({ cursor='' }={}) => {
      const start = cursor ? parseInt(cursor, 10) : 0; const size = 10; const end = Math.min(start + size, sampleReels.length);
      return { items: sampleReels.slice(start, end), nextCursor: end < sampleReels.length ? String(end) : null };
    },
    getVideo: async (id) => sampleVideos.find(v => v.id === id),
    getRelated: async (id) => {
      const cur = sampleVideos.find(v => v.id === id); if (!cur) return { items: [] };
      return { items: sampleVideos.filter(v => v.category === cur.category && v.id !== id).slice(0, 10) };
    },
    getComments: async (id, cursor='') => {
      const all = (state.comments[id] || []).map(x => ({ id: x.id, text: x.text, ts: x.ts }));
      const start = cursor ? parseInt(cursor, 10) : 0; const size = 20; const end = Math.min(start + size, all.length);
      return { items: all.slice(start, end), nextCursor: end < all.length ? String(end) : null };
    },
    postComment: async (id, text) => {
      const item = { id: cryptoRandom(), text, ts: Date.now() };
      const arr = state.comments[id] || []; arr.unshift(item); state.comments[id] = arr; persistComments(); return item;
    },
    likeVideo: async (id, like=true) => { like ? state.likes.add(id) : state.likes.delete(id); localStorage.setItem('likes', JSON.stringify([...state.likes])); },
    saveVideo: async (id, save=true) => { save ? state.saves.add(id) : state.saves.delete(id); localStorage.setItem('saves', JSON.stringify([...state.saves])); },
  };

  // State
  const state = {
    filter: 'all',
    notifications: [],
    likes: new Set(JSON.parse(localStorage.getItem('likes') || '[]')),
    saves: new Set(JSON.parse(localStorage.getItem('saves') || '[]')),
    comments: JSON.parse(localStorage.getItem('comments') || '{}'), // { videoId: [{ id, text, ts }] }
    route: '#/home',
    reelIndex: 0,
    reelsLoaded: [],
  };

  // Elements
  const sideDrawer = $('#sideDrawer');
  const scrim = $('#scrim');
  const menuBtn = $('#menuBtn');
  const drawerClose = $('#drawerClose');
  const notifBtn = $('#notifBtn');
  const notifDropdown = $('#notifDropdown');
  const notifBadge = $('#notifBadge');
  const notifList = $('#notifList');
  const enablePush = $('#enablePush');
  const categoriesBar = $('#categoriesBar');
  const reelsList = $('#reelsList');
  const videoGrid = $('#videoGrid');
  const bottomNav = $('#bottomNav');

  const searchInput = $('#searchInput');
  const searchSuggestions = $('#searchSuggestions');
  const clearSearch = $('#clearSearch');

  const reelPlayer = $('#reelPlayer');
  const reelVideo = $('#reelVideo');
  const reelBack = $('#reelBack');
  const reelLike = $('#reelLike');
  const reelSave = $('#reelSave');
  const reelComment = $('#reelComment');
  const reelComments = $('#reelComments');
  const reelCommentsClose = $('#reelCommentsClose');
  const reelCommentsList = $('#reelCommentsList');
  const reelCommentInput = $('#reelCommentInput');
  const reelPostComment = $('#reelPostComment');

  const videoOverlay = $('#videoPlayer');
  const videoBack = $('#videoBack');
  const videoEl = $('#videoEl');
  const playPause = $('#playPause');
  const volume = $('#volume');
  const playbackRate = $('#playbackRate');
  const settingsBtn = $('#settingsBtn');
  const settingsMenu = $('#settingsMenu');
  const fullscreenBtn = $('#fullscreenBtn');
  const vpTitle = $('#vpTitle');
  const vpDescText = $('#vpDescText');
  const readMore = $('#readMore');
  const vpLike = $('#vpLike');
  const vpShare = $('#vpShare');
  const vpSave = $('#vpSave');
  const commentsList = $('#commentsList');
  const commentInput = $('#commentInput');
  const postComment = $('#postComment');
  const toggleComments = $('#toggleComments');
  const relatedList = $('#relatedList');

  const pageContainer = $('#pageContainer');
  const pageBackBtn = $('#pageBackBtn');
  const pageTitle = $('#pageTitle');
  const pageContent = $('#pageContent');

  // Setup
  setupDrawer();
  setupNotifications();
  setupSearch();
  // Categories removed from hero as per request
  renderReels();
  renderVideos();
  setupRouting();
  setupReelPlayer();
  setupVideoPlayer();
  simulateLiveNotifications();
  lazyLoadInit();
  setupDragScroll();
  setupCursorBehaviors();

  // Drawer
  function setupDrawer() {
    const focusFirstLink = () => { const first = sideDrawer && sideDrawer.querySelector('.drawer__item'); if (first) first.focus(); };
    const open = () => {
      sideDrawer.classList.add('open');
      sideDrawer.removeAttribute('aria-hidden');
      sideDrawer.removeAttribute('inert');
      sideDrawer.inert = false;
      scrim.hidden = false;
      setTimeout(focusFirstLink, 0);
    };
    const close = () => {
      if (sideDrawer.contains(document.activeElement) && menuBtn) menuBtn.focus();
      sideDrawer.classList.remove('open');
      sideDrawer.setAttribute('aria-hidden', 'true');
      sideDrawer.setAttribute('inert', '');
      sideDrawer.inert = true;
      scrim.hidden = true;
    };
    if (menuBtn) on(menuBtn, 'click', open);
    if (drawerClose) on(drawerClose, 'click', close);
    if (scrim) on(scrim, 'click', close);
    $$('.drawer__item').forEach(a => on(a, 'click', close));
  }

  // Notifications
  function setupNotifications() {
    if (!notifBtn) return;
    on(notifBtn, 'click', () => {
      const expanded = notifDropdown.hidden;
      notifDropdown.hidden = !expanded;
      notifBtn.setAttribute('aria-expanded', String(expanded));
      if (expanded) updateNotifList();
    });

    if (enablePush) {
      on(enablePush, 'click', async () => {
        if (!('Notification' in window)) { alert('Notifications not supported'); return; }
        try { const perm = await Notification.requestPermission(); if (perm === 'granted') new Notification('Bharatwatch', { body: 'Push enabled' }); } catch {}
      });
    }
  }

  function addNotification(text) {
    const item = { id: cryptoRandom(), text, ts: Date.now(), read: false };
    state.notifications.unshift(item);
    if (notifBadge) { notifBadge.hidden = false; notifBadge.textContent = String(state.notifications.filter(n => !n.read).length); }
    updateNotifList();
  }

  function updateNotifList() {
    if (!notifList) return;
    notifList.innerHTML = '';
    state.notifications.forEach(n => {
      const li = document.createElement('li');
      li.textContent = new Date(n.ts).toLocaleTimeString() + ' · ' + n.text;
      notifList.appendChild(li);
    });
  }

  function simulateLiveNotifications() {
    setInterval(() => {
      if (Math.random() < 0.25) addNotification(randomPick([
        'New video from channels you follow',
        '5 new comments on your video',
        'Your reel is trending now!',
        'New badge earned: Rising Creator'
      ]));
    }, 10000);
  }

  // Search
  function setupSearch() {
    if (!searchInput) return;
    on(searchInput, 'input', () => {
      const q = searchInput.value.trim();
      if ($('#clearSearch')) $('#clearSearch').hidden = q.length === 0;
      if (q.length === 0) { if (searchSuggestions) { searchSuggestions.hidden = true; searchSuggestions.innerHTML = ''; } return; }
      const suggestions = getSuggestions(q, 'all').slice(0, 8);
      if (!searchSuggestions) return;
      searchSuggestions.innerHTML = '';
      suggestions.forEach(s => {
        const li = document.createElement('li');
        li.role = 'option';
        li.textContent = s.label;
        on(li, 'click', () => { searchInput.value = s.label; searchSuggestions.hidden = true; navigateTo(s.href); });
        searchSuggestions.appendChild(li);
      });
      searchSuggestions.hidden = suggestions.length === 0;
    });

    if (clearSearch) on(clearSearch, 'click', () => { searchInput.value = ''; searchSuggestions.hidden = true; clearSearch.hidden = true; searchInput.focus(); });

    $$('.search__filters .chip').forEach(chip => {
      on(chip, 'click', (e) => {
        $$('.search__filters .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const href = chip.getAttribute('href');
        if (href && href.startsWith('#')) { e.preventDefault(); navigateTo(href); }
      });
    });
  }

  function getSuggestions(q, filter) {
    const lc = q.toLowerCase();
    const matches = [];
    sampleVideos.forEach(v => { if (v.title.toLowerCase().includes(lc)) matches.push({ label: 'Video · ' + v.title, href: `#/video/${v.id}` }); });
    sampleReels.forEach(r => { if (r.title.toLowerCase().includes(lc)) matches.push({ label: 'Reel · ' + r.title, href: '#/reels' }); });
    const channels = new Set([...sampleVideos.map(v => v.channel), ...sampleReels.map(r => r.channel)]);
    channels.forEach(ch => { if (ch.toLowerCase().includes(lc)) matches.push({ label: 'Channel · ' + ch, href: '#/home' }); });
    return matches;
  }

  // Reels list
  function renderReels() {
    if (!reelsList) return;
    reelsList.innerHTML = '';
    BWApi.getReels({}).then(({ items }) => {
      state.reelsLoaded = items || [];
      (items || []).forEach((reel, idx) => {
        const card = document.createElement('button');
        card.className = 'reel-card';
        card.setAttribute('aria-label', 'Open reel: ' + reel.title);
        card.innerHTML = `
          <div class="reel-card__thumb" data-bg="${reel.thumb}"></div>
          <div class="reel-card__label">${escapeHtml(reel.title)}</div>
        `;
        on(card, 'click', () => openReel(idx));
        reelsList.appendChild(card);
      });
      lazyLoadInit();
    }).catch(console.error);
  }

  // Videos grid
  function renderVideos() {
    if (!videoGrid) return;
    videoGrid.innerHTML = '';
    let page = 1; const pageSize = 9; let loading = false; let done = false; let currentCategory = categoryFromHash() || 'all';
    const sentinel = document.createElement('div');
    sentinel.id = 'gridSentinel'; sentinel.style.height = '1px';
    videoGrid.appendChild(sentinel);
    let io;
    const load = async () => {
      if (loading || done) return; loading = true;
      try {
        const { items, nextPage } = await BWApi.getVideos({ category: currentCategory, page, pageSize });
        (items || []).forEach(v => videoGrid.insertBefore(createVideoCard(v), sentinel));
        if (nextPage) page = nextPage; else { done = true; if (io) io.disconnect(); }
      } catch (e) { console.error(e); }
      finally { loading = false; }
    };
    io = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) load(); });
    }, { root: null, rootMargin: '200px' });
    io.observe(sentinel);
    load();
  }

  function createVideoCard(v) {
    const el = document.createElement('article');
    el.className = 'video-card';
    el.innerHTML = `
      <div class="video-card__media" data-bg="${v.thumb}"></div>
      <div class="video-card__body">
        <div class="video-card__avatar">${abbr(v.channel || 'CH')}</div>
        <div>
          <h3 class="video-card__title">${escapeHtml(v.title || 'Untitled')}</h3>
          <div class="video-card__meta">
            <span>${escapeHtml(v.channel || '')}</span>
            ${v.badge ? `<span class="badge-sm">${escapeHtml(v.badge)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    on(el, 'click', () => { if (v.id) openVideo(v.id); });
    return el;
  }

  // Data for liked/saved/history mapping to videos
  function getLikedVideos() { return sampleVideos.filter(v => state.likes.has(v.id)); }
  function getSavedVideos() { return sampleVideos.filter(v => state.saves.has(v.id)); }
  function getHistoryVideos() { return JSON.parse(localStorage.getItem('history') || '[]').map(id => sampleVideos.find(v => v.id === id)).filter(Boolean); }
  function reelList() { return state.reelsLoaded.length ? state.reelsLoaded : sampleReels; }
  function findReelById(id) { return reelList().find(r => r.id === id) || null; }
  function getLikedReels() { return reelList().filter(r => state.likes.has(r.id)); }
  function getSavedReels() { return reelList().filter(r => state.saves.has(r.id)); }
  function getHistoryReels() { return JSON.parse(localStorage.getItem('historyReels') || '[]').map(id => findReelById(id)).filter(Boolean); }
  function pushHistory(id) {
    const cur = JSON.parse(localStorage.getItem('history') || '[]');
    if (cur[0] !== id) { cur.unshift(id); if (cur.length > 100) cur.pop(); localStorage.setItem('history', JSON.stringify(cur)); }
  }
  function pushReelHistory(id) {
    const cur = JSON.parse(localStorage.getItem('historyReels') || '[]');
    if (cur[0] !== id) { cur.unshift(id); if (cur.length > 200) cur.pop(); localStorage.setItem('historyReels', JSON.stringify(cur)); }
  }

  // Routing (SPA)
  function setupRouting() {
    on(window, 'hashchange', handleRoute);
    handleRoute();
  }

  function navigateTo(hash) { location.hash = hash; }

  function handleRoute() {
    const hash = location.hash || '#/home';
    state.route = hash;
    closeAllOverlays();
    if (hash.startsWith('#/video/')) {
      const id = hash.split('/')[2];
      openVideo(id);
      return;
    }
    if (hash === '#/reels') {
      openReel(0);
      return;
    }
    const known = ['#/home','#/profile','#/liked','#/saved','#/history','#/settings','#/monetization','#/policy','#/contact','#/login'];
    if (hash.startsWith('#/category/')) {
      const slug = hash.split('/')[2];
      document.title = `Bharatwatch · ${capitalize(slug)}`;
      document.body.scrollTop = document.documentElement.scrollTop = 0;
      syncActiveCategoryChip(slug);
      const main = $('#main');
      if (main) {
        const grid = $('#videoGrid');
        if (grid) {
          grid.innerHTML = '';
          const filtered = sampleVideos.filter(v => v.category.toLowerCase() === slug || slug === 'all' || (slug === 'movie' && v.category.toLowerCase() === 'entertainment'));
          filtered.forEach(v => grid.appendChild(createVideoCard(v)));
        }
      }
      return;
    }
    if (known.includes(hash)) {
      if (hash === '#/home') { pageContainer.hidden = true; return; }
      const title = hash.replace('#/','').replace(/\b\w/g, c => c.toUpperCase()).replace(/-/g,' ');
      switch (hash) {
        case '#/profile': showPage('Profile', renderProfilePage()); break;
        case '#/liked': showPage('Liked', renderMixedList(getLikedVideos(), getLikedReels())); break;
        case '#/saved': showPage('Saved', renderMixedList(getSavedVideos(), getSavedReels())); break;
        case '#/history': showPage('History', renderMixedList(getHistoryVideos(), getHistoryReels())); break;
        case '#/settings': showPage('Settings', renderSettingsPage()); break;
        case '#/monetization': showPage('Monetization', renderMonetizationPage()); break;
        case '#/policy': showPage('Policies', renderPolicyPage()); break;
        case '#/contact': showPage('Contact', renderContactPage()); break;
        case '#/login': showPage('Sign In', renderLoginPage()); break;
        default: showPage(title, renderStubPage(title));
      }
      return;
    }
    pageContainer.hidden = true;
  }

  function showPage(title, contentEl) {
    pageTitle.textContent = title;
    pageContent.innerHTML = '';
    pageContent.appendChild(contentEl);
    pageContainer.hidden = false;
  }

  on(pageBackBtn, 'click', () => history.back());

  function renderStubPage(title) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p>This is the ${escapeHtml(title)} page. Build out your features here.</p>
    `;
    return wrap;
  }

  function renderCategoryPage(slug) {
    const wrap = document.createElement('div');
    const name = capitalize(slug);
    const filtered = sampleVideos.filter(v => v.category.toLowerCase() === slug || slug === 'all');
    const grid = document.createElement('div');
    grid.className = 'video-grid';
    filtered.forEach(v => grid.appendChild(createVideoCard(v)));
    wrap.appendChild(grid);
    return wrap;
  }

  function syncActiveCategoryChip(slug) {
    const chips = $$('.search__filters .chip');
    chips.forEach(c => c.classList.remove('active'));
    const match = chips.find(c => (c.dataset.category || '').toLowerCase() === slug);
    if (match) match.classList.add('active');
  }

  // Reels overlay
  function setupReelPlayer() {
    on(reelBack, 'click', () => { reelPlayer.hidden = true; navigateSafely('#/home'); });
    on(reelComment, 'click', () => { reelComments.hidden = !reelComments.hidden; });
    on(reelCommentsClose, 'click', () => { reelComments.hidden = true; });
    on(reelPostComment, 'click', () => {
      const t = reelCommentInput.value.trim();
      if (!t) return;
      const id = 'reel-' + state.reelIndex;
      const all = state.comments[id] || [];
      const item = { id: cryptoRandom(), text: t, ts: Date.now() };
      all.unshift(item);
      state.comments[id] = all;
      persistComments();
      reelCommentInput.value = '';
      renderReelComments();
    });
    on(reelLike, 'click', () => {
      const list = state.reelsLoaded.length ? state.reelsLoaded : sampleReels;
      const id = (list[state.reelIndex] || {}).id;
      if (!id) return; toggleLike(id);
      updateReelActionStates(id);
    });
    on(reelSave, 'click', () => {
      const list = state.reelsLoaded.length ? state.reelsLoaded : sampleReels;
      const id = (list[state.reelIndex] || {}).id;
      if (!id) return; toggleSave(id);
      updateReelActionStates(id);
    });

    // Scroll/swipe up/down to switch
    on(reelPlayer, 'wheel', (e) => {
      if (Math.abs(e.deltaY) < 20) return;
      if (e.deltaY > 0) nextReel(); else prevReel();
    }, { passive: true });

    on(reelPlayer, 'mousemove', debounce(() => { document.body.classList.remove('hide-cursor'); }, 2000));
    on(reelPlayer, 'mousemove', () => { document.body.classList.remove('hide-cursor'); });
    let cursorHideTimer;
    on(reelPlayer, 'mouseenter', () => { clearTimeout(cursorHideTimer); cursorHideTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 1500); });
    on(reelPlayer, 'mouseleave', () => { document.body.classList.remove('hide-cursor'); clearTimeout(cursorHideTimer); });

    let touchStartY = 0;
    on(reelPlayer, 'touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
    on(reelPlayer, 'touchend', e => {
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dy) > 40) { if (dy < 0) nextReel(); else prevReel(); }
    });
  }

  function openReel(index) {
    const list = state.reelsLoaded.length ? state.reelsLoaded : sampleReels;
    const max = list.length || 1;
    state.reelIndex = ((index % max) + max) % max;
    const reel = list[state.reelIndex] || list[0];
    reelVideo.src = reel.src;
    reelVideo.poster = thumbAsDataUrl(reel.title, 9, 16);
    reelVideo.currentTime = 0;
    reelVideo.play().catch(() => {});
    pushReelHistory(reel.id);
    updateReelActionStates(reel.id);
    renderReelComments();
    reelPlayer.hidden = false;
    location.hash = '#/reels';
  }
  function nextReel() { openReel(state.reelIndex + 1); }
  function prevReel() { openReel(state.reelIndex - 1); }
  function updateReelActionStates(id) {
    if (reelLike) reelLike.classList.toggle('active', state.likes.has(id));
    if (reelSave) reelSave.classList.toggle('active', state.saves.has(id));
  }
  function renderReelComments() {
    const id = 'reel-' + state.reelIndex;
    const all = state.comments[id] || [];
    reelCommentsList.innerHTML = '';
    all.forEach(c => {
      const li = document.createElement('li');
      li.textContent = c.text;
      reelCommentsList.appendChild(li);
    });
  }

  // Video overlay
  function setupVideoPlayer() {
    on(videoBack, 'click', () => { videoOverlay.hidden = true; navigateSafely('#/home'); });
    on(playPause, 'click', () => {
      if (videoEl.paused) { videoEl.play(); playPause.textContent = 'Pause'; }
      else { videoEl.pause(); playPause.textContent = 'Play'; }
    });
    on(volume, 'input', () => { videoEl.volume = volume.value / 100; });
    on(playbackRate, 'change', () => { videoEl.playbackRate = parseFloat(playbackRate.value); });
    on(settingsBtn, 'click', () => { settingsMenu.hidden = !settingsMenu.hidden; });
    on(fullscreenBtn, 'click', toggleFullscreen);
    on(vpLike, 'click', () => toggleLike(currentVideoId()));
    on(vpSave, 'click', () => toggleSave(currentVideoId()));
    on(vpShare, 'click', () => shareCurrent());
    on(postComment, 'click', () => {
      const t = commentInput.value.trim();
      if (!t) return;
      const id = currentVideoId();
      const all = state.comments[id] || [];
      const item = { id: cryptoRandom(), text: t, ts: Date.now() };
      all.unshift(item);
      state.comments[id] = all;
      persistComments();
      commentInput.value = '';
      renderComments(id);
    });
    on(toggleComments, 'click', () => {
      const box = $('.vp__comments');
      if (box.style.display === 'none') { box.style.display = ''; toggleComments.textContent = 'Minimize'; }
      else { box.style.display = 'none'; toggleComments.textContent = 'Show'; }
    });
    on(document, 'keydown', (e) => {
      if (!videoOverlay.hidden && e.key === ' ') { e.preventDefault(); playPause.click(); }
      if (!reelPlayer.hidden && ['ArrowUp','ArrowDown'].includes(e.key)) { e.preventDefault(); if (e.key==='ArrowUp') nextReel(); else prevReel(); }
    });

    // Hide cursor after inactivity over video
    const vp = $('.vp__aspect');
    let hideTimer;
    on(vp, 'mousemove', () => { document.body.classList.remove('hide-cursor'); clearTimeout(hideTimer); hideTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 1500); });
    on(vp, 'mouseleave', () => { document.body.classList.remove('hide-cursor'); clearTimeout(hideTimer); });
  }

  function openVideo(id) {
    BWApi.getVideo(id).then(video => {
      if (!video) return;
      pushHistory(id);
      videoEl.src = video.hls || video.src;
      videoEl.poster = video.thumb || thumbAsDataUrl(video.title, 16, 9);
      videoEl.currentTime = 0;
      playPause.textContent = 'Play';
      volume.value = 100; videoEl.volume = 1;
      playbackRate.value = '1'; videoEl.playbackRate = 1;
      settingsMenu.hidden = true;

      vpTitle.textContent = video.title;
      vpDescText.textContent = video.description;

      setLikeState(id, state.likes.has(id));
      setSaveState(id, state.saves.has(id));

      renderComments(id);
      renderRelated(id);

      videoOverlay.hidden = false;
      location.hash = `#/video/${id}`;
    });
  }

  function renderComments(id) {
    BWApi.getComments(id).then(({ items }) => {
      commentsList.innerHTML = '';
      items.forEach(c => {
        const li = document.createElement('li');
        li.textContent = c.text;
        commentsList.appendChild(li);
      });
    });
  }

  function renderRelated(id) {
    BWApi.getRelated(id).then(({ items }) => {
      relatedList.innerHTML = '';
      items.forEach(v => {
        const card = document.createElement('div');
        card.className = 'related__card';
        card.innerHTML = `
          <div class="related__thumb" data-bg="${v.thumb}"></div>
          <div class="related__title">${escapeHtml(v.title)}</div>
        `;
        on(card, 'click', () => openVideo(v.id));
        relatedList.appendChild(card);
      });
      lazyLoadInit();
    });
  }

  function currentVideoId() {
    const hash = location.hash;
    if (!hash.startsWith('#/video/')) return null;
    return hash.split('/')[2];
  }

  function toggleLike(id) {
    if (state.likes.has(id)) state.likes.delete(id); else state.likes.add(id);
    localStorage.setItem('likes', JSON.stringify([...state.likes]));
    setLikeState(id, state.likes.has(id));
  }
  function setLikeState(id, liked) { vpLike.textContent = liked ? 'Liked' : 'Like'; }

  function toggleSave(id) {
    if (state.saves.has(id)) state.saves.delete(id); else state.saves.add(id);
    localStorage.setItem('saves', JSON.stringify([...state.saves]));
    setSaveState(id, state.saves.has(id));
  }
  function setSaveState(id, saved) { vpSave.textContent = saved ? 'Saved' : 'Save'; }

  async function shareCurrent() {
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Bharatwatch', text: 'Watch this video', url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard');
      }
    } catch (e) {}
  }

  function toggleFullscreen() {
    const el = $('#videoEl');
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      document.body.classList.add('hide-cursor');
    } else {
      document.exitFullscreen?.();
      document.body.classList.remove('hide-cursor');
    }
  }

  function closeAllOverlays() {
    videoOverlay.hidden = true;
    reelPlayer.hidden = true;
    settingsMenu.hidden = true;
  }

  function navigateSafely(fallbackHash) {
    // If history can go back within app, do so; else go to fallback
    if (history.length > 1) history.back(); else location.hash = fallbackHash;
  }

  // Lazy loading for thumbs
  function lazyLoadInit() {
    const nodes = $$('[data-bg]');
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.style.backgroundImage = `url("${el.getAttribute('data-bg')}")`;
          el.removeAttribute('data-bg');
          obs.unobserve(el);
        }
      });
    }, { rootMargin: '300px' });
    nodes.forEach(n => io.observe(n));
  }

  function setupDragScroll() {
    const draggables = ['.reels__scroll','.categories__scroll','.related'];
    draggables.forEach(sel => {
      const el = $(sel);
      if (!el) return;
      let isDown = false, startX = 0, scrollLeft = 0;
      on(el, 'mousedown', (e) => { isDown = true; el.classList.add('dragging'); startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; });
      on(window, 'mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - el.offsetLeft; const walk = (x - startX) * 1; el.scrollLeft = scrollLeft - walk; });
      on(window, 'mouseup', () => { isDown = false; el.classList.remove('dragging'); });
      // touch support
      let startTX = 0, startSL = 0;
      on(el, 'touchstart', (e) => { el.classList.add('dragging'); startTX = e.touches[0].pageX; startSL = el.scrollLeft; }, { passive: true });
      on(el, 'touchmove', (e) => { const dx = e.touches[0].pageX - startTX; el.scrollLeft = startSL - dx; }, { passive: true });
      on(el, 'touchend', () => { el.classList.remove('dragging'); });
    });
  }

  function setupCursorBehaviors() {
    // Simulate busy cursor on upload button
    const uploadBtn = $('#uploadBtn');
    if (uploadBtn) {
      on(uploadBtn, 'click', async () => {
        document.body.classList.add('busy');
        await sleep(1200);
        document.body.classList.remove('busy');
        location.hash = '#/upload';
      });
    }
  }

  // Utils
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function debounce(fn, wait) {
    let t; return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this,args), wait); };
  }

  // Helpers
  function createSampleVideos() {
    const cats = ['Gaming','News','Food','Entertainment','Music','Podcasts'];
    const src = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
    const arr = [];
    for (let i = 1; i <= 18; i++) {
      const cat = cats[i % cats.length];
      arr.push({
        id: 'vid-' + i,
        title: `${cat} Highlights ${i}`,
        channel: sampleChannel(i),
        badge: i % 5 === 0 ? 'Top Creator' : '',
        category: cat,
        description: lorem(28 + (i % 20)),
        thumb: thumbAsDataUrl(`${cat} ${i}`, 16, 9),
        src,
      });
    }
    return arr;
  }

  function createSampleReels() {
    const src = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
    const arr = [];
    for (let i = 1; i <= 12; i++) {
      const t = `Reel ${i}`;
      arr.push({ id: 'reel-' + i, title: t, channel: sampleChannel(i+10), thumb: thumbAsDataUrl(t, 9, 16), src });
    }
    return arr;
  }

  function sampleChannel(i) {
    const names = ['AaravTV','DesiPlays','BharatNews','MasalaMunch','FilmyBuzz','SwarSangeet','PodPulse'];
    return names[i % names.length];
  }

  function abbr(name) { return name.split(/\s|(?=[A-Z])/).slice(0,2).map(s => s[0]).join('').toUpperCase(); }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function escapeHtml(str) { return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c])); }

  function lorem(n) {
    const words = 'Discover amazing content on Bharatwatch crafted by creators across India bringing gaming news food entertainment music and podcasts to your screen with a smooth experience'.split(' ');
    let out = [];
    for (let i=0;i<n;i++) out.push(words[i % words.length]);
    return out.join(' ') + '.';
  }

  function randomPick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

  function cryptoRandom() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

  function thumbAsDataUrl(text, wRatio, hRatio) {
    // SVG text-based placeholder to avoid external images
    const w = 320; const h = Math.round(w * (hRatio / wRatio));
    const svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${w}\" height=\"${h}\"><defs><linearGradient id=\"g\" x1=\"0\" x2=\"1\" y1=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#201a16\"/><stop offset=\"1\" stop-color=\"#3a2a13\"/></linearGradient></defs><rect width=\"100%\" height=\"100%\" fill=\"url(#g)\"/><circle cx=\"56\" cy=\"56\" r=\"28\" fill=\"#ff7a00\"/><polygon points=\"50,42 72,56 50,70\" fill=\"#fff\"/><text x=\"50%\" y=\"90%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"#e8eaed\" font-family=\"system-ui,Arial\" font-size=\"16\">${text.replace(/</g,'&lt;')}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function persistComments() { localStorage.setItem('comments', JSON.stringify(state.comments)); }

  function categoryFromHash() {
    const h = location.hash;
    if (h.startsWith('#/category/')) return h.split('/')[2];
    return null;
  }

  // Page renderers
  function renderSimpleList(videos) {
    const wrap = document.createElement('div');
    const grid = document.createElement('div'); grid.className = 'content-grid';
    videos.forEach(v => grid.appendChild(createContentCard(v)));
    wrap.appendChild(grid);
    return wrap;
  }

  function renderMixedList(videos, reels) {
    const wrap = document.createElement('div');
    const grid = document.createElement('div'); grid.className = 'content-grid';
    videos.forEach(v => grid.appendChild(createContentCard(v)));
    reels.forEach(r => grid.appendChild(createContentCard({ id: r.id, title: r.title, thumb: r.thumb })));
    wrap.appendChild(grid);
    return wrap;
  }

  function renderProfilePage() {
    const wrap = document.createElement('div'); wrap.className = 'profile';
    // Banner
    const banner = document.createElement('div'); banner.className = 'profile__banner'; banner.innerHTML = 'Channel Banner';
    const bannerEdit = document.createElement('button'); bannerEdit.className = 'chip edit-btn'; bannerEdit.textContent = 'Edit banner';
    on(bannerEdit, 'click', () => openEditModal({ field: 'banner' }));
    banner.appendChild(bannerEdit);
    wrap.appendChild(banner);

    // Header
    const header = document.createElement('div'); header.className = 'profile__header';
    const avatar = document.createElement('div'); avatar.className = 'profile__avatar'; avatar.innerHTML = '<span>IMG</span>';
    on(avatar, 'click', () => openEditModal({ field: 'profilePhoto' }));
    const meta = document.createElement('div'); meta.className = 'profile__meta'; meta.innerHTML = '<h2 id="channelName">Your Channel</h2><div class="sub">@handle • India</div>';
    const actions = document.createElement('div'); actions.className = 'profile__actions';
    const editBtn = document.createElement('button'); editBtn.className = 'chip'; editBtn.textContent = 'Edit Profile';
    on(editBtn, 'click', () => openEditModal({ field: 'profile' }));
    const signOut = document.createElement('button'); signOut.className = 'chip'; signOut.textContent = 'Sign out';
    on(signOut, 'click', () => { localStorage.removeItem('auth'); location.hash = '#/login'; });
    actions.append(editBtn, signOut);
    header.append(avatar, meta, actions);
    wrap.appendChild(header);

    // Tabs
    const tabs = document.createElement('div'); tabs.className = 'tabs';
    const tabNames = ['Videos','Reels','Live','Playlist'];
    const tabEls = tabNames.map(name => { const b = document.createElement('button'); b.className = 'tab'; b.textContent = name; return b; });
    tabEls[0].classList.add('active');
    tabs.append(...tabEls);
    wrap.appendChild(tabs);

    const grid = document.createElement('div'); grid.className = 'content-grid'; wrap.appendChild(grid);
    const fill = (name) => {
      grid.innerHTML = '';
      let items = [];
      if (name === 'Videos') items = sampleVideos.slice(0, 9);
      if (name === 'Reels') items = sampleReels.slice(0, 9).map(r => ({ id: r.id, title: r.title, thumb: r.thumb }));
      if (name === 'Live') items = sampleVideos.slice(9, 15);
      if (name === 'Playlist') items = sampleVideos.slice(3, 12);
      items.forEach(i => grid.appendChild(createContentCard(i)));
    };
    tabEls.forEach(btn => on(btn, 'click', () => { tabEls.forEach(b => b.classList.remove('active')); btn.classList.add('active'); fill(btn.textContent); }));
    fill('Videos');

    return wrap;
  }

  function createContentCard(item) {
    const card = document.createElement('div'); card.className = 'content-card';
    card.innerHTML = `
      <div class="content-card__media" data-bg="${item.thumb || thumbAsDataUrl(item.title || 'Content', 16, 9)}"></div>
      <div class="content-card__body">
        <h4 class="content-card__title">${escapeHtml(item.title || 'Untitled')}</h4>
        <div style="position:relative;">
          <button class="kebab" aria-label="More">⋮</button>
        </div>
      </div>
    `;
    const kebab = $('.kebab', card);
    on(kebab, 'click', (e) => {
      e.stopPropagation();
      showMenu(kebab, [
        { label: 'Edit details', action: () => openEditModal({ field: 'content', item }) },
        { label: 'Set Private', action: () => alert('Set to Private') },
        { label: 'Set Public', action: () => alert('Set to Public') },
      ]);
    });
    on(card, 'click', () => {
      if (item.id?.startsWith('vid')) openVideo(item.id);
      else if (item.id?.startsWith('reel')) {
        const idx = sampleReels.findIndex(r => r.id === item.id);
        if (idx >= 0) openReel(idx);
      }
    });
    return card;
  }

  function showMenu(anchor, items) {
    closeMenus();
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div'); menu.className = 'menu';
    items.forEach(it => {
      const b = document.createElement('button'); b.className = 'menu__item'; b.textContent = it.label; on(b, 'click', () => { closeMenus(); it.action(); }); menu.appendChild(b);
    });
    document.body.appendChild(menu);
    menu.style.left = `${rect.left}px`; menu.style.top = `${rect.bottom + 6}px`;
    const off = () => { document.removeEventListener('click', off); menu.remove(); };
    setTimeout(() => document.addEventListener('click', off), 0);
  }
  function closeMenus() { $$('.menu').forEach(m => m.remove()); }

  function openEditModal({ field, item }) {
    const modal = document.createElement('div'); modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal__card">
        <h3>Edit ${field === 'content' ? 'Content' : 'Profile'}</h3>
        <div class="form">
          ${field === 'content' ? contentFields(item) : profileFields()}
          <div class="form__row">
            <button class="chip" id="cancelBtn">Cancel</button>
            <button class="chip" id="saveBtn">Save</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    on($('#cancelBtn', modal), 'click', () => modal.remove());
    on($('#saveBtn', modal), 'click', () => { alert('Saved'); modal.remove(); });
  }

  function contentFields(item) {
    return `
      <div class="field"><label>Title</label><input type="text" value="${escapeHtml(item.title || '')}"></div>
      <div class="field"><label>Description</label><textarea rows="3">${escapeHtml(item.description || '')}</textarea></div>
      <div class="field"><label>Thumbnail URL</label><input type="text" value="${escapeHtml(item.thumb || '')}"></div>
      <div class="field"><label>Keywords</label><input type="text" value=""></div>
      <div class="field"><label>Visibility</label><select><option>Public</option><option>Private</option></select></div>
    `;
  }
  function profileFields() {
    return `
      <div class="field"><label>Channel Name</label><input type="text" value="Your Channel"></div>
      <div class="field"><label>Profile Photo</label><input type="text" placeholder="Image URL"></div>
      <div class="field"><label>Channel Banner</label><input type="text" placeholder="Image URL"></div>
      <div class="field"><label>Keywords</label><input type="text" placeholder="music, gaming"></div>
      <div class="field"><label>Location</label><input type="text" value="India"></div>
      <div class="field"><label>Language</label><input type="text" value="English"></div>
      <div class="field"><label>Other Info</label><textarea rows="3"></textarea></div>
    `;
  }

  function renderSettingsPage() { const d = document.createElement('div'); d.innerHTML = '<p>Settings page coming soon.</p>'; return d; }
  function renderMonetizationPage() { const d = document.createElement('div'); d.innerHTML = '<p>Monetization dashboard coming soon.</p>'; return d; }
  function renderPolicyPage() { const d = document.createElement('div'); d.innerHTML = '<p>BharatWatch policy content.</p>'; return d; }
  function renderContactPage() { const d = document.createElement('div'); d.innerHTML = '<p>Contact us at support@bharatwatch.com</p>'; return d; }

  function renderLoginPage() {
    const d = document.createElement('div'); d.className = 'login';
    d.innerHTML = `
      <h2>Sign in to Bharatwatch</h2>
      <div class="field"><label>Username</label><input id="loginUser" type="text"></div>
      <div class="field"><label>Password</label><input id="loginPass" type="password"></div>
      <div class="form__row"><button class="chip" id="loginBtn">Sign In</button></div>
      <div class="providers">
        <button>Continue with Google</button>
        <button>Continue with GitHub</button>
      </div>
    `;
    on($('#loginBtn', d), 'click', async () => {
      const u = $('#loginUser', d).value.trim(); const p = $('#loginPass', d).value.trim();
      if (!u || !p) { alert('Enter credentials'); return; }
      // Replace with real API call
      localStorage.setItem('auth', JSON.stringify({ user: u }));
      location.hash = '#/profile';
    });
    return d;
  }

  // end
})();