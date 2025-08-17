'use strict';

(function () {
  const cfg = window.BWConfig || { API_BASE_URL: '', USE_CREDENTIALS: true, REQUEST_TIMEOUT_MS: 15000 };
  const API = {};
  const opts = { credentials: cfg.USE_CREDENTIALS ? 'include' : 'omit', headers: { 'Content-Type': 'application/json' } };

  function withTimeout(promise, ms) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return Promise.race([
      promise(ctrl.signal),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Request timeout')), ms + 10))
    ]).finally(() => clearTimeout(id));
  }

  function getBase() { return (cfg.API_BASE_URL || '').replace(/\/$/, ''); }
  function hasApi() { return !!getBase(); }

  async function doFetch(path, init = {}) {
    const url = `${getBase()}${path}`;
    return withTimeout((signal) => fetch(url, { ...opts, ...init, signal }), cfg.REQUEST_TIMEOUT_MS);
  }

  // Public methods
  API.getCategories = async function () {
    if (!hasApi()) return ['All','Gaming','Music','Podcasts','Movie','Food','News'];
    const r = await doFetch('/api/categories'); if (!r.ok) throw new Error('categories');
    return r.json();
  };

  API.getVideos = async function ({ category = 'all', page = 1, pageSize = 20 } = {}) {
    if (!hasApi()) {
      // fallback to mock by calling exposed function in app.js
      return window.Mock.getVideos({ category, page, pageSize });
    }
    const u = new URL(`${getBase()}/api/videos`);
    u.searchParams.set('category', category);
    u.searchParams.set('page', String(page));
    u.searchParams.set('pageSize', String(pageSize));
    const r = await withTimeout((signal) => fetch(u, { ...opts, signal }), cfg.REQUEST_TIMEOUT_MS);
    if (!r.ok) throw new Error('videos');
    return r.json();
  };

  API.getReels = async function ({ cursor = '' } = {}) {
    if (!hasApi()) return window.Mock.getReels({ cursor });
    const u = new URL(`${getBase()}/api/reels`);
    if (cursor) u.searchParams.set('cursor', cursor);
    const r = await withTimeout((signal) => fetch(u, { ...opts, signal }), cfg.REQUEST_TIMEOUT_MS);
    if (!r.ok) throw new Error('reels');
    return r.json();
  };

  API.getVideo = async function (id) {
    if (!hasApi()) return window.Mock.getVideo(id);
    const r = await doFetch(`/api/videos/${id}`);
    if (!r.ok) throw new Error('video');
    return r.json();
  };

  API.getRelated = async function (id) {
    if (!hasApi()) return window.Mock.getRelated(id);
    const r = await doFetch(`/api/videos/${id}/related`);
    if (!r.ok) throw new Error('related');
    return r.json();
  };

  API.getComments = async function (id, cursor = '') {
    if (!hasApi()) return window.Mock.getComments(id, cursor);
    const u = new URL(`${getBase()}/api/videos/${id}/comments`);
    if (cursor) u.searchParams.set('cursor', cursor);
    const r = await withTimeout((signal) => fetch(u, { ...opts, signal }), cfg.REQUEST_TIMEOUT_MS);
    if (!r.ok) throw new Error('comments');
    return r.json();
  };

  API.postComment = async function (id, text) {
    if (!hasApi()) return window.Mock.postComment(id, text);
    const r = await doFetch(`/api/videos/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error('post comment');
    return r.json();
  };

  API.likeVideo = async function (id, like = true) {
    if (!hasApi()) return window.Mock.likeVideo(id, like);
    const method = like ? 'POST' : 'DELETE';
    const r = await doFetch(`/api/videos/${id}/like`, { method });
    if (!r.ok) throw new Error('like');
  };

  API.saveVideo = async function (id, save = true) {
    if (!hasApi()) return window.Mock.saveVideo(id, save);
    const method = save ? 'POST' : 'DELETE';
    const r = await doFetch(`/api/videos/${id}/save`, { method });
    if (!r.ok) throw new Error('save');
  };

  API.connectNotifications = function () {
    if (!hasApi()) return null;
    try {
      const es = new EventSource(`${getBase()}${cfg.NOTIFICATIONS.SSE_PATH}`, { withCredentials: cfg.USE_CREDENTIALS });
      return es;
    } catch (e) { return null; }
  };

  window.BWApi = API;
})();