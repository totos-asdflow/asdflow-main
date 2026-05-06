import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  createAudioPlayer,
} from 'expo-audio';
import { api, Routine, Step, Asset, StepOption } from '../../../src/api';
import { useApp } from '../../../src/ctx';
import { colors, radius, spacing } from '../../../src/theme';

const ROUTINE_ICONS = [
  'sunny-outline',
  'moon-outline',
  'home-outline',
  'school-outline',
  'restaurant-outline',
  'medkit-outline',
  'bus-outline',
  'bicycle-outline',
  'water-outline',
  'book-outline',
  'brush-outline',
  'football-outline',
  'musical-notes-outline',
  'happy-outline',
  'gift-outline',
  'leaf-outline',
  'cafe-outline',
  'bed-outline',
  'paw-outline',
  'fitness-outline',
  'color-palette-outline',
  'heart-outline',
  'star-outline',
  'sparkles-outline',
];

const ROUTINE_COLORS = [
  '#E8C999',
  '#8BA888',
  '#6B7A8F',
  '#D4A5A5',
  '#A5C9CA',
  '#C9B8E2',
  '#F2C57C',
  '#9CC5A1',
  '#E8A5C0',
  '#8FAADC',
];

export default function Builder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useApp();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [editing, setEditing] = useState<Step | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pendingField, setPendingField] = useState<
    { kind: 'step' } | { kind: 'option'; index: number } | null
  >(null);

  useEffect(() => {
    if (!id) return;
    api.getRoutine(id).then(setRoutine);
  }, [id]);

  const save = async (next: Routine) => {
    setRoutine(next);
    try {
      await api.updateRoutine(next.id, {
        name_el: next.name_el,
        name_en: next.name_en,
        color: next.color,
        icon: next.icon,
        steps: next.steps,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to save routine');
      console.error(e);
    }
  };

  if (!routine) return <SafeAreaView style={styles.container} />;

  const addStep = () => {
    const step: Step = {
      id: Math.random().toString(36).slice(2),
      type: 'task',
      title_el: lang === 'el' ? 'Νέο βήμα' : 'New step',
      title_en: 'New step',
    };
    const next = { ...routine, steps: [...routine.steps, step] };
    save(next);
    setEditing(step);
  };

  const updateStep = (s: Step) => {
    const next = {
      ...routine,
      steps: routine.steps.map((x) => (x.id === s.id ? s : x)),
    };
    save(next);
    setEditing(s);
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const t2 = idx + dir;
    if (t2 < 0 || t2 >= routine.steps.length) return;
    const steps = [...routine.steps];
    [steps[idx], steps[t2]] = [steps[t2], steps[idx]];
    save({ ...routine, steps });
  };

  const deleteStep = (sid: string) => {
    const next = { ...routine, steps: routine.steps.filter((x) => x.id !== sid) };
    save(next);
    if (editing?.id === sid) setEditing(null);
  };

  const openAssetPicker = async (kind: 'step' | 'option', index?: number) => {
    setPendingField(kind === 'step' ? { kind } : { kind, index: index! });
    const list = await api.listAssets();
    setAssets(list);
    setAssetPickerOpen(true);
  };

  const pickImageAndUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.3,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const data = `data:image/jpeg;base64,${a.base64}`;
    applyImage(data);
    // also save to library
    api.createAsset(`asset-${Date.now()}`, data).catch(() => {});
  };

  const applyImage = (uri: string) => {
    if (!editing) return;
    if (!pendingField || pendingField.kind === 'step') {
      const s = { ...editing, image: uri };
      updateStep(s);
    } else {
      const options = [...(editing.options || [])];
      options[pendingField.index] = { ...options[pendingField.index], image: uri };
      updateStep({ ...editing, options });
    }
    setAssetPickerOpen(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable testID="builder-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.admin.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('edit')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={styles.group}>
            <Text style={styles.label}>{t('title')}</Text>
            <TextInput
              testID="routine-name"
              style={styles.input}
              value={lang === 'el' ? routine.name_el : routine.name_en}
              onChangeText={(v) =>
                setRoutine(
                  lang === 'el'
                    ? { ...routine, name_el: v, name_en: routine.name_en || v }
                    : { ...routine, name_en: v, name_el: routine.name_el || v }
                )
              }
              onBlur={() => save(routine)}
            />

            <Text style={[styles.label, { marginTop: spacing.sm }]}>
              {lang === 'el' ? 'Εικονίδιο' : 'Icon'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
              {ROUTINE_ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  testID={`icon-${ic}`}
                  onPress={() => save({ ...routine, icon: ic })}
                  style={[
                    styles.iconChoice,
                    routine.icon === ic && styles.iconChoiceActive,
                  ]}
                >
                  <Ionicons
                    name={ic as any}
                    size={26}
                    color={routine.icon === ic ? '#fff' : colors.admin.text}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { marginTop: spacing.sm }]}>
              {lang === 'el' ? 'Χρώμα' : 'Color'}
            </Text>
            <View style={styles.colorRow}>
              {ROUTINE_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  testID={`color-${c}`}
                  onPress={() => save({ ...routine, color: c })}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    routine.color === c && styles.colorSwatchActive,
                  ]}
                >
                  {routine.color === c && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>
              {t('routines')} · {routine.steps.length}
            </Text>
            <TouchableOpacity testID="add-step-btn" onPress={addStep} style={styles.addBtn}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>{t('addStep')}</Text>
            </TouchableOpacity>
          </View>

          {routine.steps.map((s, idx) => (
            <View key={s.id} style={styles.stepRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepIdx}>
                  {idx + 1}. {s.type === 'choice' ? t('choice') : t('task')}
                </Text>
                <Text style={styles.stepTitle}>
                  {lang === 'el' ? s.title_el : s.title_en}
                </Text>
                {s.type === 'choice' && s.options && s.options.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 4, marginTop: 4 }}
                  >
                    {s.options.map((o, i) =>
                      !!o.image && (
                        <Image
                          key={i}
                          source={{ uri: o.image }}
                          style={styles.optionThumb}
                        />
                      )
                    )}
                  </ScrollView>
                )}
              </View>
              {!!s.image && (
                <Image source={{ uri: s.image }} style={styles.thumb} />
              )}
              <View style={styles.stepBtnCol}>
                <TouchableOpacity
                  testID={`step-up-${s.id}`}
                  onPress={() => moveStep(idx, -1)}
                  style={styles.smallBtn}
                >
                  <Ionicons name="chevron-up" size={18} color={colors.admin.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`step-down-${s.id}`}
                  onPress={() => moveStep(idx, 1)}
                  style={styles.smallBtn}
                >
                  <Ionicons name="chevron-down" size={18} color={colors.admin.text} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                testID={`edit-step-${s.id}`}
                onPress={() => setEditing(s)}
                style={styles.smallBtn}
              >
                <Ionicons name="create-outline" size={20} color={colors.admin.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                testID={`delete-step-${s.id}`}
                onPress={() => deleteStep(s.id)}
                style={styles.smallBtn}
              >
                <Ionicons name="trash-outline" size={20} color={colors.admin.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Step editor modal */}
      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('edit')}</Text>
              <Pressable testID="step-editor-close" onPress={() => setEditing(null)} style={styles.iconBtn}>
                <Ionicons name="close" size={24} color={colors.admin.text} />
              </Pressable>
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
                {editing && (
                  <>
                    <Text style={styles.label}>{t('stepType')}</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {(['task', 'choice'] as const).map((tp) => (
                        <TouchableOpacity
                          key={tp}
                          testID={`step-type-${tp}`}
                          style={[
                            styles.segBtn,
                            editing.type === tp && styles.segBtnActive,
                          ]}
                          onPress={() =>
                            updateStep({
                              ...editing,
                              type: tp,
                              options: tp === 'choice' ? editing.options || [] : undefined,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.segText,
                              editing.type === tp && styles.segTextActive,
                            ]}
                          >
                            {tp === 'task' ? t('task') : t('choice')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>{t('title')}</Text>
                    <TextInput
                      testID="step-title"
                      style={styles.input}
                      value={lang === 'el' ? editing.title_el : editing.title_en}
                      onChangeText={(v) =>
                        setEditing(
                          lang === 'el'
                            ? { ...editing, title_el: v, title_en: editing.title_en || v }
                            : { ...editing, title_en: v, title_el: editing.title_el || v }
                        )
                      }
                      onBlur={() => updateStep(editing)}
                    />

                    <Text style={styles.label}>{t('image')}</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <TouchableOpacity
                        testID="step-image-upload"
                        style={styles.altBtn}
                        onPress={() => {
                          setPendingField({ kind: 'step' });
                          pickImageAndUpload();
                        }}
                      >
                        <Ionicons name="cloud-upload-outline" size={18} color={colors.admin.primary} />
                        <Text style={styles.altBtnText}>{t('uploadImage')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID="step-image-library"
                        style={styles.altBtn}
                        onPress={() => openAssetPicker('step')}
                      >
                        <Ionicons name="images-outline" size={18} color={colors.admin.primary} />
                        <Text style={styles.altBtnText}>{t('pickFromLibrary')}</Text>
                      </TouchableOpacity>
                    </View>
                    {!!editing.image && (
                      <Image source={{ uri: editing.image }} style={styles.preview} />
                    )}

                    <VoiceRecorder
                      label={t('voiceParent')}
                      value={lang === 'el' ? editing.voice_el : editing.voice_en}
                      onChange={(uri) =>
                        updateStep(
                          lang === 'el'
                            ? { ...editing, voice_el: uri || undefined }
                            : { ...editing, voice_en: uri || undefined }
                        )
                      }
                      testIdPrefix={`voice-${lang}`}
                    />

                    {editing.type === 'choice' && (
                      <>
                        <View style={styles.sectionRow}>
                          <Text style={styles.label}>{t('choiceOptions')}</Text>
                          <TouchableOpacity
                            testID="add-option-btn"
                            style={styles.addBtn}
                            onPress={() => {
                              const options = [...(editing.options || [])];
                              if (options.length >= 3) return;
                              options.push({
                                id: Math.random().toString(36).slice(2),
                                label_el: '',
                                label_en: '',
                              });
                              updateStep({ ...editing, options });
                            }}
                          >
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={styles.addBtnText}>{t('addOption')}</Text>
                          </TouchableOpacity>
                        </View>
                        {(editing.options || []).map((o, idx) => (
                          <View key={o.id} style={styles.optionCard}>
                            <View style={{ flex: 1, gap: 4 }}>
                              <TextInput
                                testID={`option-label-${idx}`}
                                placeholder={t('title')}
                                style={styles.input}
                                value={lang === 'el' ? o.label_el : o.label_en}
                                onChangeText={(v) => {
                                  const options = [...(editing.options || [])];
                                  if (lang === 'el') {
                                    options[idx] = {
                                      ...options[idx],
                                      label_el: v,
                                      label_en: options[idx].label_en || v,
                                    };
                                  } else {
                                    options[idx] = {
                                      ...options[idx],
                                      label_en: v,
                                      label_el: options[idx].label_el || v,
                                    };
                                  }
                                  setEditing({ ...editing, options });
                                }}
                                onBlur={() => updateStep(editing)}
                              />
                              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                <TouchableOpacity
                                  testID={`option-image-upload-${idx}`}
                                  style={styles.altBtn}
                                  onPress={() => {
                                    setPendingField({ kind: 'option', index: idx });
                                    pickImageAndUpload();
                                  }}
                                >
                                  <Ionicons name="cloud-upload-outline" size={16} color={colors.admin.primary} />
                                  <Text style={styles.altBtnText}>{t('uploadImage')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  testID={`option-image-library-${idx}`}
                                  style={styles.altBtn}
                                  onPress={() => openAssetPicker('option', idx)}
                                >
                                  <Ionicons name="images-outline" size={16} color={colors.admin.primary} />
                                  <Text style={styles.altBtnText}>{t('pickFromLibrary')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  testID={`option-delete-${idx}`}
                                  onPress={() => {
                                    const options = (editing.options || []).filter((_, i) => i !== idx);
                                    updateStep({ ...editing, options });
                                  }}
                                  style={styles.smallBtn}
                                >
                                  <Ionicons name="trash-outline" size={18} color={colors.admin.danger} />
                                </TouchableOpacity>
                                {!!o.image && <Image source={{ uri: o.image }} style={styles.thumb} />}
                              </View>
                            </View>
                          </View>
                        ))}
                      </>
                    )}
                  </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Asset library picker */}
      <Modal visible={assetPickerOpen} animationType="slide" transparent onRequestClose={() => setAssetPickerOpen(false)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('assets')}</Text>
              <Pressable onPress={() => setAssetPickerOpen(false)} style={styles.iconBtn}>
                <Ionicons name="close" size={24} color={colors.admin.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.assetGrid}>
              {assets.length === 0 && (
                <Text style={{ color: colors.admin.textSecondary, padding: spacing.lg }}>
                  {t('noAssets')}
                </Text>
              )}
              {assets.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  testID={`asset-pick-${a.id}`}
                  onPress={() => applyImage(a.data)}
                  style={styles.assetCell}
                >
                  <Image source={{ uri: a.data }} style={{ width: '100%', height: '100%' }} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
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
  group: {
    backgroundColor: colors.admin.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.admin.border,
    gap: 6,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.admin.textSecondary, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.admin.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    color: colors.admin.text,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.admin.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.admin.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.admin.surface,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.admin.border,
  },
  stepIdx: { fontSize: 11, fontWeight: '700', color: colors.admin.textSecondary, textTransform: 'uppercase' },
  stepTitle: { fontSize: 15, fontWeight: '600', color: colors.admin.text, marginTop: 2 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  optionThumb: { width: 24, height: 24, borderRadius: 4 },
  stepBtnCol: { flexDirection: 'column' },
  smallBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.admin.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    height: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.admin.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.admin.text },
  segBtn: {
    flex: 1,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.admin.border,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  segBtnActive: { backgroundColor: colors.admin.primary, borderColor: colors.admin.primary },
  segText: { color: colors.admin.text, fontWeight: '600' },
  segTextActive: { color: '#fff' },
  altBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.admin.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  altBtnText: { color: colors.admin.primary, fontWeight: '600', fontSize: 13 },
  preview: { width: '100%', height: 180, borderRadius: radius.md, marginTop: 8 },
  optionCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.admin.surface,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.admin.border,
    alignItems: 'center',
  },
  assetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: spacing.md },
  assetCell: { width: '31%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.admin.surface },
  recRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: 4 },
  recBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.admin.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  recBtnActive: { backgroundColor: '#B56B59', borderColor: '#B56B59' },
  recBtnText: { color: colors.admin.primary, fontWeight: '600', fontSize: 13 },
  recBtnTextActive: { color: '#fff' },
  iconRow: { gap: 8, paddingVertical: 4 },
  iconChoice: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: colors.admin.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChoiceActive: {
    backgroundColor: colors.admin.primary,
    borderColor: colors.admin.primary,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: colors.admin.text,
  },
});

function VoiceRecorder({
  label,
  value,
  onChange,
  testIdPrefix,
}: {
  label: string;
  value?: string | null;
  onChange: (uri: string | null) => void;
  testIdPrefix: string;
}) {
  const { t } = useApp();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      console.log('rec start err', e);
    }
  };

  const stop = async () => {
    try {
      setBusy(true);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      // Fetch blob and convert to base64 data URI
      const res = await fetch(uri);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        onChange(dataUri);
        setBusy(false);
      };
      reader.onerror = () => setBusy(false);
      reader.readAsDataURL(blob);
    } catch (e) {
      console.log('rec stop err', e);
      setBusy(false);
    }
  };

  const play = () => {
    if (!value) return;
    try {
      const p = createAudioPlayer({ uri: value });
      p.play();
    } catch (e) {
      console.log('play err', e);
    }
  };

  const clear = () => onChange(null);

  return (
    <View style={{ gap: 4, marginTop: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.recRow}>
        {!recState.isRecording ? (
          <TouchableOpacity testID={`${testIdPrefix}-record`} onPress={start} style={styles.recBtn}>
            <Ionicons name="mic-outline" size={18} color={colors.admin.primary} />
            <Text style={styles.recBtnText}>{t('record')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            testID={`${testIdPrefix}-stop`}
            onPress={stop}
            style={[styles.recBtn, styles.recBtnActive]}
          >
            <Ionicons name="stop-circle-outline" size={18} color="#fff" />
            <Text style={[styles.recBtnText, styles.recBtnTextActive]}>{t('stopRec')}</Text>
          </TouchableOpacity>
        )}
        {!!value && !recState.isRecording && (
          <>
            <TouchableOpacity testID={`${testIdPrefix}-play`} onPress={play} style={styles.recBtn}>
              <Ionicons name="play-outline" size={18} color={colors.admin.primary} />
              <Text style={styles.recBtnText}>{t('playRec')}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID={`${testIdPrefix}-delete`} onPress={clear} style={styles.recBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.admin.danger} />
            </TouchableOpacity>
          </>
        )}
        {busy && <ActivityIndicator color={colors.admin.primary} />}
      </View>
    </View>
  );
}
