import type { PrayerConfig } from './lib/prayerEngine';
import type { IqamaSchedule, JumuahSlot } from './lib/iqama';

export interface PrayerTimes {
  fajr: string;
  zuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface Mosque {
  id: string;
  name: string;
  imamName: string;
  imamEmail: string;
  imamUid: string;
  address: string;
  latitude: number;
  longitude: number;

  // ── جماعت کے اوقات (امام ایک بار سیٹ کرے) ──
  fajr: string;
  zuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  jumah: string;
  jumah2?: string;
  eidFitr?: string;
  eidAdha?: string;
  sehri?: string;
  iftar?: string;
  announcement?: string;
  updatedAt: string;

  // ── API offset: اذان وقت میں ±منٹ adjustment ──
  // امام ایک بار سیٹ کرے، پھر ہر روز API + offset = صحیح وقت
  fajrOffset?: number;
  zuhrOffset?: number;
  asrOffset?: number;
  maghribOffset?: number;
  ishaOffset?: number;

  // ── نیا: اذان کے اوقات کی سیٹنگ (امام ایک بار سیٹ کرے) ──
  prayerConfig?: PrayerConfig;        // طریقہ + مشرب + زاویے + فی نماز ±منٹ
  iqamaSchedule?: IqamaSchedule;      // جماعت: اذان+منٹ یا مقررہ گھڑی، رمضان، جمعہ
  iqamaHistory?: IqamaSchedule[];     // آئندہ/پرانی ترتیبیں
  jumuah?: JumuahSlot[];              // ایک سے زیادہ جمعے
  calibration?: {                     // آخری کیلیبریشن کی جانچ
    at: string;
    samples: number;
    worstError: number;
    rmse: number;
    method: string;
    madhab: 'hanafi' | 'shafi';
  };
}

export interface Surah {
  n: number;
  ar: string;
  ur: string;
  v: number;
  t: string;
}

export interface HadithBook {
  key: string;
  name: string;
  ar: string;
  total: number;
  icon?: string;
  ar_url: string;
  ur_url: string;
}

export interface Hadith {
  num: string | number;
  ar: string;
  ur: string;
  grades?: { name: string; grade: string }[];
}

export interface NamazStep {
  s: number;
  t: string;
  ar: string;
  ur: string;
}

export interface Dua {
  c: string;
  ar: string;
  ur: string;
}


