import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ParentDevice, SOSEvent } from '../../src/api';
import { useApp } from '../../src/ctx';
import { SUPPORTED_LANGS } from '../../src/i18n';
import { colors, radius, spacing } from '../../src/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, lang, setLang, voiceEnabled, setVoiceEnabled } = useApp();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [sosEnabled, setSosEnabled] = useState(true);
  const [sosSound, setSosSound] = useState<'default' | 'gentle' | 'silent'>('default');
  const [code, setCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [devices, setDevices] = useState<ParentDevice[]>([]);
  const [history, setHistory] = useState<SOSEvent[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, d, h] = await Promise.all([
        api.getSettings(),
        api.pairingDevices(),
        api.listSOS(),
      ]);
      setSosEnabled(s.sos_enabled);
      setSosSound(s.sos_sound);
      setDevices(d);
      setHistory(h.slice(0, 10));
    } catch (e) {
      console.log(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const savePin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      Alert.alert(t('wrongPin'));
      return;
    }
    const v = await api.verifyPin(currentPin);
    if (!v.valid) {
      Alert.alert(t('wrongPin'));
      return;
    }
    await api.updateSettings({ pin: newPin });
    setCurrentPin('');
    setNewPin('');
    Alert.alert('OK', t('save'));
  };

  const toggleSos = async (v: boolean) => {
    setSosEnabled(v);
    await api.updateSettings({ sos_enabled: v });
  };

  const setSound = async (s: 'default' | 'gentle' | 'silent') => {
    setSosSound(s);
    await api.updateSettings({ sos_sound: s });
  };

  const generateCode = async () => {
    try {
      const r = await api.pairingGenerate();
      setCode(r.code);
      setCodeExpiresAt(r.expires_at);
    } catch (e: any) {
      Alert.alert('Error', String(e?.message || e));
    }
  };

  const removeDevice = (d: ParentDevice) => {
    Alert.alert(t('confirmDelete'), d.label, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await api.pairingDelete(d.id);
          load();
        },
      },
    ]);
  };

  const minutesLeft = codeExpiresAt
    ? Math.max(0, Math.round((new Date(codeExpiresAt).getTime() - Date.now()) / 60000))
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="settings-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.admin.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('settings')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('language')}</Text>
            <View style={styles.langGrid}>
              {SUPPORTED_LANGS.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  testID={`settings-lang-${l.code}`}
                  style={[styles.langCardSm, lang === l.code && styles.segBtnActive]}
                  onPress={() => setLang(l.code)}
                >
                  <Text style={{ fontSize: 18 }}>{l.flag}</Text>
                  <Text
                    style={[
                      styles.segText,
                      { fontSize: 13 },
                      lang === l.code && styles.segTextActive,
                    ]}
                  >
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              testID="settings-replay-welcome"
              onPress={async () => {
                await AsyncStorage.removeItem('app.welcomed.v2');
                router.replace('/welcome');
              }}
              style={styles.replayWelcomeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.admin.primary} />
              <Text style={styles.replayWelcomeText}>{t('replayWelcome')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('voiceEnabled')}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {([['on', true], ['off', false]] as const).map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  testID={`settings-voice-${key}`}
                  style={[styles.segBtn, voiceEnabled === val && styles.segBtnActive]}
                  onPress={() => setVoiceEnabled(val)}
                >
                  <Text style={[styles.segText, voiceEnabled === val && styles.segTextActive]}>
                    {val ? t('voiceOn') : t('voiceOff')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('sosTitle')}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {([['on', true], ['off', false]] as const).map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  testID={`settings-sos-${key}`}
                  style={[styles.segBtn, sosEnabled === val && styles.segBtnActive]}
                  onPress={() => toggleSos(val)}
                >
                  <Text style={[styles.segText, sosEnabled === val && styles.segTextActive]}>
                    {val ? t('sosOn') : t('sosOff')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('sosSound')}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['default', 'gentle', 'silent'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  testID={`settings-sound-${s}`}
                  style={[styles.segBtnSmall, sosSound === s && styles.segBtnActive]}
                  onPress={() => setSound(s)}
                >
                  <Text
                    style={[styles.segText, sosSound === s && styles.segTextActive, { fontSize: 13 }]}
                  >
                    {s === 'default' ? t('sosSoundDefault') : s === 'gentle' ? t('sosSoundGentle') : t('sosSoundSilent')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('pairingCode')}</Text>
            {code ? (
              <View style={styles.codeBox}>
                <Text testID="pairing-code-display" style={styles.codeText}>{code}</Text>
                <Text style={styles.codeExpiry}>
                  {t('expiresIn')} {minutesLeft} {t('minutes')}
                </Text>
                <Text style={styles.codeHelp}>{t('pairingExplain')}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              testID="settings-generate-code"
              style={styles.altBtn}
              onPress={generateCode}
            >
              <Ionicons name="key-outline" size={18} color={colors.admin.primary} />
              <Text style={styles.altBtnText}>{t('generateCode')}</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: spacing.md }]}>
              {t('pairedDevices')} ({devices.length})
            </Text>
            {devices.length === 0 && (
              <Text style={styles.emptyText}>{t('noPairedDevices')}</Text>
            )}
            {devices.map((d) => (
              <View key={d.id} style={styles.deviceRow}>
                <Ionicons name="phone-portrait-outline" size={20} color={colors.admin.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceLabel}>{d.label}</Text>
                  <Text style={styles.deviceMeta}>
                    {new Date(d.paired_at).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  testID={`device-delete-${d.id}`}
                  onPress={() => removeDevice(d)}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.admin.danger} />
                </TouchableOpacity>
              </View>
            ))}

            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('sosHistory')}</Text>
            {history.length === 0 && (
              <Text style={styles.emptyText}>{t('noSosHistory')}</Text>
            )}
            {history.map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <Ionicons
                  name={h.resolved ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={h.resolved ? colors.admin.primary : colors.admin.danger}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {h.routine_name} · {h.step_title}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {new Date(h.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('pin')}</Text>
            <Text style={styles.label}>{t('currentPin')}</Text>
            <TextInput
              testID="settings-current-pin"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={currentPin}
              onChangeText={setCurrentPin}
              style={styles.input}
            />
            <Text style={styles.label}>{t('newPin')}</Text>
            <TextInput
              testID="settings-new-pin"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={newPin}
              onChangeText={setNewPin}
              style={styles.input}
            />
            <TouchableOpacity testID="settings-save-pin" style={styles.saveBtn} onPress={savePin}>
              <Text style={styles.saveBtnText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  card: {
    backgroundColor: colors.admin.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.admin.border,
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.admin.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.admin.textSecondary, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.admin.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: colors.admin.text,
    letterSpacing: 6,
  },
  segBtn: {
    flex: 1,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.admin.border,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  segBtnSmall: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.admin.border,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  segBtnActive: { backgroundColor: colors.admin.primary, borderColor: colors.admin.primary },
  segText: { color: colors.admin.text, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  saveBtn: {
    backgroundColor: colors.admin.primary,
    padding: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  altBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.admin.primary,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: radius.sm,
    marginTop: 8,
  },
  altBtnText: { color: colors.admin.primary, fontWeight: '600', fontSize: 14 },
  codeBox: {
    backgroundColor: '#F0F2ED',
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  codeText: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.admin.primary,
    letterSpacing: 8,
  },
  codeExpiry: { fontSize: 12, color: colors.admin.textSecondary },
  codeHelp: {
    fontSize: 12,
    color: colors.admin.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  emptyText: {
    fontSize: 13,
    color: colors.admin.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.admin.border,
  },
  deviceLabel: { fontSize: 14, fontWeight: '600', color: colors.admin.text },
  deviceMeta: { fontSize: 12, color: colors.admin.textSecondary },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.admin.border,
  },
  historyTitle: { fontSize: 13, fontWeight: '600', color: colors.admin.text },
  historyMeta: { fontSize: 11, color: colors.admin.textSecondary },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langCardSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.admin.border,
    backgroundColor: '#fff',
    minWidth: '47%',
  },
  replayWelcomeBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.admin.primary,
    borderStyle: 'dashed',
    backgroundColor: '#FAFCFB',
  },
  replayWelcomeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.admin.primary,
  },
});
