import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, Routine, SOSEvent } from '../../src/api';
import { useApp } from '../../src/ctx';
import { loc, stepsLabel } from '../../src/i18n';
import { colors, radius, spacing } from '../../src/theme';

export default function AdminHome() {
  const router = useRouter();
  const { t, lang } = useApp();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeSOS, setActiveSOS] = useState<SOSEvent | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([api.listRoutines(), api.getActiveSOS()]);
      setRoutines(r);
      setActiveSOS(s);
    } catch (e) {
      console.log(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAdd = async () => {
    try {
      const r = await api.createRoutine({
        name_el: lang === 'el' ? 'Νέα ρουτίνα' : 'New routine',
        name_en: 'New routine',
        icon: 'sun',
        color: '#8BA888',
        steps: [],
      });
      router.push(`/admin/builder/${r.id}`);
    } catch (e) {
      console.log(e);
    }
  };

  const onDelete = (r: Routine) => {
    Alert.alert(t('confirmDelete'), lang === 'el' ? r.name_el : r.name_en, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await api.deleteRoutine(r.id);
          load();
        },
      },
    ]);
  };

  const onResolveSOS = async () => {
    if (!activeSOS) return;
    await api.resolveSOS(activeSOS.id);
    setActiveSOS(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="admin-exit" onPress={() => router.replace('/')} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.admin.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('admin')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {activeSOS && (
        <View testID="admin-sos-banner" style={styles.sosBanner}>
          <Ionicons name="alert-circle" size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.sosBannerTitle}>{t('sosActive')}</Text>
            <Text style={styles.sosBannerSub}>
              {activeSOS.routine_name} · {activeSOS.step_title}
            </Text>
          </View>
          <TouchableOpacity testID="resolve-sos-btn" onPress={onResolveSOS} style={styles.sosResolveBtn}>
            <Text style={styles.sosResolveText}>{t('resolve')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tilesRow}>
        <TouchableOpacity
          testID="admin-assets-tile"
          style={styles.tile}
          onPress={() => router.push('/admin/assets')}
          activeOpacity={0.8}
        >
          <Ionicons name="images-outline" size={26} color={colors.admin.primary} />
          <Text style={styles.tileText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('assets')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="admin-pair-tile"
          style={styles.tile}
          onPress={() => router.push('/pair')}
          activeOpacity={0.8}
        >
          <Ionicons name="phone-portrait-outline" size={26} color={colors.admin.primary} />
          <Text style={styles.tileText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('pairAsParent')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="admin-settings-tile"
          style={styles.tile}
          onPress={() => router.push('/admin/settings')}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={26} color={colors.admin.primary} />
          <Text style={styles.tileText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t('settings')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{t('routines')}</Text>
        <TouchableOpacity testID="add-routine-btn" onPress={onAdd} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>{t('addRoutine')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        testID="admin-routines-list"
        data={routines}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity
              testID={`admin-routine-${item.id}`}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
              onPress={() => router.push(`/admin/builder/${item.id}`)}
            >
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{loc(item, 'name', lang) || item.name_el}</Text>
                <Text style={styles.rowSub}>{stepsLabel(lang, item.steps.length)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`admin-delete-routine-${item.id}`}
              onPress={() => onDelete(item)}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={22} color={colors.admin.danger} />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.admin.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.admin.border,
    backgroundColor: colors.admin.surface,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.admin.text },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sosBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.admin.danger,
    padding: spacing.md,
  },
  sosBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sosBannerSub: { color: '#fff', opacity: 0.85, fontSize: 13 },
  sosResolveBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  sosResolveText: { color: colors.admin.danger, fontWeight: '700' },
  tilesRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.admin.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.admin.border,
    minHeight: 86,
    justifyContent: 'center',
  },
  tileText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.admin.text,
    textAlign: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.admin.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.admin.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  addBtnText: { color: '#fff', fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.admin.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.admin.border,
  },
  colorDot: { width: 16, height: 16, borderRadius: 8 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.admin.text },
  rowSub: { fontSize: 13, color: colors.admin.textSecondary, marginTop: 2 },
});
