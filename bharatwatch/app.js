'use strict';

(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el.addEventListener(ev, fn, opts);

  // Mock data
  const categories = ['All','Gaming','News','Food','Entertainment','Music','Podcasts'];
  const sampleVideos = createSampleVideos();
  const sampleReels = createSampleReels();

  // State
  const state = {
    filter: 'all',
    notifications: [],
    likes: new Set(JSON.parse(localStorage.getItem('likes') || '[]')),
    saves: new Set(JSON.parse(localStorage.getItem('saves') || '[]')),
    comments: JSON.parse(localStorage.getItem('comments') || '{}'), // { videoId: [{ id, text, ts }] }
    route: '#/home',
    reelIndex: 0,
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
    const open = () => { sideDrawer.classList.add('open'); scrim.hidden = false; };
    const close = () => { sideDrawer.classList.remove('open'); scrim.hidden = true; };
    on(menuBtn, 'click', open);
    on(drawerClose, 'click', close);
    on(scrim, 'click', close);
    $$('.drawer__item').forEach(a => on(a, 'click', close));
  }

  // Notifications
  function setupNotifications() {
    on(notifBtn, 'click', () => {
      const expanded = notifDropdown.hidden;
      notifDropdown.hidden = !expanded;
      notifBtn.setAttribute('aria-expanded', String(expanded));
      if (expanded) updateNotifList();
    });

    on(enablePush, 'click', async () => {
      if (!('Notification' in window)) {
        alert('Notifications are not supported in this browser.');
        return;
      }
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          new Notification('Bharatwatch', { body: 'Push notifications enabled!' });
        }
      } catch (e) { console.error(e); }
    });
  }

  function addNotification(text) {
    const item = { id: cryptoRandom(), text, ts: Date.now(), read: false };
    state.notifications.unshift(item);
    notifBadge.hidden = false;
    notifBadge.textContent = String(state.notifications.filter(n => !n.read).length);
    updateNotifList();
  }

  function updateNotifList() {
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
    on(searchInput, 'input', () => {
      const q = searchInput.value.trim();
      $('#clearSearch').hidden = q.length === 0;
      if (q.length === 0) { searchSuggestions.hidden = true; searchSuggestions.innerHTML = ''; return; }
      const suggestions = getSuggestions(q, 'all').slice(0, 8);
      searchSuggestions.innerHTML = '';
      suggestions.forEach(s => {
        const li = document.createElement('li');
        li.role = 'option';
        li.textContent = s.label;
        on(li, 'click', () => {
          searchInput.value = s.label;
          searchSuggestions.hidden = true;
          navigateTo(s.href);
        });
        searchSuggestions.appendChild(li);
      });
      searchSuggestions.hidden = suggestions.length === 0;
    });

    on(clearSearch, 'click', () => {
      searchInput.value = '';
      searchSuggestions.hidden = true;
      clearSearch.hidden = true;
      searchInput.focus();
    });

    // Category chips open in new tab via anchor target=_blank; keep active styling locally
    $$('.search__filters .chip').forEach(chip => {
      on(chip, 'click', (e) => {
        $$('.search__filters .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
  }

  function getSuggestions(q, filter) {
    const lc = q.toLowerCase();
    const matches = [];
    if (filter === 'all' || filter === 'video') {
      sampleVideos.forEach(v => { if (v.title.toLowerCase().includes(lc)) matches.push({ label: 'Video · ' + v.title, href: `#/video/${v.id}` }); });
      sampleReels.forEach(r => { if (r.title.toLowerCase().includes(lc)) matches.push({ label: 'Reel · ' + r.title, href: '#/reels' }); });
    }
    if (filter === 'all' || filter === 'channel') {
      const channels = new Set([...sampleVideos.map(v => v.channel), ...sampleReels.map(r => r.channel)]);
      channels.forEach(ch => { if (ch.toLowerCase().includes(lc)) matches.push({ label: 'Channel · ' + ch, href: '#/home' }); });
    }
    // categories handled separately via chips
    return matches;
  }

  // Categories removed from hero as per request
  function renderReels() {
    reelsList.innerHTML = '';
    const items = [...sampleReels, ...sampleReels]; // preload some to allow long scroll
    items.forEach((reel, idx) => {
      const card = document.createElement('button');
      card.className = 'reel-card';
      card.setAttribute('aria-label', 'Open reel: ' + reel.title);
      card.innerHTML = `
        <div class="reel-card__thumb" data-bg="${reel.thumb}"></div>
        <div class="reel-card__label">${escapeHtml(reel.title)}</div>
      `;
      on(card, 'click', () => openReel(idx % sampleReels.length));
      reelsList.appendChild(card);
    });
  }

  // Videos grid
  function renderVideos() {
    videoGrid.innerHTML = '';
    const first = sampleVideos.slice(0, 9);
    first.forEach(v => videoGrid.appendChild(createVideoCard(v)));
    // Lazy append more
    const sentinel = document.createElement('div');
    sentinel.id = 'gridSentinel';
    sentinel.style.height = '1px';
    videoGrid.appendChild(sentinel);

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const currentCount = $$('.video-card', videoGrid).length;
          const more = sampleVideos.slice(currentCount, currentCount + 6);
          more.forEach(v => videoGrid.insertBefore(createVideoCard(v), sentinel));
          if (currentCount + more.length >= sampleVideos.length) io.disconnect();
        }
      });
    }, { root: null, rootMargin: '200px' });
    io.observe(sentinel);
  }

  function createVideoCard(v) {
    const el = document.createElement('article');
    el.className = 'video-card';
    el.innerHTML = `
      <div class="video-card__media" data-bg="${v.thumb}"></div>
      <div class="video-card__body">
        <div class="video-card__avatar">${abbr(v.channel)}</div>
        <div>
          <h3 class="video-card__title">${escapeHtml(v.title)}</h3>
          <div class="video-card__meta">
            <span>${escapeHtml(v.channel)}</span>
            ${v.badge ? `<span class="badge-sm">${escapeHtml(v.badge)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    on(el, 'click', () => openVideo(v.id));
    return el;
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
    const known = ['#/home','#/profile','#/liked','#/saved','#/history','#/settings','#/monetization','#/policy','#/contact'];
    if (hash.startsWith('#/category/')) {
      const slug = hash.split('/')[2];
      // Render full-page category view (no modal) for new tab
      document.title = `Bharatwatch · ${capitalize(slug)}`;
      document.body.scrollTop = document.documentElement.scrollTop = 0;
      const main = $('#main');
      if (main) {
        // Replace video grid with filtered content
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
      showPage(title, renderStubPage(title));
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
    state.reelIndex = (index + sampleReels.length) % sampleReels.length;
    const reel = sampleReels[state.reelIndex];
    reelVideo.src = reel.src;
    reelVideo.poster = thumbAsDataUrl(reel.title, 9, 16);
    reelVideo.currentTime = 0;
    reelVideo.play().catch(() => {});
    renderReelComments();
    reelPlayer.hidden = false;
    location.hash = '#/reels';
  }
  function nextReel() { openReel(state.reelIndex + 1); }
  function prevReel() { openReel(state.reelIndex - 1); }
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
    const video = sampleVideos.find(v => v.id === id);
    if (!video) return;
    videoEl.src = video.src;
    videoEl.poster = thumbAsDataUrl(video.title, 16, 9);
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
  }

  function renderComments(id) {
    const all = state.comments[id] || [];
    commentsList.innerHTML = '';
    all.forEach(c => {
      const li = document.createElement('li');
      li.textContent = c.text;
      commentsList.appendChild(li);
    });
  }

  function renderRelated(id) {
    const current = sampleVideos.find(v => v.id === id);
    const sameCat = sampleVideos.filter(v => v.category === current.category && v.id !== id).slice(0, 10);
    relatedList.innerHTML = '';
    sameCat.forEach(v => {
      const card = document.createElement('div');
      card.className = 'related__card';
      card.innerHTML = `
        <div class="related__thumb" data-bg="${v.thumb}"></div>
        <div class="related__title">${escapeHtml(v.title)}</div>
      `;
      on(card, 'click', () => openVideo(v.id));
      relatedList.appendChild(card);
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
})();