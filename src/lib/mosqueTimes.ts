import type { Mosque } from '../types';
import { computeDay, DEFAULT_PRAYER_CONFIG, PRAYER_NAMES } from './prayerEngine';
import type { PrayerName } from './prayerEngine';
import { pickSchedule, resolveIqama } from './iqama';
import type { IqamaSchedule } from './iqama';
import { getHijriMath } from '../constants/hijri';

export type JamaatOffsets = Record<PrayerName, number>;
const DEFAULT_DELAYS: JamaatOffsets = { fajr: 15, zuhr: 15, asr: 15, maghrib: 5, isha: 15 };
export type MosqueTimingInput = Pick<Mosque, 'latitude' | 'longitude' | 'prayerConfig' | 'iqamaSchedule' | 'iqamaHistory' | 'fajrOffset' | 'zuhrOffset' | 'asrOffset' | 'maghribOffset' | 'ishaOffset'>;

export function mosqueDate(now = new Date(), timeZone = 'Asia/Karachi') {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
  // prayerEngine reads local calendar fields; supply the mosque's calendar date.
  return { dateKey, date: new Date(Number(get('year')), Number(get('month')) - 1, Number(get('day')), 12) };
}

/** Keep the offset editor's delays in sync without deleting explicit fixed/daily rules. */
export function scheduleWithOffsets(schedule: IqamaSchedule, offsets: JamaatOffsets): IqamaSchedule {
  const iqama = { ...schedule.iqama };
  for (const prayer of PRAYER_NAMES) iqama[prayer] = { ...iqama[prayer], delay: offsets[prayer] };
  return { ...schedule, iqama };
}

/** One calculation path shared by the imam preview and public mosque cards. */
export function calculateMosqueTimes(mosque: MosqueTimingInput, now = new Date()) {
  if (!Number.isFinite(mosque.latitude) || !Number.isFinite(mosque.longitude) || Math.abs(mosque.latitude) > 90 || Math.abs(mosque.longitude) > 180) throw new Error('Invalid mosque coordinates');
  const config = { ...DEFAULT_PRAYER_CONFIG, ...mosque.prayerConfig, timeZone: mosque.prayerConfig?.timeZone || 'Asia/Karachi' };
  const { dateKey, date } = mosqueDate(now, config.timeZone);
  const adhan = computeDay(mosque.latitude, mosque.longitude, date, config);
  if (Object.values(adhan).some(value => !/^\d{2}:\d{2}$/.test(value))) throw new Error('Prayer times could not be calculated');
  const offsets = {} as JamaatOffsets;
  for (const prayer of PRAYER_NAMES) {
    const value = mosque[`${prayer}Offset`];
    offsets[prayer] = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_DELAYS[prayer];
  }
  const fallback = scheduleWithOffsets({ effectiveFrom: '1970-01-01' }, offsets);
  // Current schedule wins ties; dated historical/future rules remain supported.
  const active = pickSchedule([...(mosque.iqamaSchedule ? [mosque.iqamaSchedule] : []), ...(mosque.iqamaHistory || [])], dateKey);
  const schedule = active ? { ...active, iqama: { ...fallback.iqama, ...active.iqama } } : fallback;
  const jamaat = resolveIqama(schedule, dateKey, adhan, { isRamadan: getHijriMath(date).hMonth === 9 });
  return { adhan, jamaat, dateKey };
}
