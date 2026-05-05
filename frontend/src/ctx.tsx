import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setCurrentUserId } from './api';
import type { Lang } from './i18n';
import { t as tr, StringKey, isLang } from './i18n';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  userId: string | null;
  setUserId: (id: string | null) => Promise<void>;
  t: (key: StringKey) => string;
  ready: boolean;
};

const AppCtx = createContext<Ctx>({
  lang: 'el',
  setLang: () => {},
  voiceEnabled: true,
  setVoiceEnabled: () => {},
  userId: null,
  setUserId: async () => {},
  t: (k) => tr('el', k),
  ready: false,
});

const LANG_KEY = 'app.lang';
const VOICE_KEY = 'app.voice';
const USER_KEY = 'app.user_id';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('el');
  const [voiceEnabled, setVoiceEnabledState] = useState<boolean>(true);
  const [userId, setUserIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cachedLang = await AsyncStorage.getItem(LANG_KEY);
        const cachedVoice = await AsyncStorage.getItem(VOICE_KEY);
        const cachedUserId = await AsyncStorage.getItem(USER_KEY);
        if (isLang(cachedLang)) {
          setLangState(cachedLang);
        }
        if (cachedVoice !== null) {
          setVoiceEnabledState(cachedVoice === '1');
        }
        if (cachedUserId) {
          setUserIdState(cachedUserId);
          setCurrentUserId(cachedUserId);
        }
        // Also pull latest from backend
        try {
          const s = await api.getSettings();
          if (isLang(s.language)) setLangState(s.language as Lang);
          setVoiceEnabledState(s.voice_enabled);
          await AsyncStorage.setItem(LANG_KEY, s.language);
          await AsyncStorage.setItem(VOICE_KEY, s.voice_enabled ? '1' : '0');
        } catch {}
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
    api.updateSettings({ language: l }).catch(() => {});
  }, []);

  const setVoiceEnabled = useCallback((v: boolean) => {
    setVoiceEnabledState(v);
    AsyncStorage.setItem(VOICE_KEY, v ? '1' : '0').catch(() => {});
    api.updateSettings({ voice_enabled: v }).catch(() => {});
  }, []);

  const setUserId = useCallback(async (id: string | null) => {
    setUserIdState(id);
    setCurrentUserId(id);
    if (id) {
      await AsyncStorage.setItem(USER_KEY, id);
    } else {
      await AsyncStorage.removeItem(USER_KEY);
    }
  }, []);

  const t = useCallback((key: StringKey) => tr(lang, key), [lang]);

  return (
    <AppCtx.Provider value={{
      lang,
      setLang,
      voiceEnabled,
      setVoiceEnabled,
      userId,
      setUserId,
      t,
      ready,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  return useContext(AppCtx);
}
