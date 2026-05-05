import { useEffect, useRef, useState, useCallback } from 'react';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { documentDirectory } from 'expo-file-system';
import { api } from './api';
import type { Lang } from './i18n';

function getAudioFilePath(userId: string | undefined, key: string): string | null {
  if (!documentDirectory) return null; // Web or no file system
  const baseDir = userId ? `${documentDirectory}audio/${userId}/` : `${documentDirectory}audio/global/`;
  return `${baseDir}${key.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
}

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
  userId?: string;
}) {
  const { text, lang, recording, enabled, autoplay = true, userId } = opts;
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

    const localPath = getAudioFilePath(userId, key);
    if (localPath) {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists) {
        await playUri(localPath);
        return;
      }
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
        if (localPath) {
          // Ensure directory exists
          const dir = localPath.substring(0, localPath.lastIndexOf('/'));
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          // Download and save the audio
          await FileSystem.downloadAsync(result.audio, localPath);
          await playUri(localPath);
        } else {
          await playUri(result.audio);
        }
      }
    } catch (e) {
      console.log('tts fetch error', e);
    }
  }, [enabled, text, lang, recording, playUri, userId]);

  useEffect(() => () => releasePlayer(), [releasePlayer]);

  return { speak, isPlaying };
}

export function playAudioUri(uri: string): AudioPlayer {
  const p = createAudioPlayer({ uri });
  p.play();
  return p;
}
