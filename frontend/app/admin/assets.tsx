import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, Asset } from '../../src/api';
import { useApp } from '../../src/ctx';
import { colors, radius, spacing } from '../../src/theme';

export default function AssetsScreen() {
  const router = useRouter();
  const { t } = useApp();
  const [assets, setAssets] = useState<Asset[]>([]);

  const load = useCallback(async () => {
    try {
      const list = await api.listAssets();
      setAssets(list);
    } catch (e) {
      console.log(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const upload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const data = `data:image/jpeg;base64,${a.base64}`;
    await api.createAsset(`asset-${Date.now()}`, data);
    load();
  };

  const onDelete = (a: Asset) => {
    Alert.alert(t('confirmDelete'), a.name, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await api.deleteAsset(a.id);
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="assets-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.admin.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('assets')}</Text>
        <TouchableOpacity testID="assets-upload" onPress={upload} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {assets.length === 0 && (
          <Text style={styles.empty}>{t('noAssets')}</Text>
        )}
        {assets.map((a) => (
          <TouchableOpacity
            key={a.id}
            testID={`asset-${a.id}`}
            onLongPress={() => onDelete(a)}
            activeOpacity={0.7}
            style={styles.cell}
          >
            <Image source={{ uri: a.data }} style={{ width: '100%', height: '100%' }} />
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    backgroundColor: colors.admin.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.admin.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.admin.text },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.admin.primary,
    borderRadius: radius.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: spacing.md },
  cell: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.admin.surface,
    borderWidth: 1,
    borderColor: colors.admin.border,
  },
  empty: { color: colors.admin.textSecondary, padding: spacing.lg, textAlign: 'center', width: '100%' },
});
