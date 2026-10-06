// Public JSON only. No GitHub API token, Firebase, or OpenDua API dependency.
export const DUA_REPO = 'RochTools/duas-api';
// Pin a reviewed Git commit/tag here for an immutable production release.
export const DUA_REF = 'main';
export const DUA_LANGUAGES = [
  { code: 'ar', label: 'العربية', name: 'Arabic', dir: 'rtl' },
  { code: 'en', label: 'English', name: 'English', dir: 'ltr' },
  { code: 'ur', label: 'اردو', name: 'Urdu', dir: 'rtl' },
  { code: 'hi', label: 'हिन्दी', name: 'Hindi', dir: 'ltr' },
] as const;
export type DuaLanguage = typeof DUA_LANGUAGES[number]['code'];
export interface DuaPart { arabic: string; transliteration?: string | null; en?: string | null; times?: number | null }
export interface DatasetReference { reference: string; workId?: string; grades?: { value: string; gradedBy?: string }[] }
export interface CdnDua {
  id: string; number: number; title: string; arabic: string; text: string;
  textKind: string; translationKind: string; translationSource?: string;
  transliteration?: string | null; repeat?: number | null; parts?: DuaPart[] | null;
  placeholders?: { key: string; instruction: string }[] | null;
  reference?: { sourceReference?: string; references?: DatasetReference[] };
  guidance?: string | null;
}
export interface CdnChapter { id: number; title: string; titleArabic: string; slug: string; tags: string[]; duas: CdnDua[] }
export interface DuaDataset {
  meta: { dataset: string; version: string; language: DuaLanguage; languageName: string; direction: 'rtl' | 'ltr'; generatedAt?: string; counts: { chapters: number; duas: number }; attribution?: string; license?: { dataset?: string; notes?: string[] } };
  chapters: CdnChapter[];
}
export interface DuaDatasetResult { data: DuaDataset; via: 'cdn' | 'github' | 'cache'; savedAt: number; stale: boolean }
const KEY = `steptudeen_dua_repo_v1:${DUA_REF}:`;
const TTL = 6 * 60 * 60 * 1000;
const memory = new Map<DuaLanguage, DuaDatasetResult>();
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const stringOrNull = (v: unknown) => v === undefined || v === null || typeof v === 'string';
const repetition = (v: unknown) => v === undefined || v === null || Number.isInteger(v) && Number(v) > 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');

export function validateDuaDataset(value: unknown, language: DuaLanguage): value is DuaDataset {
  if (!record(value) || !record(value.meta) || !Array.isArray(value.chapters)) return false;
  const meta = value.meta;
  if (meta.dataset !== 'duas' || meta.language !== language || !['rtl','ltr'].includes(meta.direction) || typeof meta.version !== 'string' || typeof meta.languageName !== 'string' || !record(meta.counts)) return false;
  if (!stringOrNull(meta.attribution) || !stringOrNull(meta.generatedAt)) return false;
  if (meta.license && (!record(meta.license) || !stringOrNull(meta.license.dataset) || meta.license.notes !== undefined && !strings(meta.license.notes))) return false;
  const ids = new Set<string>(); const chapters = new Set<number>(); let total = 0;
  for (const chapter of value.chapters) {
    if (!record(chapter) || !Number.isInteger(chapter.id) || chapters.has(chapter.id) || typeof chapter.title !== 'string' || typeof chapter.titleArabic !== 'string' || typeof chapter.slug !== 'string' || !strings(chapter.tags) || !Array.isArray(chapter.duas)) return false;
    chapters.add(chapter.id);
    for (const dua of chapter.duas) {
      if (!record(dua) || typeof dua.id !== 'string' || ids.has(dua.id) || !Number.isInteger(dua.number) || !['title','arabic','text','textKind','translationKind'].every(k => typeof dua[k] === 'string')) return false;
      if (!stringOrNull(dua.transliteration) || !stringOrNull(dua.translationSource) || !stringOrNull(dua.guidance) || !repetition(dua.repeat)) return false;
      if (dua.parts != null && (!Array.isArray(dua.parts) || !dua.parts.every((p: unknown) => record(p) && typeof p.arabic === 'string' && stringOrNull(p.transliteration) && stringOrNull(p.en) && repetition(p.times)))) return false;
      if (dua.placeholders != null && (!Array.isArray(dua.placeholders) || !dua.placeholders.every((p: unknown) => record(p) && typeof p.key === 'string' && typeof p.instruction === 'string'))) return false;
      if (dua.reference != null) {
        if (!record(dua.reference) || !stringOrNull(dua.reference.sourceReference)) return false;
        const refs = dua.reference.references;
        if (refs !== undefined && (!Array.isArray(refs) || !refs.every((r: unknown) => record(r) && typeof r.reference === 'string' && (r.grades === undefined || Array.isArray(r.grades) && r.grades.every((g: unknown) => record(g) && typeof g.value === 'string' && stringOrNull(g.gradedBy)))))) return false;
      }
      ids.add(dua.id); total++;
    }
  }
  return meta.counts.chapters === chapters.size && meta.counts.duas === total;
}
export function duaDatasetUrls(language: DuaLanguage) {
  if (!DUA_LANGUAGES.some(item => item.code === language)) throw new Error('Unsupported language.');
  const path = `data/${language}/duas.json`;
  return { cdn: `https://cdn.jsdelivr.net/gh/${DUA_REPO}@${DUA_REF}/${path}`, github: `https://raw.githubusercontent.com/${DUA_REPO}/${DUA_REF}/${path}` };
}
function cached(language: DuaLanguage): DuaDatasetResult | null {
  try {
    const saved = memory.get(language) || JSON.parse(localStorage.getItem(KEY + language) || 'null');
    return saved && typeof saved.savedAt === 'number' && validateDuaDataset(saved.data, language) ? saved : null;
  } catch { return memory.get(language) || null; }
}
async function request(url: string, language: DuaLanguage, parent: AbortSignal): Promise<DuaDataset> {
  if (parent.aborted) throw new DOMException('Aborted', 'AbortError');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  parent.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    if (!validateDuaDataset(data, language)) throw new Error('The JSON format or language does not match this library.');
    return data;
  } finally { clearTimeout(timer); parent.removeEventListener('abort', cancel); }
}
export async function loadDuaDataset(language: DuaLanguage, signal: AbortSignal, refresh = false): Promise<DuaDatasetResult> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const urls = duaDatasetUrls(language);
  const stored = cached(language);
  if (!refresh && stored && Date.now() - stored.savedAt < TTL) return { ...stored, via: 'cache', stale: false };
  // Manual Refresh checks GitHub first: @main may remain cached at the CDN edge.
  const order: ('cdn' | 'github')[] = refresh ? ['github', 'cdn'] : ['cdn', 'github'];
  for (const via of order) {
    try {
      const data = await request(urls[via], language, signal);
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const result: DuaDatasetResult = { data, via, savedAt: Date.now(), stale: false };
      memory.set(language, result);
      try { localStorage.setItem(KEY + language, JSON.stringify(result)); } catch { /* Keep in-memory copy; do not delete other app data. */ }
      return result;
    } catch {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    }
  }
  if (stored) return { ...stored, via: 'cache', stale: true };
  throw new Error('The dua library could not be loaded from the CDN or GitHub. Check your connection and retry.');
}
