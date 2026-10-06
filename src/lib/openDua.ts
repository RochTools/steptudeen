// OpenDua v2 public read-only API. No API key or Firebase access is required.
export const OPEN_DUA_ORIGIN = 'https://api.opendua.org';
export const OPEN_DUA_COLLECTION = 'hisn-al-muslim';
export interface DuaReference { workId?: string; reference: string; grades?: { value: string; gradedBy?: string }[] }
export interface CanonicalDua {
  id: string; arabic: string; transliteration: string; translation: string;
  references: DuaReference[]; placeholders?: { key: string; instruction: string }[];
}
export type DuaStep =
  | { type: 'instruction' | 'narration'; arabic?: string; text: string; references?: DuaReference[] }
  | { type: 'recitation'; condition?: string; speaker?: string; items: { dua: CanonicalDua; times?: number }[]; references?: DuaReference[] }
  | { type: 'repeat'; times: number; steps: DuaStep[]; references?: DuaReference[] };
export interface DuaVariation { id: string; label?: string; condition?: string; references?: DuaReference[]; steps: DuaStep[] }
export interface DuaSummary { id: string; slug: string; title: string; type: 'invocation' | 'instruction' | 'narration'; sourceReference?: string }
export interface DuaEntry extends DuaSummary { collectionId: string; chapterId?: string; tags: string[]; references: DuaReference[]; variations?: DuaVariation[]; steps?: DuaStep[] }
export interface DuaChapter { id: string; number?: number; title: string; entryCount: number }
export interface DuaApiInfo { dataVersion: string; counts: { chapters: number; entries: number; duas: number }; licences?: { data?: { name: string; url: string } } }
export interface ApiResult<T> { data: T; cached: boolean; savedAt: number }
interface CacheRecord { data: unknown; savedAt: number }
const PREFIX = 'steptudeen_opendua_v2:';
const FRESH_MS = 60 * 60 * 1000;
const memory = new Map<string, CacheRecord>();

function readCache(path: string): CacheRecord | null {
  try {
    const value = memory.get(path) || JSON.parse(localStorage.getItem(PREFIX + path) || 'null');
    return value && typeof value.savedAt === 'number' && value.data ? value : null;
  } catch { return memory.get(path) || null; }
}
function saveCache(path: string, record: CacheRecord) {
  memory.delete(path); memory.set(path, record);
  if (memory.size > 90) memory.delete(memory.keys().next().value!);
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(PREFIX));
    if (keys.length >= 90) {
      const oldest = keys.map(key => {
        try { return { key, at: JSON.parse(localStorage.getItem(key) || '{}').savedAt || 0 }; }
        catch { return { key, at: 0 }; }
      }).sort((a, b) => a.at - b.at).slice(0, keys.length - 85);
      oldest.forEach(item => localStorage.removeItem(item.key));
    }
    localStorage.setItem(PREFIX + path, JSON.stringify(record));
  } catch { /* Quota/privacy mode must never stop reading. Only this feature's cache is touched. */ }
}

