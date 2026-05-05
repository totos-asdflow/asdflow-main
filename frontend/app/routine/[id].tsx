import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, Routine } from '../../src/api';
import { useApp } from '../../src/ctx';
import { useSpeak } from '../../src/audio';
import { loc } from '../../src/i18n';
import type { Lang } from '../../src/i18n';
import { colors, radius, spacing } from '../../src/theme';

export default function RoutineFlow() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { lang, t } = useApp();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getRoutine(id).then(setRoutine).catch((e) => console.log('err', e));
  }, [id]);

  const onSOS = useCallback(async () => {
    if (!routine) return;
    const step = routine.steps[stepIndex];
    try {
      const evt = await api.createSOS({
        routine_id: routine.id,
        routine_name: loc(routine, 'name', lang) || routine.name_el,
        step_title: step ? loc(step, 'title', lang) || step.title_el : undefined,
        step_index: stepIndex,
      });
      router.push(`/sos?id=${evt.id}`);
    } catch (e) {
      console.log('sos err', e);
    }
  }, [routine, stepIndex, lang, router]);

  if (!routine) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.child.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (finished || routine.steps.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <FinishedScreen
          onHome={() => router.replace('/')}
          onBack={routine.steps.length > 0 ? () => setFinished(false) : null}
        />
      </SafeAreaView>
    );
  }

  const step = routine.steps[stepIndex];
  const isChoice = step.type === 'choice';
  const title = loc(step, 'title', lang) || step.title_el;
  const recording = (lang === 'el' ? step.voice_el : step.voice_en) || step.voice_el || step.voice_en;

  const advance = () => {
    if (stepIndex + 1 >= routine.steps.length) {
      setFinished(true);
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <TaskView
        step={step}
        title={title}
        recording={recording}
        isChoice={isChoice}
        lang={lang}
        routine={routine}
        stepIndex={stepIndex}
        onExit={() => router.replace('/')}
        onPrev={stepIndex > 0 ? goPrev : null}
        onSOS={onSOS}
        onAdvance={advance}
      />
    </SafeAreaView>
  );
}

