import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, SOSEvent } from '../src/api';
import { useApp } from '../src/ctx';
import { registerForPushNotifications } from '../src/push';
import { colors, radius, spacing } from '../src/theme';

const RECEIVER_KEY = 'app.receiver_paired';

export default function PairScreen() {
  const router = useRouter();
  const { t, lang } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [paired, setPaired] = useState(false);
  const [pollMode, setPollMode] = useState(false);
  const [activeSOS, setActiveSOS] = useState<SOSEvent | null>(null);

  useEffect(() => {
    (async () => {
      const r = await AsyncStorage.getItem(RECEIVER_KEY);
      if (r === '1') {
        setPaired(true);
        setPollMode(true);
      }
    })();
  }, []);

  // Polling for SOS while in receiver mode
  useEffect(() => {
    if (!pollMode) return;
    let active = true;
    const tick = async () => {
      try {
        const ev = await api.getActiveSOS();
        if (active) setActiveSOS(ev);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [pollMode]);

  const submit = async () => {
    if (code.length !== 6) {
      Alert.alert(t('wrongPin'));
      return;
    }
    setBusy(true);
    try {
      const push = await registerForPushNotifications();
      // Use token if available, else use a "polling-only" placeholder
      const tokenForBackend = push.token || `polling:${Date.now()}`;
      await api.pairingClaim(code, tokenForBackend, 'Κινητό γονέα');
      await AsyncStorage.setItem(RECEIVER_KEY, '1');
      setPaired(true);
      setPollMode(true);

      if (!push.token) {
        const explanation =
          push.reason === 'expo-go-limit'
            ? t('pushExpoGoLimit')
            : push.reason === 'denied'
            ? t('pushDenied')
            : t('pollingActive');
        Alert.alert(t('paired'), explanation);
      }
    } catch (e: any) {
      Alert.alert(t('pairFailed'), String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const unpair = async () => {
    Alert.alert(t('confirmDelete'), '', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(RECEIVER_KEY);
          setPaired(false);
          setPollMode(false);
          setActiveSOS(null);
          setCode('');
        },
      },
    ]);
  };

  const resolveSOS = async () => {
    if (!activeSOS) return;
    try {
      await api.resolveSOS(activeSOS.id);
      setActiveSOS(null);
    } catch {}
  };

  if (paired) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable testID="pair-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.child.textSecondary} />
          </Pressable>
          <Text style={styles.title}>{t('pairAsParent')}</Text>
          <Pressable testID="pair-unpair" onPress={unpair} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.child.sos} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {activeSOS ? (
            <View testID="receiver-sos-alert" style={styles.alertCard}>
              <View style={styles.alertIcon}>
                <Ionicons name="hand-left" size={64} color="#FDFBF7" />
              </View>
              <Text style={styles.alertTitle}>
                {t('sosAlertTitle')}
              </Text>
              <Text style={styles.alertSub}>
                {activeSOS.routine_name} · {activeSOS.step_title}
              </Text>
              <Text style={styles.alertTime}>
                {new Date(activeSOS.created_at).toLocaleTimeString()}
              </Text>
              <TouchableOpacity
                testID="receiver-resolve"
                style={styles.resolveBtn}
                onPress={resolveSOS}
              >
                <Text style={styles.resolveBtnText}>{t('resolve')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.idleCard}>
              <View style={styles.idleIcon}>
                <Ionicons name="ear-outline" size={64} color={colors.child.primary} />
              </View>
              <Text style={styles.idleTitle}>
                {t('listeningForSOS')}
              </Text>
              <Text style={styles.idleSub}>
                {t('keepScreenOpen')}
              </Text>
              <ActivityIndicator color={colors.child.primary} style={{ marginTop: 16 }} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="pair-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.child.textSecondary} />
        </Pressable>
        <Text style={styles.title}>{t('pairAsParent')}</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.body}>
          <Ionicons
            name="phone-portrait-outline"
            size={72}
            color={colors.child.primaryDark}
            style={{ alignSelf: 'center', marginBottom: spacing.md }}
          />
          <Text style={styles.help}>{t('pairReceiveExplain')}</Text>
          <Text style={styles.label}>{t('enterCode')}</Text>
          <TextInput
            testID="pair-code-input"
            style={styles.input}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
            placeholder="••••••"
            placeholderTextColor={colors.child.border}
            autoFocus
          />
          <TouchableOpacity
            testID="pair-submit"
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#FDFBF7" />
            ) : (
              <Text style={styles.primaryBtnText}>{t('save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.child.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.child.text },
  body: { padding: spacing.xl, gap: spacing.md, justifyContent: 'center', flexGrow: 1 },
  help: {
    fontSize: 16,
    color: colors.child.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.child.textSecondary },
  input: {
    borderWidth: 2,
    borderColor: colors.child.border,
    borderRadius: radius.md,
    padding: 18,
    fontSize: 32,
    textAlign: 'center',
    letterSpacing: 12,
    backgroundColor: colors.child.surface,
    color: colors.child.text,
  },
  primaryBtn: {
    backgroundColor: colors.child.primary,
    paddingVertical: 18,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnText: { color: '#FDFBF7', fontSize: 20, fontWeight: '700' },
  idleCard: { alignItems: 'center', gap: 12, padding: spacing.xl },
  idleIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.child.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.child.border,
  },
  idleTitle: { fontSize: 24, fontWeight: '700', color: colors.child.text, textAlign: 'center' },
  idleSub: {
    fontSize: 15,
    color: colors.child.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  alertCard: {
    alignItems: 'center',
    gap: 12,
    padding: spacing.xl,
    backgroundColor: '#FCEBE3',
    borderRadius: radius.xl,
    borderWidth: 3,
    borderColor: colors.child.sos,
  },
  alertIcon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.child.sos,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.child.text,
    textAlign: 'center',
  },
  alertSub: { fontSize: 18, color: colors.child.text, textAlign: 'center' },
  alertTime: { fontSize: 14, color: colors.child.textSecondary },
  resolveBtn: {
    backgroundColor: colors.child.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    minWidth: 200,
    alignItems: 'center',
  },
  resolveBtnText: { color: '#FDFBF7', fontSize: 20, fontWeight: '700' },
});
