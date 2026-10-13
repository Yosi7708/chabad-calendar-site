'use strict';
// Admin-only planning preference. This is deliberately not sent as campaign data.
window.adsManagerSettings = (() => {
  const DEFAULT_SECONDS = 12, MIN_SECONDS = 5, MAX_SECONDS = 300;
  const project = String(window.ADS_CONFIG?.url || '').replace(/\/$/, '');
  const key = `luach-admin:banner-rotation:v1:${project}`;
  function validate(value) {
    const seconds = Number(value);
    if (String(value).trim() === '' || !Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
      throw Error('בחרו מספר שלם בין 5 ל־300 שניות.');
    }
    return seconds;
  }
  function load() {
    try { return validate(JSON.parse(localStorage.getItem(key))?.bannerRotationSeconds); }
    catch { return DEFAULT_SECONDS; }
  }
  function save(value) {
    const seconds = validate(value);
    localStorage.setItem(key, JSON.stringify({schemaVersion: 1, bannerRotationSeconds: seconds}));
    return seconds;
  }
  function exportConfig(value) {
    return {schemaVersion: 1, scope: 'admin-planning-only', projectUrl: project,
      bannerRotationSeconds: validate(value)};
  }
  return {load, save, validate, exportConfig, DEFAULT_SECONDS, MIN_SECONDS, MAX_SECONDS};
})();