function TaskView({
  step,
  title,
  recording,
  isChoice,
  lang,
  routine,
  stepIndex,
  onExit,
  onPrev,
  onSOS,
  onAdvance,
}: {
  step: any;
  title: string;
  recording?: string | null;
  isChoice: boolean;
  lang: Lang;
  routine: Routine;
  stepIndex: number;
  onExit: () => void;
  onPrev: (() => void) | null;
  onSOS: () => void;
  onAdvance: () => void;
}) {
  const { t, voiceEnabled } = useApp();
  const [showCheck, setShowCheck] = useState(false);
  const { speak, isPlaying } = useSpeak({
    text: title,
    lang,
    recording,
    enabled: voiceEnabled && !showCheck,
    autoplay: true,
  });

  const handleDone = () => {
    setShowCheck(true);
    setTimeout(() => {
      setShowCheck(false);
      onAdvance();
    }, 900);
  };

  return (
    <>
      <View style={styles.topBar}>
        <Pressable testID="exit-routine-btn" onPress={onExit} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.child.textSecondary} />
        </Pressable>
        <View style={styles.progressRow}>
          {routine.steps.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < stepIndex && styles.progressDotDone,
                i === stepIndex && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        <Pressable testID="sos-help-button" onPress={onSOS} style={styles.sosBtn} hitSlop={10}>
          <Ionicons name="hand-left-outline" size={22} color="#FDFBF7" />
          <Text style={styles.sosText}>{t('help')}</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {!!step.image && (
          <View style={styles.imageWrap}>
            <Image
              testID="step-image"
              source={{ uri: step.image }}
              style={styles.image}
              resizeMode="cover"
            />
            {showCheck && (
              <View style={styles.checkOverlay} testID="done-check-overlay">
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={140} color="#FDFBF7" />
                </View>
              </View>
            )}
          </View>
        )}
        <View style={styles.titleRow}>
          <Text testID="step-title" style={styles.stepTitle}>{title}</Text>
          {voiceEnabled && (
            <Pressable
              testID="step-listen-btn"
              onPress={() => speak()}
              style={[styles.listenBtn, isPlaying && styles.listenBtnActive]}
              hitSlop={10}
            >
              <Ionicons
                name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
                size={26}
                color={colors.child.primaryDark}
              />
            </Pressable>
          )}
        </View>

        {isChoice ? (
          <ChoiceOptions
            options={(step.options || []).slice(0, 3)}
            lang={lang}
            onPick={onAdvance}
            onPrev={onPrev}
          />
        ) : (
          <View style={styles.actionRow}>
            {onPrev && (
              <TouchableOpacity
                testID="step-prev-btn"
                style={styles.prevBtn}
                onPress={onPrev}
                disabled={showCheck}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={28} color={colors.child.primaryDark} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              testID="step-done-btn"
              style={[styles.doneBtn, { flex: 1 }]}
              onPress={handleDone}
              disabled={showCheck}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={28} color="#FDFBF7" />
              <Text style={styles.doneBtnText} numberOfLines={1}>{t('done')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
}

function FinishedScreen({
  onHome,
  onBack,
}: {
  onHome: () => void;
  onBack: (() => void) | null;
}) {
  const { t, lang, voiceEnabled } = useApp();
  useSpeak({
    text: t('allDone'),
    lang,
    enabled: voiceEnabled,
    autoplay: true,
  });
  return (
    <View style={styles.doneWrap}>
      <View style={styles.bigCheck}>
        <Ionicons name="checkmark" size={96} color={'#FDFBF7'} />
      </View>
      <Text style={styles.doneTitle}>{t('allDone')}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        {onBack && (
          <TouchableOpacity testID="finished-back-btn" style={styles.prevBtn} onPress={onBack}>
            <Ionicons name="chevron-back" size={28} color={colors.child.primaryDark} />
          </TouchableOpacity>
        )}
        <TouchableOpacity testID="back-home-btn" style={styles.primaryBtn} onPress={onHome}>
          <Text style={styles.primaryBtnText}>{t('backHome')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ChoiceOptions({
  options,
  lang,
  onPick,
  onPrev,
}: {
  options: any[];
  lang: Lang;
  onPick: () => void;
  onPrev?: (() => void) | null;
}) {
  const { t, voiceEnabled } = useApp();
  const [chosen, setChosen] = useState<string | null>(null);

  useSpeak({
    text: t('chooseCalm'),
    lang,
    enabled: voiceEnabled && !chosen,
    autoplay: true,
  });

  if (chosen) {
    const opt = options.find((o) => o.id === chosen);
    return <CalmedView opt={opt} lang={lang} onDone={onPick} onBack={() => setChosen(null)} />;
  }

  return (
    <>
      <View style={styles.choiceRow}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.id}
            testID={`choice-${o.id}`}
            onPress={() => setChosen(o.id)}
            style={styles.choiceCard}
            activeOpacity={0.85}
          >
            {!!o.image && (
              <Image source={{ uri: o.image }} style={styles.choiceImg} resizeMode="cover" />
            )}
            <Text style={styles.choiceLabel}>
              {loc(o, 'label', lang) || o.label_el}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {onPrev && (
        <TouchableOpacity
          testID="choice-prev-btn"
          style={styles.prevBtnFull}
          onPress={onPrev}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.child.primaryDark} />
          <Text style={styles.prevBtnText}>{t('previous')}</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

function CalmedView({
  opt,
  lang,
  onDone,
  onBack,
}: {
  opt: any;
  lang: Lang;
  onDone: () => void;
  onBack: () => void;
}) {
  const { t, voiceEnabled } = useApp();
  useSpeak({ text: t('calm'), lang, enabled: voiceEnabled, autoplay: true });
  return (
    <View style={styles.calmWrap}>
      <Text style={styles.calmTitle}>{t('calm')}</Text>
      {opt && (
        <Text style={styles.calmOpt}>
          {loc(opt, 'label', lang) || opt.label_el}
        </Text>
      )}
      <View style={styles.actionRow}>
        <TouchableOpacity
          testID="calm-back-btn"
          style={styles.prevBtn}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={28} color={colors.child.primaryDark} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="calm-done-btn"
          style={[styles.doneBtn, { flex: 1 }]}
          onPress={onDone}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={32} color="#FDFBF7" />
          <Text style={styles.doneBtnText}>{t('calmDone')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.child.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'center' },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.child.border,
  },
  progressDotActive: { backgroundColor: colors.child.primary, width: 26 },
  progressDotDone: { backgroundColor: colors.child.primaryDark },
  sosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.child.sos,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 44,
  },
  sosText: { color: '#FDFBF7', fontWeight: '700', fontSize: 15 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  imageWrap: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.child.surface,
    marginBottom: spacing.lg,
  },
  image: { width: '100%', height: '100%' },
  checkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(139, 168, 136, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.child.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.child.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
    letterSpacing: -0.5,
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  listenBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.child.primary,
    backgroundColor: colors.child.surface,
    marginBottom: spacing.lg,
  },
  listenBtnActive: {
    backgroundColor: colors.child.primary + '33',
  },
  doneBtn: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.child.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 22,
    borderRadius: radius.lg,
    minHeight: 88,
  },
  doneBtnText: { color: '#FDFBF7', fontSize: 22, fontWeight: '700', flexShrink: 1 },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  prevBtn: {
    width: 88,
    minHeight: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.child.surface,
    borderWidth: 2,
    borderColor: colors.child.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevBtnFull: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.child.surface,
    borderWidth: 2,
    borderColor: colors.child.primary,
    paddingVertical: 16,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  prevBtnText: { color: colors.child.primaryDark, fontSize: 18, fontWeight: '700' },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  choiceCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.child.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.child.border,
    minHeight: 160,
  },
  choiceImg: { width: '100%', height: 120 },
  choiceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.child.text,
    textAlign: 'center',
    padding: spacing.md,
  },
  calmWrap: { alignItems: 'center', gap: spacing.md },
  calmTitle: { fontSize: 28, fontWeight: '700', color: colors.child.text },
  calmOpt: { fontSize: 20, color: colors.child.textSecondary, marginBottom: spacing.md },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  bigCheck: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.child.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontSize: 36, fontWeight: '700', color: colors.child.text, textAlign: 'center' },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.child.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 18,
    borderRadius: radius.lg,
  },
  primaryBtnText: { color: '#FDFBF7', fontSize: 20, fontWeight: '700' },
});
