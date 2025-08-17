'use strict';

// Bharatwatch frontend configuration
// Set API_BASE_URL to your backend origin to enable live data.
// Example: window.BWConfig.API_BASE_URL = 'https://api.bharatwatch.com';
(function () {
  const savedBase = localStorage.getItem('BW_API_BASE') || '';
  window.BWConfig = {
    API_BASE_URL: savedBase, // leave empty to use mock data
    USE_CREDENTIALS: true,   // include cookies for auth/session
    REQUEST_TIMEOUT_MS: 15000,
    NOTIFICATIONS: {
      SSE_PATH: '/api/notifications/stream'
    }
  };
})();