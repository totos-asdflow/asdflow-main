import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { useApp } from '../src/ctx';
import { colors, radius, spacing } from '../src/theme';

export default function Gate() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { t } = useApp();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);

  const onDigit = (d: string) => {
    setErr(false);
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      verify(next);
    }
  };

  const verify = async (p: string) => {
    try {
      const r = await api.verifyPin(p);
      if (r.valid) {
        // Resolve active SOS if opened from SOS screen
        if (from === 'sos') {
          try {
            const active = await api.getActiveSOS();
            if (active) await api.resolveSOS(active.id);
          } catch {}
        }
        router.replace('/admin');
      } else {
        setErr(true);
        setPin('');
      }
    } catch {
      setErr(true);
      setPin('');
    }
  };

  const onBack = () => {
    if (pin.length > 0) setPin(pin.slice(0, -1));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="gate-close" onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="close" size={28} color={colors.child.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.titleWrap}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.child.textSecondary} />
        <Text style={styles.title}>{t('enterPin')}</Text>
      </View>

      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            testID={`pin-dot-${i}`}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
              err && styles.dotErr,
            ]}
          />
        ))}
      </View>
      {err && <Text style={styles.errText}>{t('wrongPin')}</Text>}

      <View style={styles.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <TouchableOpacity
            key={d}
            testID={`pin-pad-digit-${d}`}
            style={styles.key}
            onPress={() => onDigit(d)}
            activeOpacity={0.6}
          >
            <Text style={styles.keyText}>{d}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.key} />
        <TouchableOpacity testID="pin-pad-digit-0" style={styles.key} onPress={() => onDigit('0')} activeOpacity={0.6}>
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="pin-pad-back" style={styles.key} onPress={onBack} activeOpacity={0.6}>
          <Ionicons name="backspace-outline" size={28} color={colors.child.text} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.child.background },
  header: { flexDirection: 'row', justifyContent: 'flex-end', padding: spacing.md },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { alignItems: 'center', marginVertical: spacing.lg, gap: spacing.sm },
  title: { fontSize: 26, fontWeight: '700', color: colors.child.text },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginVertical: spacing.lg },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.child.border },
  dotFilled: { backgroundColor: colors.child.primary, borderColor: colors.child.primary },
  dotErr: { borderColor: colors.child.sos },
  errText: { color: colors.child.sos, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  key: {
    width: '28%',
    aspectRatio: 1.4,
    backgroundColor: colors.child.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 32, fontWeight: '600', color: colors.child.text },
});
