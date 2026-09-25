// ============ TIME UTILITY FUNCTIONS ============

export const formatTo12Hour = (timeStr?: string, defaultVal = ''): string => {
  const target = timeStr || defaultVal;
  if (!target) return '';
  if (target.toLowerCase().includes('am') || target.toLowerCase().includes('pm')) {
    return target;
  }
  const parts = target.split(':');
  if (parts.length < 2) return target;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return target;
  const suffix = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

export const parseTimeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// مسجد میں نماز ظہر فلکیاتی (Aladhan) وقت سے کچھ دیر بعد شروع ہوتی ہے، اور کم از کم
// اتنے وقت (دوپہر 1:15) سے پہلے کبھی شروع نہیں ہوتی۔ اس کے بعد بھی 15 منٹ تک
// "ابھی ظہر کا وقت ہے" ہی دکھایا جائے، چاہے فلکیاتی عصر شروع ہو چکی ہو، تاکہ
// کارڈ فلکیاتی وقت کراس ہوتے ہی فوراً عصر کی طرف نہ کود جائے۔
const ZUHR_MIN_START_MINS = 13 * 60 + 15; // 1:15 PM
const ZUHR_JAMAAT_WINDOW_MINS = 15;

export const getCurrentPrayer = (prayerTimes: { [key: string]: string }): string => {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const times = {
    fajr: parseTimeToMinutes(prayerTimes.fajr),
    zuhr: parseTimeToMinutes(prayerTimes.zuhr),
    asr: parseTimeToMinutes(prayerTimes.asr),
    maghrib: parseTimeToMinutes(prayerTimes.maghrib),
    isha: parseTimeToMinutes(prayerTimes.isha)
  };

  // مسجد کے حساب سے ظہر کا اصل آغاز: فلکیاتی وقت اور 1:15 PM میں جو بعد میں ہو۔
  const zuhrMasjidStart = Math.max(times.zuhr, ZUHR_MIN_START_MINS);
  // اس آغاز کے بعد کم از کم 15 منٹ تک ظہر ہی رہے (چاہے فلکیاتی عصر آ چکی ہو)۔
  const zuhrMasjidEnd = zuhrMasjidStart + ZUHR_JAMAAT_WINDOW_MINS;

  if (nowMins >= times.isha || nowMins < times.fajr) return 'isha';
  if (nowMins >= times.maghrib) return 'maghrib';
  if (nowMins >= zuhrMasjidEnd) return 'asr';
  if (nowMins >= zuhrMasjidStart) return 'zuhr';
  return 'fajr';
};
