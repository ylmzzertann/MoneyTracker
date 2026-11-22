import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/CategoryTile';
import { Icon } from '@/components/Icon';
import { Sky } from '@/components/Sky';
import { Card, Eyebrow, ScreenHeader, Txt } from '@/components/ui';
import { useFormat } from '@/hooks/useFormat';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';
import type { IconName } from '@/theme/icons';

import { draftFromGrid, draftFromText, parseDefaults, useImportDraft, type ImportDraft } from '../draft';
import { ImportError } from '../parse/source';
import { pickStatementFile, readClipboardText } from '../readSource';

type Busy = 'paste' | 'file' | null;

/** Where imported transactions come from: pasted bank messages or a statement file. */
export function ImportScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { language } = useFormat();
  const region = useSettings((s) => s.region);
  const setDraft = useImportDraft((s) => s.setDraft);
  const [busy, setBusy] = useState<Busy>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Pasted messages stay in memory only while this flow is open.
  useEffect(() => () => setDraft(null), [setDraft]);

  const defaults = parseDefaults(region, language);
  const run = async (kind: Exclude<Busy, null>, read: () => Promise<ImportDraft | null>) => {
    setBusy(kind);
    setProblem(null);
    try {
      const draft = await read();
      if (draft) {
        setDraft(draft);
        router.push('/import/review');
      }
    } catch (e) {
      setProblem(e instanceof ImportError ? t(`import.problem.${e.problem}`) : t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const paste = () => run('paste', async () => draftFromText(await readClipboardText(), defaults, new Date()));
  const pickFile = () =>
    run('file', async () => {
      const file = await pickStatementFile();
      return file ? draftFromGrid(file.grid, file.name, defaults) : null;
    });

  return (
    <View style={styles.flex}>
      <Sky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        <ScreenHeader title={t('import.title')} backLabel={t('common.back')} onBack={() => router.back()} />
        <Txt tone="soft" size={14} style={styles.intro}>
          {t('import.intro')}
        </Txt>

        <View style={styles.gap}>
          <SourceCard
            icon="sms"
            color="#38BDF8"
            title={t('import.pasteTitle')}
            body={t('import.pasteBody')}
            busy={busy === 'paste'}
            disabled={busy !== null}
            onPress={() => void paste()}
          />
          <SourceCard
            icon="upload_file"
            color="#A78BFA"
            title={t('import.fileTitle')}
            body={t('import.fileBody')}
            busy={busy === 'file'}
            disabled={busy !== null}
            onPress={() => void pickFile()}
          />

          {problem && (
            <View accessibilityLiveRegion="polite" style={[styles.problem, { backgroundColor: isDark ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.18)' }]}>
              <Icon name="warning" size={18} color={colors.warning} />
              <Txt size={13} weight="semibold" style={[styles.flex, { color: isDark ? colors.warning : colors.text }]}>
                {problem}
              </Txt>
            </View>
          )}

          <Card>
            <View style={styles.soonRow}>
              <CategoryTile icon="auto_awesome" color="#E879F9" size={44} soft />
              <View style={styles.flex}>
                <Txt weight="bold" size={14.5}>
                  {t('import.aiTitle')}
                </Txt>
                <Txt tone="muted" size={12.5}>
                  {t('import.aiBody')}
                </Txt>
              </View>
            </View>
          </Card>

          <Eyebrow style={styles.stepsTitle}>{t('import.howTitle')}</Eyebrow>
          <Card>
            <View style={styles.steps}>
              <Step icon="content_paste" text={t('import.step1')} />
              <Step icon="swap_horiz" text={t('import.step2')} />
              <Step icon="check_circle" text={t('import.step3')} />
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function SourceCard({
  icon,
  color,
  title,
  body,
  busy,
  disabled,
  onPress,
}: {
  icon: IconName;
  color: string;
  title: string;
  body: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed, disabled && !busy && styles.dim]}>
      <Card>
        <View style={styles.sourceRow}>
          <CategoryTile icon={icon} color={color} size={54} selected />
          <View style={styles.flex}>
            <Txt weight="bold" size={16}>
              {title}
            </Txt>
            <Txt tone="muted" size={12.5}>
              {body}
            </Txt>
          </View>
          {busy ? <ActivityIndicator color={colors.accent} /> : <Icon name="chevron_right" size={22} color={colors.textMuted} />}
        </View>
      </Card>
    </Pressable>
  );
}

function Step({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepIcon, { boxShadow: `inset 0 0 0 1px ${colors.hairlineStrong}` }]}>
        <Icon name={icon} size={17} color={colors.accent} />
      </View>
      <Txt tone="soft" size={13} style={styles.flex}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { marginTop: 4, marginBottom: 18, lineHeight: 20 },
  gap: { gap: 12 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  soonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, opacity: 0.85 },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18 },
  stepsTitle: { marginTop: 10, marginLeft: 6 },
  steps: { gap: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  dim: { opacity: 0.5 },
});
