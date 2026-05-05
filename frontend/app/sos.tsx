import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { useApp } from '../src/ctx';
import { colors, radius, spacing } from '../src/theme';

export default function SOSScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useApp();
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const iv = setInterval(async () => {
      if (!id) return;
      try {
        const active = await api.getActiveSOS();
        if (!active || active.id !== id) {
          setResolved(true);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [id]);

  useEffect(() => {
    if (resolved) {
      const to = setTimeout(() => router.replace('/'), 800);
      return () => clearTimeout(to);
    }
  }, [resolved, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="hand-left" size={72} color="#FDFBF7" />
        </View>
        <Text testID="sos-title" style={styles.title}>
          {resolved ? t('resolve') : t('sosSent')}
        </Text>
        <Text style={styles.subtitle}>{t('sosWaiting')}</Text>
        <ActivityIndicator color={colors.child.sos} size="large" style={{ marginTop: 24 }} />
      </View>
      <Pressable
        testID="sos-gate"
        onLongPress={() => router.push('/gate?from=sos')}
        delayLongPress={3000}
        style={styles.gearBtn}
        hitSlop={10}
      >
        <Ionicons name="settings-outline" size={22} color={colors.child.textSecondary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.child.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.child.sos,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 30, fontWeight: '700', color: colors.child.text, textAlign: 'center' },
  subtitle: { fontSize: 18, color: colors.child.textSecondary, textAlign: 'center' },
  gearBtn: { position: 'absolute', top: 16, right: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
