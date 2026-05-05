import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, Routine } from '../src/api';
import { useApp } from '../src/ctx';
import { describeRoutine, loc, stepsLabel } from '../src/i18n';
import { useSpeak } from '../src/audio';
import { colors, radius, spacing } from '../src/theme';

export default function Home() {
  const router = useRouter();
  const { t, lang, ready, voiceEnabled } = useApp();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // ensure seed first
      await api.seed().catch(() => {});
      const data = await api.listRoutines();
      setRoutines(data);
    } catch (e) {
      console.log('load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onGear = () => {
    // Long press triggers; but also allow tap fallback for clarity
    router.push('/gate');
  };

  function RoutineCard({
    item,
    onPress,
  }: {
    item: Routine;
    onPress: () => void;
  }) {
    const description = describeRoutine(item, lang);
    const { speak, isPlaying } = useSpeak({
      text: description,
      lang,
      enabled: voiceEnabled,
      autoplay: false,
    });

    return (
      <TouchableOpacity
        testID={`routine-card-${item.id}`}
        activeOpacity={0.7}
        onPress={onPress}
        style={[styles.card, { borderColor: item.color }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: item.color + '40' }]}> 
          <Ionicons
            name={mapIcon(item.icon)}
            size={36}
            color={colors.child.text}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>
            {loc(item, 'name', lang) || item.name_el}
          </Text>
          <Text style={styles.cardMeta}>
            {stepsLabel(lang, item.steps.length)}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable
            testID={`routine-sound-${item.id}`}
            onPress={speak}
            style={[styles.soundBtn, isPlaying && styles.soundBtnActive]}
            hitSlop={10}
          >
            <Ionicons
              name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
              size={22}
              color={colors.child.primaryDark}
            />
          </Pressable>
          <Ionicons name="chevron-forward" size={28} color={colors.child.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  }

  if (!ready || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.child.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        <Pressable
          testID="parental-gate-gear"
          onLongPress={onGear}
          delayLongPress={3000}
          onPress={() => {}}
          style={styles.gearBtn}
          hitSlop={12}
        >
          <Ionicons name="settings-outline" size={22} color={colors.child.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>{t('appTitle')}</Text>
        <Text style={styles.subtitle}>{t('chooseRoutine')}</Text>
      </View>

      <FlatList
        testID="routines-list"
        data={routines}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item }) => (
          <RoutineCard
            item={item}
            onPress={() => router.push(`/routine/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function mapIcon(name: string): any {
  // Map old aliases to Ionicon names
  const aliases: Record<string, string> = {
    sunrise: 'sunny-outline',
    sun: 'sunny-outline',
    home: 'home-outline',
    moon: 'moon-outline',
  };
  return aliases[name] || name || 'sparkles-outline';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.child.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  langRow: { flexDirection: 'row', gap: spacing.xs },
  langPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.child.border,
  },
  langPillActive: { backgroundColor: colors.child.primary, borderColor: colors.child.primary },
  langText: { color: colors.child.textSecondary, fontSize: 14, fontWeight: '600' },
  langTextActive: { color: '#FDFBF7' },
  gearBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  titleWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.child.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 18, color: colors.child.textSecondary, marginTop: 6 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: colors.child.surface,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActions: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  soundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.child.surface,
    borderWidth: 1,
    borderColor: colors.child.border,
  },
  soundBtnActive: {
    backgroundColor: colors.child.primary + '22',
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: colors.child.text },
  cardMeta: { fontSize: 14, color: colors.child.textSecondary, marginTop: 4 },
});
