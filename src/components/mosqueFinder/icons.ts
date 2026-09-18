/* SVG assets. `ICON_*` values are inner-markup (used inside React <svg> tags).
   Full standalone strings are used where Leaflet needs an HTML string
   (popup content, divIcon markup). */

export const ICON_SEARCH = `<path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 10-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1114 9.5 4.5 4.5 0 019.5 14z"/>`;
export const ICON_LIST = `<path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/>`;
export const ICON_LOCATE = `<path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19a7 7 0 110-14 7 7 0 010 14z"/>`;
export const ICON_ROUTE_BADGE = `<path d="M21.71 11.29l-9-9a.996.996 0 00-1.41 0l-9 9a.996.996 0 000 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 000-1.41z"/>`;
export const ICON_CLOSE = `<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>`;
export const ICON_DISTANCE = `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>`;
export const ICON_ROUTE = `<path d="M21.71 11.29l-9-9a.996.996 0 00-1.41 0l-9 9a.996.996 0 000 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 000-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>`;
export const ICON_SUCCESS = `<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#0f6e4f"/>`;
export const ICON_ERROR = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#b1432f"/>`;
export const ICON_LOADING = `<path d="M12 4V2A10 10 0 002 12h2a8 8 0 018-8z" fill="#0f6e4f"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path>`;

/* monochrome variants (currentColor) for the accent-colored Find button */
export const ICON_MOSQUE_BTN = `<path d="M8.2 11.9C8.2 8.7 9.9 7.3 11.1 6.3c.4-.3.7-.7.9-1.2.2.5.5.9.9 1.2 1.2 1 2.9 2.4 2.9 5.6Z" fill="currentColor"/><path fill-rule="evenodd" d="M7.2 11.9h9.6v7.4H7.2Zm3.3 7.4v-3c0-1.2.6-2.1 1.5-2.4.9.3 1.5 1.2 1.5 2.4v3Z" fill="currentColor"/><path d="M4.4 19.3V9.7c0-1 .4-1.7 1-2 .6.3 1 1 1 2v9.6Z" fill="currentColor"/><circle cx="5.4" cy="6.9" r=".65" fill="currentColor"/><path d="M19.6 19.3V9.7c0-1-.4-1.7-1-2-.6.3 1 1-1 2v9.6Z" fill="currentColor"/><circle cx="18.6" cy="6.9" r=".65" fill="currentColor"/><path d="M13.1 1.7a1.7 1.7 0 100 3.4 2.4 2.4 0 010-3.4Z" fill="currentColor"/>`;
export const ICON_LOADING_BTN = `<path d="M12 4V2A10 10 0 002 12h2a8 8 0 018-8z" fill="currentColor"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path>`;

/* mosque glyph with fixed colors (used inside popups + sidebar cards) */
export const ICON_MOSQUE = `<path d="M8.2 11.9C8.2 8.7 9.9 7.3 11.1 6.3c.4-.3.7-.7.9-1.2.2.5.5.9.9 1.2 1.2 1 2.9 2.4 2.9 5.6Z" fill="#0f6e4f"/><path fill-rule="evenodd" d="M7.2 11.9h9.6v7.4H7.2Zm3.3 7.4v-3c0-1.2.6-2.1 1.5-2.4.9.3 1.5 1.2 1.5 2.4v3Z" fill="#0f6e4f"/><path d="M4.4 19.3V9.7c0-1 .4-1.7 1-2 .6.3 1 1 1 2v9.6Z" fill="#0f6e4f"/><circle cx="5.4" cy="6.9" r=".65" fill="#0f6e4f"/><path d="M19.6 19.3V9.7c0-1-.4-1.7-1-2-.6.3 1 1-1 2v9.6Z" fill="#0f6e4f"/><circle cx="18.6" cy="6.9" r=".65" fill="#0f6e4f"/><path d="M13.1 1.7a1.7 1.7 0 100 3.4 2.4 2.4 0 010-3.4Z" fill="#e2b04a"/>`;

/** wrap inner markup into a full standalone <svg> string (for innerHTML use) */
export const wrapSvg = (inner: string, vb = '0 0 24 24'): string =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

/* ===== Map pin for mosques — used as a RASTERIZED <img> icon (perf-critical) =====
   The browser decodes this data-URI once and reuses the cached bitmap while
   panning/zooming. A live inline-SVG divIcon with a CSS drop-shadow filter was
   the original lag source on mobile — do NOT go back to it. */
export const MOSQUE_PIN_SVG = `<svg viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mfPinG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#31a06e"/><stop offset="1" stop-color="#0d5c42"/></linearGradient></defs><path d="M18 44.6C13.4 37.4 4 28.6 4 16.2A14 14 0 1 1 32 16.2c0 12.4-9.4 21.2-14 28.4Z" fill="url(#mfPinG)" stroke="#fff" stroke-width="2.2"/><ellipse cx="13.6" cy="9.4" rx="6.6" ry="4" fill="#fff" opacity="0.15"/><g transform="translate(5.4 4.2) scale(1.05)"><path d="M8.2 11.9C8.2 8.7 9.9 7.3 11.1 6.3c.4-.3.7-.7.9-1.2.2.5.5.9.9 1.2 1.2 1 2.9 2.4 2.9 5.6Z" fill="#fff"/><path fill-rule="evenodd" d="M7.2 11.9h9.6v7.4H7.2Zm3.3 7.4v-3c0-1.2.6-2.1 1.5-2.4.9.3 1.5 1.2 1.5 2.4v3Z" fill="#fff"/><path d="M4.4 19.3V9.7c0-1 .4-1.7 1-2 .6.3 1 1 1 2v9.6Z" fill="#fff"/><circle cx="5.4" cy="6.9" r=".65" fill="#fff"/><path d="M19.6 19.3V9.7c0-1-.4-1.7-1-2-.6.3 1 1-1 2v9.6Z" fill="#fff"/><circle cx="18.6" cy="6.9" r=".65" fill="#fff"/><path d="M13.1 1.7a1.7 1.7 0 100 3.4 2.4 2.4 0 010-3.4Z" fill="#f2c35f"/></g></svg>`;

export const MOSQUE_PIN_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(MOSQUE_PIN_SVG);
