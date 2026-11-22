/* APK کی ہوسٹنگ: GitHub Releases۔ ہر بلڈ ایک نیا release (tag: build-<نمبر>) بناتا ہے۔ */
export const APK_REPO = 'RochTools/steptudeen';
export const APK_URL = `https://github.com/${APK_REPO}/releases/latest/download/steptudeen.apk`;
export const LATEST_RELEASE_API = `https://api.github.com/repos/${APK_REPO}/releases/latest`;

/** اس ایپ کا بلڈ نمبر (workflow میں VITE_BUILD_NUMBER = GitHub run number)۔ ویب پر 0۔ */
export const BUILD_NUMBER: number = Number((import.meta as any).env?.VITE_BUILD_NUMBER || 0) || 0;

/** Android Chrome پر: ایپ انسٹال ہو تو کھل جائے، ورنہ خود APK ڈاؤن لوڈ۔ */
export const APK_OPEN_OR_DOWNLOAD_URL =
  `intent://open#Intent;scheme=steptudeen;package=com.steptudeen.app;S.browser_fallback_url=${encodeURIComponent(APK_URL)};end`;
