import { useEffect, useRef, useState, useCallback } from 'react';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import { api } from './api';
import type { Lang } from './i18n';

/**
 * Returns {speak, isPlaying} for playing a step's parent recording
 * or the backend TTS fallback if no recording is available.
 */
export function useSpeak(opts: {
  text: string;
  lang: Lang;
  recording?: string | null;
  enabled: boolean;
  autoplay?: boolean;
}) {
  const { text, lang, recording, enabled, autoplay = true } = opts;
  const playerRef = useRef<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeKeyRef = useRef<string>('');
  const ttsCacheRef = useRef<Record<string, string>>({});

  const releasePlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
    }
  }, []);

  const playUri = useCallback(
    async (uri: string) => {
      try {
        releasePlayer();
        const p = createAudioPlayer({ uri });
        playerRef.current = p;
        setIsPlaying(true);
        p.addListener('playbackStatusUpdate', (status: any) => {
          if (status?.didJustFinish) {
            setIsPlaying(false);
          }
        });
        p.play();
      } catch (e) {
        console.log('audio play err', e);
        setIsPlaying(false);
      }
    },
    [releasePlayer]
  );

  const speak = useCallback(async () => {
    if (!enabled || !text) return;
    const key = `${lang}:${text}`;
    activeKeyRef.current = key;

    if (recording) {
      await playUri(recording);
      return;
    }

    const cached = ttsCacheRef.current[key];
    if (cached) {
      await playUri(cached);
      return;
    }

    try {
      const result = await api.tts(text, lang);
      if (result?.audio) {
        ttsCacheRef.current[key] = result.audio;
        await playUri(result.audio);
      }
    } catch (e) {
      console.log('tts fetch error', e);
    }
  }, [enabled, text, lang, recording, playUri]);

  // Auto-play on text change
  useEffect(() => {
    if (!autoplay) return;
    speak();
    return () => {
      activeKeyRef.current = '';
      releasePlayer();
      setIsPlaying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, lang, recording, enabled]);

  useEffect(() => () => releasePlayer(), [releasePlayer]);

  return { speak, isPlaying };
}

export function playAudioUri(uri: string): AudioPlayer {
  const p = createAudioPlayer({ uri });
  p.play();
  return p;
}
