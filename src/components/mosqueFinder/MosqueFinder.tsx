import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotate';
import './mosqueFinder.css';

import { bearingDeg, debounce, esc, fmtDist, fmtDur, getDistance } from './geo';
import { fetchGeocode, fetchMosquesFromAPI, fetchOSRMRoute } from './api';
import {
  STALE_MAX,
  TTL_GEOCODE,
  TTL_MOSQUES,
  TTL_ROUTE,
  get as cacheGet,
  getStale as cacheGetStale,
  prefGet,
  prefSet,
  set as cacheSet,
  startupClean,
} from './store';
import {
  ICON_CLOSE,
  ICON_DISTANCE,
  ICON_ERROR,
  ICON_LIST,
  ICON_LOADING,
  ICON_LOADING_BTN,
  ICON_LOCATE,
  ICON_MOSQUE,
  ICON_MOSQUE_BTN,
  ICON_ROUTE,
  ICON_ROUTE_BADGE,
  ICON_SEARCH,
  ICON_SUCCESS,
  MOSQUE_PIN_URL,
  wrapSvg,
} from './icons';
import type { MosqueLite, MosqueResult, RouteData, StatusTone } from './types';

export interface MosqueFinderProps {
  /** extra class on the component root (e.g. for sizing inside a view) */
  className?: string;
  /** where to sit until the first GPS fix / saved center (default: Karachi) */
  fallbackCenter?: { lat: number; lng: number };
  /** cap of mosques shown per search — nearest N only (default 10, keeps the map fast) */
  maxResults?: number;
  /** initial search radius in meters (default 5000) */
  defaultRadiusM?: number;
  /** start geolocation watch immediately on mount (default true) */
  autoStartLocation?: boolean;
}

/* ---- small render helpers ---- */
const cn = (...xs: Array<string | false | null | undefined>): string => xs.filter(Boolean).join(' ');

function Ico({ inner, vb = '0 0 24 24', style }: { inner: string; vb?: string; style?: React.CSSProperties }): React.ReactElement {
  return <svg viewBox={vb} xmlns="http://www.w3.org/2000/svg" style={style} dangerouslySetInnerHTML={{ __html: inner }} />;
}

type MarkerGlide = L.Marker & { __glide?: number | null };

interface ActiveRoute {
  m: MosqueResult;
  from: { lat: number; lng: number };
  route: RouteData;
  lastReroute: number;
  badge: string;
  badgeWarn: boolean;
}

interface Api {
  findMosques(): void;
  drawRoute(m: MosqueResult): void;
  clearRoute(): void;
  geocodeSearch(q: string): void;
  focusMosque(idx: number): void;
  openList(open: boolean): void;
  locateNow(): void;
}

