import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../src/api';
import { useApp } from '../src/ctx';
import { SUPPORTED_LANGS, Lang } from '../src/i18n';
import { useSpeak } from '../src/audio';
import { radius, spacing } from '../src/theme';

const WELCOME_KEY = 'app.welcomed.v2';
const { width: SCREEN_W } = Dimensions.get('window');

export default function Welcome() {
  const router = useRouter();
  const { lang, setLang, t, setUserId } = useApp();
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const welcomeMessage = `${t('welcomeTitle')} ${t('welcomeDesc')}`;
  const { speak, isPlaying } = useSpeak({
    text: welcomeMessage,
    lang,
    enabled: true,
    autoplay: true,
  });

  const isSmallScreen = SCREEN_W <= 360;
  const contentWidth = Math.min(680, SCREEN_W - spacing.lg);
  const heroSize = Math.min(180, SCREEN_W * 0.44);
  const heroOuterSize = heroSize;
  const heroMidSize = heroSize * 0.82;
  const heroCircleSize = heroSize * 0.63;
  const heroIconSize = Math.round(heroCircleSize * 0.48);
  const btnPaddingVertical = isSmallScreen ? 16 : 18;
  const btnPaddingHorizontal = isSmallScreen ? 22 : 28;
  const inputFontSize = isSmallScreen ? 14 : 16;
  const scrollPadding = isSmallScreen ? spacing.sm : spacing.md;

  const createProfile = async () => {
    if (!profileName.trim()) return;
    setBusy(true);
    try {
      const user = await api.createUser({ name: profileName.trim() });
      await setUserId(user.id);
      await AsyncStorage.setItem(WELCOME_KEY, '1');
      router.replace('/');
    } catch (error) {
      console.log('create profile error', error);
    } finally {
      setBusy(false);
    }
  };

  // No auto-scroll: let users freely swipe through languages.
  // Ensures Greek (default) is always the first visible chip.

  return (
    <LinearGradient
      colors={['#DDD3F0', '#F4EBDA', '#FAD9C3']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Background orbs */}
        <View style={[styles.orb, styles.orbTopLeft]} />
        <View style={[styles.orb, styles.orbTopRight]} />
        <View style={[styles.orb, styles.orbBottom]} />

        <ScrollView
          contentContainerStyle={[styles.scroll, { padding: scrollPadding, width: '100%', maxWidth: contentWidth }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={[styles.heroWrap, { width: heroSize, height: heroSize, marginBottom: isSmallScreen ? spacing.sm : spacing.md }]}> 
            <View style={[styles.heroRingOuter, { width: heroOuterSize, height: heroOuterSize, borderRadius: heroOuterSize / 2 }]} />
            <View style={[styles.heroRingMid, { width: heroMidSize, height: heroMidSize, borderRadius: heroMidSize / 2 }]} />
            <LinearGradient
              colors={['#B8D8D3', '#8EC3B9']}
              start={{ x: 0.2, y: 0.1 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroCircle, { width: heroCircleSize, height: heroCircleSize, borderRadius: heroCircleSize / 2 }]}
            >
              <Ionicons name="heart" size={heroIconSize} color="#FDFBF7" />
            </LinearGradient>
            {/* Floating sparkle badges */}
            <View style={[styles.miniCircle, { top: 10, right: 10 }]}>
              <Ionicons name="sunny" size={20} color="#E89B3E" />
            </View>
            <View style={[styles.miniCircle, { bottom: 20, left: 0 }]}>
              <Ionicons name="moon" size={18} color="#5B7AA3" />
            </View>
            <View style={[styles.miniCircle, { top: 80, left: -10 }]}>
              <Ionicons name="sparkles" size={16} color="#C9744B" />
            </View>
          </View>

          {/* Title & description */}
          <Text style={styles.title}>{t('welcomeTitle')}</Text>
          <Text style={styles.appName}>{t('appTitle')}</Text>
          <Text style={styles.desc}>{t('welcomeDesc')}</Text>

          {/* Language picker - horizontal chips, no wrap */}
          <Text style={styles.sectionLabel}>{t('chooseLang')}</Text>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.langScroll}
            style={styles.langScrollView}
          >
            {SUPPORTED_LANGS.map((l) => {
              const active = lang === l.code;
              return (
                <TouchableOpacity
                  key={l.code}
                  testID={`welcome-lang-${l.code}`}
                  onPress={() => setLang(l.code as Lang)}
                  style={[styles.langChip, active && styles.langChipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flag}>{l.flag}</Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.langLabel, active && styles.langLabelActive]}
                  >
                    {l.label}
                  </Text>
                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#5A8F5B"
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.swipeHint}>
            <Ionicons name="swap-horizontal" size={14} color="#7A6E95" /> {' '}
            {t('chooseLang')}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('profileName')}</Text>
            <TextInput
              value={profileName}
              onChangeText={setProfileName}
              placeholder={t('profileNamePlaceholder')}
              placeholderTextColor="#8A8A98"
              style={[styles.input, { fontSize: inputFontSize }]}
              editable={!busy}
              returnKeyType="done"
              onSubmitEditing={createProfile}
            />
          </View>

          {/* CTA */}
          <TouchableOpacity
            testID="welcome-start"
            activeOpacity={0.85}
            onPress={createProfile}
            disabled={busy || !profileName.trim()}
            style={[styles.startBtnWrap, (busy || !profileName.trim()) && { opacity: 0.6 }]}
          >
            <LinearGradient
              colors={['#8EC3B9', '#6EA896']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.startBtn, { paddingVertical: btnPaddingVertical, paddingHorizontal: btnPaddingHorizontal }]}
            >
              <Text style={styles.startBtnText}>{t('welcomeStart')}</Text>
              <Ionicons name="arrow-forward-circle" size={28} color="#FDFBF7" />
            </LinearGradient>
          </TouchableOpacity>

          <Pressable
            testID="welcome-speak"
            onPress={speak}
            style={[styles.welcomeListenBtn, isPlaying && styles.welcomeListenBtnActive]}
            hitSlop={10}
          >
            <Ionicons
              name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
              size={24}
              color="#FFFFFF"
            />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: spacing.md,
    gap: 4,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.5 },
  orbTopLeft: { width: 220, height: 220, top: -60, left: -60, backgroundColor: '#C8BBE6' },
  orbTopRight: { width: 160, height: 160, top: 80, right: -50, backgroundColor: '#FBD3B9' },
  orbBottom: { width: 260, height: 260, bottom: -90, right: -80, backgroundColor: '#F7E8CD' },

  heroWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    position: 'relative',
  },
  heroRingOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FFFFFF',
    opacity: 0.35,
  },
  heroRingMid: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFFFFF',
    opacity: 0.55,
  },
  heroCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8EC3B9',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  miniCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#3D3358',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6E8C6B',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  desc: {
    fontSize: 15,
    color: '#5C5570',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7A6E95',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 0,
    marginBottom: spacing.sm,
    alignSelf: 'center',
  },

  langScrollView: {
    maxHeight: 72,
    alignSelf: 'stretch',
    marginHorizontal: -spacing.xl,
  },
  langScroll: {
    paddingHorizontal: spacing.xl,
    gap: 10,
    alignItems: 'center',
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    gap: 8,
    minHeight: 48,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  langChipActive: {
    backgroundColor: '#E7F2EA',
    borderColor: '#8EC3B9',
  },
  flag: { fontSize: 22 },
  langLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3D3358',
  },
  langLabelActive: { color: '#3A6E4D' },

  swipeHint: {
    fontSize: 12,
    color: '#7A6E95',
    marginTop: 2,
    marginBottom: spacing.md,
    opacity: 0.85,
  },

  startBtnWrap: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#6EA896',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginTop: spacing.sm,
  },
  startBtn: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 28,
    minHeight: 64,
  },
  welcomeListenBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6EA896',
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  welcomeListenBtnActive: {
    backgroundColor: '#8EC3B9',
  },
  startBtnText: {
    color: '#FDFBF7',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  inputGroup: {
    width: '100%',
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3D3358',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5D0E6',
    color: '#333',
    fontSize: 16,
  },
});
