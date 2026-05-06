import type { Lang } from './i18n';

const BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "https://asdflow-main-users.onrender.com";
let CURRENT_USER_ID: string | null = null;

export function setCurrentUserId(id: string | null) {
  CURRENT_USER_ID = id;
}

async function req(path: string, opts: RequestInit = {}) {
  let url = `${BASE}/api${path}`;
  if (CURRENT_USER_ID) {
    url += url.includes('?') ? '&' : '?';
    url += `user_id=${encodeURIComponent(CURRENT_USER_ID)}`;
  }
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return null;
}

export type StepOption = {
  id: string;
  label_el: string;
  label_en: string;
  labels?: Record<string, string>;
  image?: string;
};

export type Step = {
  id: string;
  type: 'task' | 'choice';
  title_el: string;
  title_en: string;
  titles?: Record<string, string>;
  image?: string;
  voice_el?: string;
  voice_en?: string;
  options?: StepOption[];
};

export type Routine = {
  id: string;
  name_el: string;
  name_en: string;
  names?: Record<string, string>;
  icon: string;
  color: string;
  steps: Step[];
};

export type Asset = {
  id: string;
  name: string;
  data: string;
};

export type Settings = {
  pin: string;
  language: Lang;
  voice_enabled: boolean;
  sos_enabled: boolean;
  sos_sound: 'default' | 'gentle' | 'silent';
};

export type ParentDevice = {
  id: string;
  push_token: string;
  label: string;
  paired_at: string;
};

export type SOSEvent = {
  id: string;
  routine_id?: string;
  routine_name?: string;
  step_title?: string;
  step_index?: number;
  resolved: boolean;
  created_at: string;
};

export const api = {
  createUser: (body: { name: string }) =>
    req('/users', { method: 'POST', body: JSON.stringify(body) }) as Promise<{ id: string; name: string }>,
  listRoutines: () => req('/routines') as Promise<Routine[]>,
  getRoutine: (id: string) => req(`/routines/${id}`) as Promise<Routine>,
  createRoutine: (body: Partial<Routine>) =>
    req('/routines', { method: 'POST', body: JSON.stringify(body) }) as Promise<Routine>,
  updateRoutine: (id: string, body: Partial<Routine>) =>
    req(`/routines/${id}`, { method: 'PUT', body: JSON.stringify(body) }) as Promise<Routine>,
  deleteRoutine: (id: string) => req(`/routines/${id}`, { method: 'DELETE' }),

  listAssets: () => req('/assets') as Promise<Asset[]>,
  getAsset: (id: string) => req(`/assets/${id}`) as Promise<Asset>,
  createAsset: (name: string, data: string) =>
    req('/assets', { method: 'POST', body: JSON.stringify({ name, data }) }) as Promise<Asset>,
  deleteAsset: (id: string) => req(`/assets/${id}`, { method: 'DELETE' }),

  createSOS: (body: Partial<SOSEvent>) =>
    req('/sos', { method: 'POST', body: JSON.stringify(body) }) as Promise<SOSEvent>,
  getActiveSOS: () => req('/sos/active') as Promise<SOSEvent | null>,
  resolveSOS: (id: string) => req(`/sos/${id}/resolve`, { method: 'POST' }),
  listSOS: () => req('/sos') as Promise<SOSEvent[]>,
  clearSOS: () => req('/sos', { method: 'DELETE' }),

  getSettings: () => req('/settings') as Promise<Settings>,
  updateSettings: (body: Partial<Settings>) =>
    req('/settings', { method: 'PUT', body: JSON.stringify(body) }) as Promise<Settings>,
  verifyPin: (pin: string) =>
    req('/settings/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) }) as Promise<{
      valid: boolean;
    }>,

  tts: (text: string, lang: Lang) =>
    req('/tts', { method: 'POST', body: JSON.stringify({ text, lang }) }) as Promise<{
      audio: string;
      cached: boolean;
    }>,

  pairingGenerate: () =>
    req('/pairing/generate', { method: 'POST' }) as Promise<{ code: string; expires_at: string }>,
  pairingClaim: (code: string, push_token: string, label?: string) =>
    req('/pairing/claim', {
      method: 'POST',
      body: JSON.stringify({ code, push_token, label }),
    }) as Promise<ParentDevice>,
  pairingDevices: () => req('/pairing/devices') as Promise<ParentDevice[]>,
  pairingDelete: (id: string) => req(`/pairing/devices/${id}`, { method: 'DELETE' }),

  seed: () => req('/seed', { method: 'POST' }),
};