export default function MosqueFinder({
  className,
  fallbackCenter = { lat: 24.8607, lng: 67.0011 }, // Karachi
  maxResults = 10,
  defaultRadiusM = 5000,
  autoStartLocation = true,
}: MosqueFinderProps): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const coneRef = useRef<HTMLDivElement>(null);
  const coneRotRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const compassArrowRef = useRef<SVGSVGElement>(null);

  const apiRef = useRef<Api | null>(null);
  const radiusRef = useRef<number>(defaultRadiusM); // slider → findMosques (no state round-trip)

  // ---- UI state (rendered by React) ----
  const [mosques, setMosques] = useState<MosqueResult[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [finding, setFinding] = useState(false);
  const [status, setStatus] = useState<{ tone: StatusTone; msg: string } | null>(null);
  const [routeBarHtml, setRouteBarHtml] = useState<string | null>(null);
  const [radiusM, setRadiusM] = useState(defaultRadiusM);
  const [searchText, setSearchText] = useState('');
  const [followOn, setFollowOn] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  const [rotateOn, setRotateOn] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // auto theme to match the OS (the standalone app was light-only; this plays
  // nicer inside a host app while keeping the exact same look)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const apply = (): void => setTheme(mq.matches ? 'dark' : 'light');
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // ==================== the whole map app lives in one mount effect ====================
  useEffect(() => {
    let mounted = true;

    startupClean();

    // ---------- mutable "globals" (were top-level lets in the HTML app) ----------
    let map: L.Map;
    let mosqueLayer: L.LayerGroup;
    let userMarker: MarkerGlide | null = null;
    let accuracyCircle: L.Circle | null = null;
    let routeLines: L.Polyline[] = [];
    let markers: L.Marker[] = [];
    let results: MosqueResult[] = [];
    let currentCenter: { lat: number; lng: number } = { ...fallbackCenter };
    let userPos: { lat: number; lng: number; acc: number } | null = null;
    let activeRoute: ActiveRoute | null = null;
    let watchId: number | null = null;
    let followMode = false;
    let statusTimer: ReturnType<typeof setTimeout> | null = null;
    let hintTimer: ReturnType<typeof setTimeout> | null = null;

    // navigation (arrow) mode
    let navMode = false;
    let navArrowEl: HTMLElement | null = null;
    let navHeadingDisp = 0;
    let gpsHeading: number | null = null;
    let lastFixPos: { lat: number; lng: number } | null = null;

    // heading / cone
    let headingDisp = 0;
    let lastOrientTs = 0;
    let orientAsked = false;
    let lastTrueHeading = 0;
    let lastAbsTs = 0;

    // rAF handles to cancel on unmount
    let glideRaf = 0;
    let compassRafPending = false;
    let bearingAnim = 0;

    const savedCenter = (() => {
      try {
        const c = JSON.parse(prefGet('center') || 'null') as { lat?: number; lng?: number } | null;
        if (c && typeof c.lat === 'number' && typeof c.lng === 'number') return { lat: c.lat, lng: c.lng };
      } catch {
        /* ignore */
      }
      return null;
    })();
    if (savedCenter) currentCenter = { lat: savedCenter.lat, lng: savedCenter.lng };

    // ---------- MAP (rotation enabled, with safe fallback) ----------
    const rotateSupported = typeof L.Map.prototype.setBearing === 'function';
    setRotateOn(rotateSupported);

    const mapOptions: L.MapOptions = {
      center: [currentCenter.lat, currentCenter.lng],
      zoom: 13,
      zoomControl: false, // clean UI — zoom via pinch / scroll only
    };
    if (rotateSupported) {
      Object.assign(mapOptions, {
        rotate: true,
        touchRotate: true, // two-finger rotate
        shiftKeyRotate: true, // shift + drag rotate
        rotateControl: false, // we draw our own (draggable) compass
        bearing: 0,
      });
    }
    map = L.map(mapDivRef.current as HTMLElement, mapOptions);

    if (!rotateSupported) {
      console.warn('[MosqueFinder] leaflet-rotate did not load; rotation is disabled.');
    }

    // ---------- LEAFLET-ROTATE ZOOM FIX ----------
    // Plugin bug: during a two-finger pinch+twist, 'rotate' fires every frame and
    // runs the vector renderer's full update — route lines slide off the road mid
    // gesture and snap back at the end. Fix: defer the rotate-triggered update
    // until moveend/zoomend whenever the map's zoom no longer matches the
    // renderer's content state.
    if (rotateSupported) {
      (function guardPlugin() {
        function guardRenderer(renderer: unknown) {
          const r = renderer as { __rotateGuarded?: boolean; _zoom?: number } | null;
          if (!r || r.__rotateGuarded) return;
          const events = (map as unknown as { _events?: Record<string, { ctx?: unknown; fn?: (e?: unknown) => void; __rotateGuard?: boolean }[]> })._events;
          if (!events || !events.rotate) return;
          r.__rotateGuarded = true;
          events.rotate.forEach((entry) => {
            if (entry.ctx !== r || entry.__rotateGuard) return;
            entry.__rotateGuard = true;
            const orig = entry.fn!;
            entry.fn = function (e?: unknown) {
              const rotMap = map as unknown as { _rotate?: boolean; _zoom?: number };
              if (rotMap._rotate && r._zoom !== undefined && rotMap._zoom !== r._zoom) {
                return; // mid zoom-gesture: keep the rigid scale transform intact
              }
              return orig.call(this, e);
            };
          });
        }
        map.on('layeradd', (e) => {
          const lyr = e.layer as { _renderer?: unknown };
          if (lyr && lyr._renderer) guardRenderer(lyr._renderer);
        });
        const own = (map as unknown as { _renderer?: unknown })._renderer;
        if (own) guardRenderer(own);
      })();
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      keepBuffer: 3, // pre-load tiles around viewport → smoother panning
      attribution: '© OpenStreetMap',
    }).addTo(map);

    mosqueLayer = L.layerGroup().addTo(map);

    // ---------- SIZE / CENTERING FIX ----------
    // In an app shell the container's real size may not be final when L.map()
    // runs (fonts, app bars, address-bar chrome). Force re-measures until things
    // settle, plus a live ResizeObserver — Leaflet then never renders shifted.
    function fixMapSize(): void {
      if (mounted) map.invalidateSize({ pan: false });
    }
    fixMapSize();
    requestAnimationFrame(fixMapSize);
    const sizeT1 = setTimeout(fixMapSize, 150);
    const sizeT2 = setTimeout(fixMapSize, 500);
    const onWinResize = (): void => fixMapSize();
    const onOrientationChange = (): void => {
      setTimeout(fixMapSize, 200);
    };
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onOrientationChange);
    window.visualViewport?.addEventListener('resize', fixMapSize);
    const ro = new ResizeObserver(fixMapSize);
    ro.observe(mapDivRef.current as HTMLElement);

    // ---------- ICONS ----------
    // Rasterized <img> pin (decode once, reuse bitmap while panning) — the
    // divIcon + CSS-filter version was the original lag source on mobile.
    const mosqueIcon = L.icon({
      iconUrl: MOSQUE_PIN_URL,
      iconSize: [36, 46],
      iconAnchor: [18, 44],
      popupAnchor: [0, -40],
    });

    const userIcon = L.divIcon({
      className: '',
      html: `<div class="mf-user-wrap">
        <div class="mf-user-glow"></div>
        <div class="mf-user-dot"></div>
      </div>`,
      iconSize: [72, 72],
      iconAnchor: [36, 36],
      popupAnchor: [0, -14],
    });
    // same anchor/size as the plain dot → the marker never "jumps" when swapping
    const userIconNav = L.divIcon({
      className: '',
      html: `<div class="mf-user-nav-wrap">
        <div class="mf-user-nav-halo"></div>
        <div class="mf-user-nav-disc"></div>
        <div class="mf-user-nav-arrow"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.6 L20.4 20.2 Q12.4 16.2 12 16.2 Q11.6 16.2 3.6 20.2 Z" fill="#1a73e8"/></svg></div>
      </div>`,
      iconSize: [72, 72],
      iconAnchor: [36, 36],
      popupAnchor: [0, -14],
    });

    // ---------- STATUS TOAST ----------
    function showStatus(tone: StatusTone, msg: string, hideAfter = 0): void {
      if (!mounted) return;
      setStatus({ tone, msg });
      if (statusTimer) clearTimeout(statusTimer);
      if (hideAfter) statusTimer = setTimeout(() => mounted && setStatus(null), hideAfter);
    }

    // ---------- SIDEBAR / DRAWER (mobile-only: hidden until ☰, visibility
    //            kills the zoom-out off-screen reveal — do not remove) ----------
    function openSidebar(): void {
      if (mounted) setSidebarOpen(true);
    }
    function closeSidebar(): void {
      if (mounted) setSidebarOpen(false);
    }

    // ---------- NAVIGATION ARROW (dot ⇄ arrow swap, driven by route state) ----------
    function currentMapBearing(): number {
      if (!rotateSupported) return 0;
      try {
        return map.getBearing() || 0;
      } catch {
        return 0;
      }
    }
    // arrow faces: device compass (if fresh) → GPS movement → straight at destination
    function navArrowHeading(): number {
      if (Date.now() - lastOrientTs < 5000) return lastTrueHeading;
      if (gpsHeading !== null) return gpsHeading;
      if (activeRoute) return bearingDeg(activeRoute.from.lat, activeRoute.from.lng, activeRoute.m.lat, activeRoute.m.lon);
      return lastTrueHeading;
    }
    function updateNavArrow(): void {
      if (!navMode || !navArrowEl) return;
      const screenTarget = (((navArrowHeading() - currentMapBearing()) % 360) + 360) % 360;
      const cur = ((navHeadingDisp % 360) + 360) % 360;
      const delta = ((screenTarget - cur) + 540) % 360 - 180; // shortest way round the dial
      navHeadingDisp += delta;
      navArrowEl.style.transform = `rotate(${navHeadingDisp}deg)`;
    }
    function setNavMode(on: boolean): void {
      navMode = on;
      if (userMarker) {
        userMarker.setIcon(on ? userIconNav : userIcon);
        const el = userMarker.getElement();
        navArrowEl = on && el ? el.querySelector<HTMLElement>('.mf-user-nav-arrow') : null;
      } else {
        navArrowEl = null;
      }
      const cone = coneRef.current;
      if (on) {
        // the arrow itself shows direction → hide the translucent fan while navigating
        cone?.classList.remove('mf-on');
        updateNavArrow();
      } else if (lastOrientTs) {
        cone?.classList.add('mf-on'); // restore the cone if the compass had been driving it
      }
    }

    // ---------- COMPASS CONE + HEADING ----------
    function positionCone(): void {
      if (!userMarker || !coneRef.current) return;
      const p = map.latLngToContainerPoint(userMarker.getLatLng());
      coneRef.current.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
    // the cone is an independent overlay on screen, so when the map rotates its
    // angle must be recomputed against the map bearing — otherwise the direction
    // appears reversed.
 function renderConeRotation(): void {
  if (!coneRotRef.current) return;
  const bearing = rotateSupported ? currentMapBearing() : 0;
  const screenTarget = ((lastTrueHeading - bearing) % 360 + 360) % 360;
      const cur = ((headingDisp % 360) + 360) % 360;
      const delta = ((screenTarget - cur) + 540) % 360 - 180;
      headingDisp += delta;
      coneRotRef.current.style.transform = `rotate(${headingDisp}deg)`;
    }
    function onMapRotate(): void {
      positionCone();
      renderConeRotation();
      updateNavArrow(); // arrow must keep its real-world direction while the map twists
    }
    map.on('move zoom rotate', positionCone);
map.on('rotate', onMapRotate);

    function applyHeading(h: number): void {
      lastTrueHeading = (((h % 360) + 360) % 360);
      renderConeRotation();
      if (!navMode) coneRef.current?.classList.add('mf-on'); // during navigation the arrow shows direction instead
      positionCone();
      updateNavArrow();
    }

    // posture-aware heading: phone lying flat → use the top edge; held upright
    // (like a compass app) → use the screen direction; smooth blend between both
    function postureHeading(alpha: number, beta?: number | null, gamma?: number | null): number {
      const r = (d: number | null | undefined) => ((d || 0) * Math.PI) / 180;
      const a = r(alpha);
      const b = r(beta);
      const g = r(gamma);
      const azY = -a;
      const E = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
      const N = Math.cos(a) * Math.sin(b) * Math.cos(g) - Math.sin(a) * Math.sin(g);
      const azZ = Math.atan2(E, N);
      const w = Math.min(1, Math.max(0, ((beta || 0) - 30) / 30)); // 0 = flat, 1 = upright
      let d = azZ - azY;
      d = (((d % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      const so = (screen.orientation && screen.orientation.angle) || (window as unknown as { orientation?: number }).orientation || 0;
      return ((((azY + d * w) * 180) / Math.PI + so) % 360 + 360) % 360;
    }

    type CompassOrientEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
    function onDeviceOrientation(e: Event): void {
      const ev = e as CompassOrientEvent;
      let h: number | null = null;
      if (typeof ev.webkitCompassHeading === 'number' && isFinite(ev.webkitCompassHeading)) {
        h = ev.webkitCompassHeading; // iOS: already clockwise-from-north
      } else if (ev.alpha != null && isFinite(ev.alpha)) {
        const isAbs = ev.absolute === true || ev.type === 'deviceorientationabsolute';
        if (isAbs) lastAbsTs = Date.now();
        else if (Date.now() - lastAbsTs < 2000) return; // absolute events arriving → ignore drifting relative events
        h = postureHeading(ev.alpha, ev.beta, ev.gamma);
      }
      if (h == null || isNaN(h)) return;
      lastOrientTs = Date.now();
      applyHeading((h + 360) % 360);
    }
    window.addEventListener('deviceorientationabsolute', onDeviceOrientation, true);
    window.addEventListener('deviceorientation', onDeviceOrientation, true);

    // ---------- USER LOCATION ----------
    function setFollow(on: boolean): void {
      followMode = on;
      if (mounted) setFollowOn(on);
    }

    function setUserPosition(lat: number, lng: number, accuracy: number): void {
      currentCenter = { lat, lng };
      // movement direction between fixes → feeds the nav arrow when there's no compass
      if (lastFixPos) {
        const moved = getDistance(lastFixPos.lat, lastFixPos.lng, lat, lng);
        if (moved > 4) gpsHeading = bearingDeg(lastFixPos.lat, lastFixPos.lng, lat, lng);
      }
      lastFixPos = { lat, lng };
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      } else {
        userMarker = L.marker([lat, lng], { icon: navMode ? userIconNav : userIcon, zIndexOffset: 500 })
          .addTo(map)
          .bindPopup('You are here');
        if (navMode) {
          const el = userMarker.getElement();
          navArrowEl = el ? el.querySelector<HTMLElement>('.mf-user-nav-arrow') : null;
        }
      }
      updateNavArrow();
      if (typeof accuracy === 'number' && accuracy > 0 && accuracy < 50000) {
        if (accuracyCircle) {
          accuracyCircle.setLatLng([lat, lng]).setRadius(accuracy);
        } else {
          accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#1a73e8',
            weight: 1,
            fillColor: '#1a73e8',
            fillOpacity: 0.08,
            interactive: false,
          }).addTo(map);
        }
      }
      positionCone();
    }

    function animateUserTo(lat: number, lng: number, accuracy: number): void {
      if (!userMarker) return setUserPosition(lat, lng, accuracy);
      const from = userMarker.getLatLng();
      const dist = getDistance(from.lat, from.lng, lat, lng);
      if (dist < 3) {
        userMarker.setLatLng([lat, lng]);
        positionCone();
        return;
      }
      if (userMarker.__glide) cancelAnimationFrame(userMarker.__glide);
      const t0 = performance.now();
      const dur = 900;
      const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      const step = (now: number): void => {
        if (!mounted || !userMarker) return;
        const t = Math.min(1, (now - t0) / dur);
        const e = easeInOutQuad(t);
        userMarker.setLatLng([from.lat + (lat - from.lat) * e, from.lng + (lng - from.lng) * e]);
        positionCone();
        userMarker.__glide = t < 1 ? (glideRaf = requestAnimationFrame(step)) : null;
      };
      glideRaf = requestAnimationFrame(step);
    }

    function updateRouteProgress(): void {
      if (!activeRoute || !userPos) return;
      const m = activeRoute.m;
      const movedFromStart = getDistance(userPos.lat, userPos.lng, activeRoute.from.lat, activeRoute.from.lng);
      let remain: string;
      if (activeRoute.route.s === 'osrm') {
        const r = Math.max(0, activeRoute.route.d - movedFromStart);
        const remainT = activeRoute.route.t && activeRoute.route.d ? Math.round((activeRoute.route.t * r) / activeRoute.route.d) : null;
        remain = `Remaining ${fmtDist(r)}${remainT ? ' • ' + fmtDur(remainT) : ''}`;
      } else {
        remain = `Remaining ${fmtDist(getDistance(userPos.lat, userPos.lng, m.lat, m.lon))}`;
      }
      if (mounted) {
        setRouteBarHtml(
          `${esc(m.name)} — <b>${remain}</b>` +
            (activeRoute.badge
              ? ` <span class="mf-badge${activeRoute.badgeWarn ? ' mf-warn' : ''}">${activeRoute.badge}</span>`
              : ''),
        );
      }
      // re-route silently after meaningful movement (throttled + cache-friendly)
      if (movedFromStart > 150 && Date.now() - activeRoute.lastReroute > 20000) {
        void rerouteSilently();
      }
    }

    async function rerouteSilently(): Promise<void> {
      if (!activeRoute || !userPos) return;
      const m = activeRoute.m;
      const from = { lat: userPos.lat, lng: userPos.lng };
      const cacheKey = `rt_${from.lat.toFixed(3)}_${from.lng.toFixed(3)}_${m.lat.toFixed(4)}_${m.lon.toFixed(4)}`;
      activeRoute.lastReroute = Date.now();
      let route = cacheGet<RouteData>(cacheKey, TTL_ROUTE);
      if (!route) {
        try {
          route = await fetchOSRMRoute(from, m);
          cacheSet(cacheKey, route);
        } catch {
          return; // keep showing the old route if offline
        }
      }
      if (!mounted || !activeRoute) return;
      activeRoute.route = route;
      activeRoute.from = from;
      const coords = route.c && route.c.length > 1 ? route.c : ([[from.lat, from.lng], [m.lat, m.lon]] as [number, number][]);
      routeLines.forEach((l) => map.removeLayer(l));
      routeLines = [];
      routeLines.push(L.polyline(coords, { color: '#0a3d2b', weight: 9, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(map));
      routeLines.push(
        L.polyline(coords, { color: '#22b573', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map),
      );
      updateRouteProgress();
    }

    // ---------- ROUTE ----------
    async function drawRoute(m: MosqueResult): Promise<void> {
      if (!userMarker) {
        showStatus('error', 'Get your location first using the 📍 button', 3500);
        return;
      }
      const from = userMarker.getLatLng();
      const cacheKey = `rt_${from.lat.toFixed(3)}_${from.lng.toFixed(3)}_${m.lat.toFixed(4)}_${m.lon.toFixed(4)}`;

      let route = cacheGet<RouteData>(cacheKey, TTL_ROUTE);
      let badge = 'Road Route';
      let badgeWarn = false;

      if (!route) {
        showStatus('loading', 'Calculating road route...');
        try {
          route = await fetchOSRMRoute({ lat: from.lat, lng: from.lng }, m);
          cacheSet(cacheKey, route);
        } catch {
          const stale = cacheGetStale<RouteData>(cacheKey, STALE_MAX);
          if (stale) {
            route = stale;
            badge = 'Road Route (old cache)';
            badgeWarn = true;
          } else {
            // straight-line fallback so the feature never dead-ends
            const d = getDistance(from.lat, from.lng, m.lat, m.lon);
            route = { d, t: null, c: null, s: 'straight' };
            badge = 'Straight Line (no route from server)';
            badgeWarn = true;
          }
        }
      }
      if (!mounted) return;

      const coords =
        route.c && route.c.length > 1 ? route.c : ([[from.lat, from.lng], [m.lat, m.lon]] as [number, number][]);

      clearRouteLayers();
      // casing + main line = smooth "navigation" look
      routeLines.push(L.polyline(coords, { color: '#0a3d2b', weight: 9, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(map));
      routeLines.push(
        L.polyline(coords, {
          color: '#22b573',
          weight: 5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: route.s === 'osrm' ? undefined : '10 10',
        }).addTo(map),
      );

      map.flyToBounds(L.latLngBounds(coords).pad(0.25), { duration: 0.8, easeLinearity: 0.25 });

      setRouteBarHtml(
        `${esc(m.name)} — <b>${fmtDist(route.d)}${route.t ? ' • ' + fmtDur(route.t) : ''}</b>` +
          ` <span class="mf-badge${badgeWarn ? ' mf-warn' : ''}">${badge}</span>`,
      );

      activeRoute = { m, from: { lat: from.lat, lng: from.lng }, route, lastReroute: Date.now(), badge, badgeWarn };
      setNavMode(true); // location dot → navigation arrow while the route runs
      showStatus('success', route.s === 'osrm' ? 'Road route is ready' : 'Straight-line distance shown', 2500);
    }

    function clearRouteLayers(): void {
      routeLines.forEach((l) => map.removeLayer(l));
      routeLines = [];
      activeRoute = null;
      setNavMode(false); // navigation arrow → back to the normal location dot
      if (mounted) setRouteBarHtml(null);
    }

    // ---------- FIND MOSQUES (nearest N only) ----------
    async function findMosques(): Promise<void> {
      if (mounted) setFinding(true);
      mosqueLayer.clearLayers();
      markers.forEach((mk) => map.removeLayer(mk));
      markers = [];

      const { lat, lng } = currentCenter;
      const radius = radiusRef.current;
      const cacheKey = `mq_${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`;

      let list = cacheGet<MosqueLite[]>(cacheKey, TTL_MOSQUES);
      let srcLabel = list ? ' (from cache)' : '';

      if (!list) {
        showStatus('loading', 'Searching for nearby mosques...');
        try {
          list = await fetchMosquesFromAPI(lat, lng, radius);
          cacheSet(cacheKey, list);
        } catch {
          const stale = cacheGetStale<MosqueLite[]>(cacheKey, STALE_MAX);
          if (stale) {
            list = stale;
            srcLabel = ' (offline cache)';
          } else {
            showStatus('error', 'Error: check your internet connection or the server', 4000);
            if (mounted) setFinding(false);
            return;
          }
        }
      }
      if (!mounted) return;

      const totalFound = list.length;
      const found: MosqueResult[] = list
        .map((m) => ({ ...m, distance: getDistance(lat, lng, m.lat, m.lon) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, Math.max(1, maxResults)); // nearest N only — map + list + routing share this set

      results = found;
      setMosques(found);

      if (!found.length) {
        showStatus('error', 'No nearby mosques found — try increasing the search radius', 3500);
        if (mounted) setFinding(false);
        return;
      }

      found.forEach((m, i) => {
        const marker = L.marker([m.lat, m.lon], { icon: mosqueIcon });
        marker.bindPopup(buildPopup(m, i));
        marker.addTo(mosqueLayer);
        markers.push(marker);
      });

      const group = L.featureGroup(mosqueLayer.getLayers());
      map.flyToBounds(group.getBounds().pad(0.15), { duration: 0.75, easeLinearity: 0.25 });

      showStatus(
        'success',
        totalFound > found.length
          ? `Showing nearest ${found.length} of ${totalFound} mosques found${srcLabel}`
          : `${found.length} nearby mosque${found.length > 1 ? 's' : ''} found${srcLabel}`,
        4000,
      );
      if (mounted) setFinding(false);
    }

    function buildPopup(m: MosqueResult, idx: number): string {
      return `
        <div class="mf-mosque-popup">
          <strong>${wrapSvg(ICON_MOSQUE)} ${esc(m.name)}</strong>
          <div class="mf-row">${wrapSvg(ICON_DISTANCE)} ${fmtDist(m.distance)} away (straight line)</div>
          <div class="mf-links">
            <a href="#" class="mf-popup-route" data-idx="${idx}">${wrapSvg(ICON_ROUTE)} Road Route</a>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}&travelmode=driving" target="_blank" rel="noopener">↗ Google Maps</a>
          </div>
        </div>
      `;
    }

    // route button inside popups
    map.on('popupopen', (e: L.PopupEvent) => {
      const el = e.popup.getElement ? e.popup.getElement() : null;
      if (!el) return;
      const btn = el.querySelector<HTMLElement>('.mf-popup-route');
      if (btn) {
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          const idx = parseInt(btn.dataset.idx || '-1', 10);
          map.closePopup();
          if (results[idx]) void drawRoute(results[idx]);
        });
      }
    });

    // ---------- PLACE SEARCH (Nominatim, cached + debounced) ----------
    async function doSearch(q: string): Promise<void> {
      if (!q || q.trim().length < 2) return;
      const query = q.trim();
      const cacheKey = 'gc_' + query.toLowerCase().slice(0, 64);

      let hit = cacheGet<{ lat: number; lng: number; label: string }>(cacheKey, TTL_GEOCODE);
      if (!hit) {
        showStatus('loading', 'Searching for place...');
        try {
          const g = await fetchGeocode(query);
          if (!g) {
            showStatus('error', 'Place not found', 2500);
            return;
          }
          hit = g;
          cacheSet(cacheKey, hit);
        } catch {
          showStatus('error', 'Something went wrong while searching', 2500);
          return;
        }
      }
      if (!mounted) return;
      currentCenter = { lat: hit.lat, lng: hit.lng };
      prefSet('center', JSON.stringify(currentCenter));
      map.flyTo([hit.lat, hit.lng], 14, { duration: 0.9 });
      showStatus('success', hit.label || 'Location found', 2200);
    }
    const debouncedSearch = debounce((v: string) => void doSearch(v), 400);

    // ---------- COMPASS (drag to rotate + smooth north reset) ----------
    let updateCompass = (): void => undefined;
    if (rotateSupported && compassRef.current && compassArrowRef.current) {
      const compassEl = compassRef.current;
      const compassArrowEl = compassArrowRef.current;

      if (mounted) {
        setHintOn(true);
        if (hintTimer) clearTimeout(hintTimer);
        hintTimer = setTimeout(() => mounted && setHintOn(false), 6000);
      }

      // smooth arrow updates (rAF-throttled, no CSS transition = zero lag)
      updateCompass = (): void => {
        if (compassRafPending) return;
        compassRafPending = true;
        requestAnimationFrame(() => {
          compassRafPending = false;
          let b = 0;
          try {
            b = map.getBearing() || 0;
          } catch {
            b = 0;
          }
          if (Number.isNaN(b)) b = 0;
          compassArrowEl.style.transform = `rotate(${-b}deg)`;
        });
      };
      map.on('rotate viewreset zoom move', updateCompass);
      updateCompass();

      // smooth animated reset to north
      function animateBearingTo(target: number, duration: number): void {
        cancelAnimationFrame(bearingAnim);
        const start = map.getBearing();
        let delta = (((target - start) % 360) + 540) % 360 - 180; // shortest direction
        if (Math.abs(delta) < 0.5) {
          map.setBearing(target);
          updateCompass();
          return;
        }
        const t0 = performance.now();
        const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const frame = (now: number): void => {
          const t = Math.min(1, (now - t0) / duration);
          map.setBearing(start + delta * easeInOutCubic(t));
          if (t < 1) bearingAnim = requestAnimationFrame(frame);
        };
        bearingAnim = requestAnimationFrame(frame);
      }

      // drag the compass with your finger / mouse to rotate the map
      let drag: { a0: number; b0: number; moved: number; t0: number } | null = null;
      const angleAt = (e: PointerEvent): number => {
        const r = compassEl.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return (Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180) / Math.PI;
      };
      const onPointerDown = (e: PointerEvent): void => {
        cancelAnimationFrame(bearingAnim);
        drag = { a0: angleAt(e), b0: map.getBearing(), moved: 0, t0: performance.now() };
        compassEl.setPointerCapture(e.pointerId);
        compassEl.classList.add('mf-grabbing');
        e.preventDefault();
      };
      const onPointerMove = (e: PointerEvent): void => {
        if (!drag) return;
        let d = angleAt(e) - drag.a0;
        d = ((d % 360) + 540) % 360 - 180; // wrap so crossing 180° stays stable
        if (Math.abs(d) > 2) drag.moved = Math.abs(d);
        map.setBearing(drag.b0 - d); // needle follows the finger (plugin convention)
      };
      const onPointerUp = (): void => {
        if (!drag) return;
        const wasTap = performance.now() - drag.t0 < 300 && !drag.moved;
        drag = null;
        compassEl.classList.remove('mf-grabbing');
        if (wasTap) animateBearingTo(0, 450); // light tap → smooth return to north
      };
      compassEl.addEventListener('pointerdown', onPointerDown);
      compassEl.addEventListener('pointermove', onPointerMove);
      compassEl.addEventListener('pointerup', onPointerUp);
      compassEl.addEventListener('pointercancel', onPointerUp);
    }

    // ---------- LOCATION WATCH ----------
    function onWatchPosition(pos: GeolocationPosition): void {
      if (!mounted) return;
      const { latitude, longitude, accuracy } = pos.coords;
      const prev = userPos;
      let moved = 0;
      if (prev) {
        moved = getDistance(prev.lat, prev.lng, latitude, longitude);
        // ignore GPS jitter: sub-1.5m "movement" with equal-or-worse accuracy
        if (moved < 1.5 && (accuracy || 1e9) >= (prev.acc || 0)) return;
      }
      userPos = { lat: latitude, lng: longitude, acc: accuracy };

      // no compass on this device (e.g. desktop)? point the cone where we're walking
      if (prev && moved >= 3 && Date.now() - lastOrientTs > 4000) {
        applyHeading(bearingDeg(prev.lat, prev.lng, latitude, longitude));
      }

      if (!userMarker) {
        setUserPosition(latitude, longitude, accuracy);
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 1.0 });
        showStatus('success', 'Location found — live tracking active', 2500);
      } else {
        animateUserTo(latitude, longitude, accuracy);
        // auto-follow while navigating (stops when user pans the map manually)
        if (followMode && moved >= 5) {
          map.panTo([latitude, longitude], { animate: true, duration: 0.6 });
        }
      }
      updateRouteProgress();
    }

    function onWatchError(err: GeolocationPositionError): void {
      const msgs: Record<number, string> = {
        1: 'Location permission not granted — allow it in your browser settings',
        2: 'Position unavailable — type an area in the search box above',
        3: 'Location timed out — please try again',
      };
      // Fatal errors (1/2) stop the watch permanently per Geolocation spec —
      // clear watchId so the 📍 button can start a fresh attempt on next click.
      if (err.code === 1 || err.code === 2) watchId = null;
      showStatus('error', msgs[err.code] || 'Location not found: ' + (err.message || 'unknown error'), 4000);
    }

    function startLocationWatch(): void {
      if (!navigator.geolocation) {
        showStatus('error', 'Browser does not support location', 3000);
        return;
      }
      if (watchId !== null) return; // already tracking
      showStatus('loading', 'Getting your location...');
      watchId = navigator.geolocation.watchPosition(onWatchPosition, onWatchError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      });
    }

    function locateNow(): void {
      startLocationWatch();
      setFollow(true);
      // iOS 13+: compass needs a user gesture to be permitted
      if (!orientAsked && typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function') {
        orientAsked = true;
        try {
          (DeviceOrientationEvent as unknown as { requestPermission(): Promise<PermissionState> }).requestPermission().catch(() => undefined);
        } catch {
          /* ignore */
        }
      }
      if (userPos) {
        map.flyTo([userPos.lat, userPos.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
      }
    }

    // panning the map by hand stops auto-follow (standard map-app behaviour)
    map.on('dragstart', () => setFollow(false));

    // ---------- MAP CENTER TRACKING ----------
    map.on('moveend', () => {
      const c = map.getCenter();
      currentCenter = { lat: c.lat, lng: c.lng };
    });

    // ---------- RADIUS (restore persisted preference; slider writes radiusRef) ----------
    const savedRadius = parseInt(prefGet('radius') || '', 10);
    if (Number.isFinite(savedRadius) && savedRadius >= 500 && savedRadius <= 15000 && savedRadius !== radiusRef.current) {
      radiusRef.current = savedRadius;
      setRadiusM(savedRadius);
    }

    // ---------- EXPOSED API for the React layer ----------
    apiRef.current = {
      findMosques: () => void findMosques(),
      drawRoute: (m) => void drawRoute(m),
      clearRoute: () => clearRouteLayers(),
      geocodeSearch: (q) => debouncedSearch(q),
      focusMosque: (idx) => {
        const m = results[idx];
        if (!m) return;
        map.flyTo([m.lat, m.lon], 16, { duration: 0.9, easeLinearity: 0.25 });
        const mk = markers[idx];
        // guard inside the timer too: a new search/unmount may have removed the marker by then
        if (mk) setTimeout(() => mounted && mk && map.hasLayer(mk) && mk.openPopup(), 650);
        closeSidebar();
      },
      openList: (open) => (open ? openSidebar() : closeSidebar()),
      locateNow,
    };

    // ---------- STARTUP ----------
    setFollow(true);
    if (autoStartLocation) startLocationWatch();

    // ---------- CLEANUP ----------
    return () => {
      mounted = false;
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.visualViewport?.removeEventListener('resize', fixMapSize);
      window.removeEventListener('deviceorientationabsolute', onDeviceOrientation, true);
      window.removeEventListener('deviceorientation', onDeviceOrientation, true);
      if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      if (userMarker?.__glide) cancelAnimationFrame(userMarker.__glide);
      cancelAnimationFrame(glideRaf);
      cancelAnimationFrame(bearingAnim);
      if (statusTimer) clearTimeout(statusTimer);
      if (hintTimer) clearTimeout(hintTimer);
      clearTimeout(sizeT1);
      clearTimeout(sizeT2);
      if (rotateSupported) map.off('rotate viewreset zoom move', updateCompass);
      ro.disconnect();
      apiRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: the map app boots once per mount
  }, []);

  // ==================== render ====================
  const sidebarCount = mosques.length
    ? `Nearest ${mosques.length} mosque${mosques.length > 1 ? 's' : ''} found`
    : 'No results';

  return (
    <div ref={rootRef} className={cn('mf-root', className)} data-theme={theme}>
      <div ref={mapDivRef} className="mf-map" />

      {/* compass fan overlay (independent of the map panes) */}
      <div className="mf-user-cone" ref={coneRef}>
        <div className="mf-user-cone-rot" ref={coneRotRef}>
          <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
            <path d="M36 36 L20 9 A32 32 0 0 1 52 9 Z" fill="rgba(26,115,232,0.25)" />
            <path d="M36 36 L27 15 A21 21 0 0 1 45 15 Z" fill="rgba(26,115,232,0.35)" />
          </svg>
        </div>
      </div>

      {/* drawer backdrop */}
      <div
        className={cn('mf-sidebar-backdrop', sidebarOpen && 'mf-show')}
        onClick={() => apiRef.current?.openList(false)}
      />

      {/* top bar: place search + in-pill ☰ list button */}
      <div className="mf-top-bar">
        <div className="mf-search-box">
          <Ico inner={ICON_SEARCH} />
          <input
            type="text"
            placeholder="Type an area, city or place name..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              apiRef.current?.geocodeSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apiRef.current?.geocodeSearch(searchText);
              }
            }}
          />
          <button
            type="button"
            className="mf-search-list-btn"
            title="View list"
            onClick={() => apiRef.current?.openList(!sidebarOpen)}
          >
            <Ico inner={ICON_LIST} />
          </button>
        </div>
      </div>

      {/* my-location FAB */}
      <button
        type="button"
        className={cn('mf-icon-btn', 'mf-loc-fab', followOn && 'mf-following')}
        title="My location"
        onClick={() => apiRef.current?.locateNow()}
      >
        <Ico inner={ICON_LOCATE} />
      </button>

      {/* route bar (top) */}
      <div className={cn('mf-route-bar', routeBarHtml && 'mf-show')}>
        <div className="mf-info">
          <Ico inner={ICON_ROUTE_BADGE} />
          <span dangerouslySetInnerHTML={{ __html: routeBarHtml || '' }} />
        </div>
        <button type="button" onClick={() => apiRef.current?.clearRoute()}>
          <Ico inner={ICON_CLOSE} />
        </button>
      </div>

      {/* status toast (rides under the route bar when one is shown) */}
      <div className={cn('mf-status', status && 'mf-show', routeBarHtml && 'mf-below-route')}>
        {status && <Ico inner={status.tone === 'loading' ? ICON_LOADING : status.tone === 'success' ? ICON_SUCCESS : ICON_ERROR} />}
        {status && <span>{status.msg}</span>}
      </div>

      {/* compass hint (base CSS is opacity:0 — .mf-show fades it in for 6s) */}
      <div className={cn('mf-compass-hint', hintOn && 'mf-show')}>
        Grab the compass with your finger and rotate • Light tap = face north • The map can also be rotated with two fingers
      </div>
      <div
        className="mf-compass"
        ref={compassRef}
        title="Drag to rotate the map — tap for north"
        style={rotateOn ? undefined : { display: 'none' }}
      >
        <span className="mf-n-label">N</span>
        <svg ref={compassArrowRef} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2 L15 12 L12 10 L9 12 Z" fill="#b1432f" />
          <path d="M12 22 L9 12 L12 14 L15 12 Z" fill="#8a8a8a" />
        </svg>
      </div>

      {/* radius + find */}
      <div className="mf-radius-panel">
        <div className="mf-radius-card">
          <div className="mf-radius-row">
            <span className="mf-label">
              <Ico inner={ICON_DISTANCE} style={{ width: 14, height: 14, fill: 'var(--accent)' }} />
              Search Radius
            </span>
            <span className="mf-value">{radiusM < 1000 ? radiusM + ' m' : (radiusM / 1000).toFixed(1) + ' km'}</span>
          </div>
          <input
            type="range"
            min={500}
            max={15000}
            step={500}
            value={radiusM}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              radiusRef.current = v;
              setRadiusM(v);
              prefSet('radius', String(v));
            }}
          />
          <button type="button" className="mf-find-btn" disabled={finding} onClick={() => apiRef.current?.findMosques()}>
            <Ico inner={finding ? ICON_LOADING_BTN : ICON_MOSQUE_BTN} />
            {finding ? ' Searching...' : ' Find Nearby Mosques'}
          </button>
        </div>
      </div>

      {/* mosque list drawer — hidden until ☰, per mobile-only spec */}
      <aside className={cn('mf-sidebar', sidebarOpen && 'mf-open')}>
        <div className="mf-sidebar-header">
          <div>
            <h2>Mosque List</h2>
            <div className="mf-count">{sidebarCount}</div>
          </div>
          <button type="button" className="mf-sidebar-close" onClick={() => apiRef.current?.openList(false)}>
            <Ico inner={ICON_CLOSE} />
          </button>
        </div>
        <div className="mf-sidebar-list">
          {mosques.length === 0 ? (
            <div className="mf-sidebar-empty">Tap the button below to find nearby mosques</div>
          ) : (
            mosques.map((m, i) => (
              <div
                key={`${m.lat},${m.lon}`}
                className="mf-mosque-card"
                onClick={() => apiRef.current?.focusMosque(i)}
              >
                <div className="mf-name">
                  <Ico inner={ICON_MOSQUE} />
                  {m.name}
                </div>
                <div className="mf-meta">
                  <span>
                    <Ico inner={ICON_DISTANCE} />
                    {fmtDist(m.distance)}
                  </span>
                </div>
                <div className="mf-actions">
                  <a
                    href="#"
                    className="mf-route-link"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      apiRef.current?.drawRoute(m);
                      apiRef.current?.openList(false);
                    }}
                  >
                    <Ico inner={ICON_ROUTE} /> Road Route
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ↗ Google Maps
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