export async function openDuaRequest<T>(path: string, signal: AbortSignal, validate: (value: unknown) => value is T, force = false): Promise<ApiResult<T>> {
  if (!path.startsWith('/v2/') && path !== '/v2') throw new Error('Invalid OpenDua path.');
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const cached = readCache(path);
  const usableCache = cached && validate(cached.data) ? cached : null;
  if (!force && usableCache && Date.now() - usableCache.savedAt < FRESH_MS) {
    return { data: usableCache.data as T, cached: true, savedAt: usableCache.savedAt };
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(OPEN_DUA_ORIGIN + path, { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      if (response.status === 429) {
        const retry = Number(response.headers.get('Retry-After'));
        throw new Error(`OpenDua is receiving too many requests. ${retry > 0 ? `Try again in ${retry} seconds.` : 'Please wait a moment and retry.'}`);
      }
      throw new Error(`OpenDua could not load this content (HTTP ${response.status}). Please retry.`);
    }
    const data: unknown = await response.json();
    if (!validate(data)) throw new Error('OpenDua returned an unexpected response. Please retry later.');
    const record = { data, savedAt: Date.now() };
    saveCache(path, record);
    return { ...record, data, cached: false };
  } catch (error) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (usableCache) return { data: usableCache.data as T, cached: true, savedAt: usableCache.savedAt };
    if (controller.signal.aborted) throw new Error('The request timed out. Check your connection and try again.');
    throw error instanceof Error ? error : new Error('Could not connect to OpenDua. Please retry.');
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', cancel); }
}
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object';
const summary = (value: unknown): value is DuaSummary => object(value) && typeof value.id === 'string' && typeof value.title === 'string' && ['invocation', 'instruction', 'narration'].includes(value.type);
const chapter = (value: unknown): value is DuaChapter => object(value) && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.entryCount === 'number';
interface ItemList<T> { items: T[]; pagination?: { page: number; totalPages: number } }

// Supports both the current complete-list response and future paginated responses.
export async function loadDuaList<T>(path: string, check: (value: unknown) => value is T, signal: AbortSignal, force = false): Promise<ApiResult<T[]>> {
  const validate = (value: unknown): value is ItemList<T> => object(value) && Array.isArray(value.items) && value.items.every(check);
  const first = await openDuaRequest(path, signal, validate, force);
  const result = { ...first, data: [...first.data.items] };
  const pages = first.data.pagination?.totalPages || 1;
  if (!Number.isInteger(pages) || pages < 1 || pages > 100) throw new Error('Unsupported OpenDua pagination.');
  for (let page = 2; page <= pages; page++) {
    const next = await openDuaRequest(`${path}${path.includes('?') ? '&' : '?'}page=${page}`, signal, validate, force);
    result.data.push(...next.data.items); result.cached ||= next.cached; result.savedAt = Math.min(result.savedAt, next.savedAt);
  }
  return result;
}
export const loadDuaChapters = (signal: AbortSignal, force = false) => loadDuaList(`/v2/collections/${OPEN_DUA_COLLECTION}/chapters`, chapter, signal, force);
export const loadDuaSummaries = (signal: AbortSignal, chapterId?: string, force = false) => loadDuaList(`/v2/collections/${OPEN_DUA_COLLECTION}${chapterId ? `/chapters/${encodeURIComponent(chapterId)}` : ''}/entries`, summary, signal, force);
export const loadDuaInfo = (signal: AbortSignal, force = false) => openDuaRequest<DuaApiInfo>('/v2', signal, (value): value is DuaApiInfo => object(value) && typeof value.dataVersion === 'string' && object(value.counts) && typeof value.counts.duas === 'number', force);
function references(value: unknown): value is DuaReference[] {
  return Array.isArray(value) && value.every(ref => object(ref) && typeof ref.reference === 'string'
    && (ref.grades === undefined || Array.isArray(ref.grades) && ref.grades.every((grade: unknown) => object(grade) && typeof grade.value === 'string')));
}
function canonical(value: unknown): value is CanonicalDua {
  return object(value) && typeof value.id === 'string' && typeof value.arabic === 'string'
    && typeof value.translation === 'string' && typeof value.transliteration === 'string'
    && references(value.references)
    && (value.placeholders === undefined || Array.isArray(value.placeholders) && value.placeholders.every((item: unknown) => object(item) && typeof item.key === 'string' && typeof item.instruction === 'string'));
}
function steps(value: unknown, depth = 0): value is DuaStep[] {
  if (depth > 16 || !Array.isArray(value)) return false;
  return value.every(step => {
    if (!object(step) || step.references !== undefined && !references(step.references)) return false;
    if (step.type === 'repeat') return Number.isInteger(step.times) && step.times > 0 && steps(step.steps, depth + 1);
    if (step.type === 'recitation') return Array.isArray(step.items) && step.items.every((item: unknown) => object(item) && canonical(item.dua) && (item.times === undefined || Number.isInteger(item.times) && item.times > 0));
    return ['instruction', 'narration'].includes(step.type) && typeof step.text === 'string' && (step.arabic === undefined || typeof step.arabic === 'string');
  });
}
export function isDuaEntry(value: unknown): value is DuaEntry {
  if (!object(value) || !summary(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  if (!references(record.references)) return false;
  if (value.type !== 'invocation') return steps(record.steps);
  return Array.isArray(record.variations) && record.variations.every(variation => object(variation)
    && typeof variation.id === 'string' && steps(variation.steps)
    && (variation.references === undefined || references(variation.references)));
}
export const loadDuaEntry = (id: string, signal: AbortSignal, force = false) => openDuaRequest<DuaEntry>(`/v2/entries/${encodeURIComponent(id)}`, signal, isDuaEntry, force);
// Canonical-dua lookup from the documented getDua endpoint. Entry responses
// already embed these same canonical objects, so the reader avoids duplicate calls.
export const loadCanonicalDua = (id: string, signal: AbortSignal, force = false) => openDuaRequest<CanonicalDua>(`/v2/duas/${encodeURIComponent(id)}`, signal, canonical, force);
