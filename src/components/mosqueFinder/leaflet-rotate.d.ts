/* Minimal typings for leaflet-rotate@0.2.8 (no types shipped). */
import 'leaflet';

declare module 'leaflet' {
  interface Map {
    setBearing(bearing: number): this;
    getBearing(): number;
  }
  interface MapOptions {
    rotate?: boolean;
    touchRotate?: boolean;
    shiftKeyRotate?: boolean;
    rotateControl?: boolean;
    bearing?: number;
    pitch?: number;
  }
}

declare module 'leaflet-rotate' {
  const x: unknown;
  export default x;
}
