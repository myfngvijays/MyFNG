import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HealthCheckShell, {
  PrimaryButton,
  QuestionBlock,
  StepBlock,
  ToolCard,
} from '../../components/smartTools/HealthCheckShell';
import { COLORS } from '../../constants/theme';
import {
  advanceCarQuizProgress,
  getQuizProgressPercent,
  getQuizScoreMessage,
  loadCarQuizDailyProgress,
  recordCarQuizAnswer,
  resolveQuizQuestions,
  type CarQuizDailyProgress,
} from '../../lib/carQuizDaily';
import {
  formatQuizCountdown,
  getLocalDayKey,
  msUntilNextLocalDay,
  type QuizQuestion,
} from '../../lib/smartToolsLogic';
import { trackEvent } from '../../lib/trackEvent';

type Props = { navigation: any };

function HeroPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroPill}>
      <Ionicons name={icon} size={12} color="#F9A8D4" />
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

export default function CarQuizGameScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<CarQuizDailyProgress | null>(null);
  const [countdownMs, setCountdownMs] = useState(msUntilNextLocalDay());
  const [selected, setSelected] = useState<number | null>(null);
  const [justAnswered, setJustAnswered] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const questions = useMemo(
    () => (progress ? resolveQuizQuestions(progress) : []),
    [progress],
  );
  const question: QuizQuestion | undefined = progress ? questions[progress.currentIndex] : undefined;
  const total = questions.length;
  const progressPct = progress ? getQuizProgressPercent(progress) : 0;

  const refreshProgress = useCallback(async () => {
    setLoading(true);
    const next = await loadCarQuizDailyProgress();
    setProgress(next);
    const existingSelection = next.selections[next.currentIndex] ?? null;
    setSelected(existingSelection);
    if (existingSelection !== null && !next.completed) {
      setJustAnswered(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    trackEvent('car_quiz_started');
    void refreshProgress();
  }, [refreshProgress]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownMs(msUntilNextLocalDay());
      if (getLocalDayKey() !== progress?.dayKey) {
        void refreshProgress();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [progress?.dayKey, refreshProgress]);

  const animateQuestionChange = useCallback(
    (onDone: () => void) => {
      Animated.timing(fade, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
        onDone();
        fade.setValue(0);
        Animated.timing(fade, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    },
    [fade],
  );

  const pick = async (optionIndex: number) => {
    if (!progress || !question || selected !== null || progress.completed) return;

    trackEvent('car_quiz_answer_selected');
    setSelected(optionIndex);
    setJustAnswered(true);
    if (optionIndex === question.correct) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }

    const updated = await recordCarQuizAnswer(progress, optionIndex);
    setProgress(updated);
  };

  const goNext = useCallback(async () => {
    const currentProgress = progressRef.current;
    if (!currentProgress || selectedRef.current === null) return;
    const updated = await advanceCarQuizProgress(currentProgress);
    setProgress(updated);
    if (updated.completed) {
      trackEvent('car_quiz_completed', { score: updated.score });
      return;
    }
    animateQuestionChange(() => {
      setSelected(updated.selections[updated.currentIndex] ?? null);
      setJustAnswered(false);
    });
  }, [animateQuestionChange]);

  useEffect(() => {
    if (!justAnswered || selected === null || !progress || progress.completed) return;
    const timer = setTimeout(() => {
      void goNext();
    }, 2000);
    return () => clearTimeout(timer);
  }, [justAnswered, selected, progress, goNext]);

  if (loading || !progress) {
    return (
      <HealthCheckShell
        title="Car Quiz"
        subtitle="Loading today's challenge..."
        navigation={navigation}
        headerIcon="game-controller-outline"
        scroll={false}
      >
        <ToolCard variant="soft">
          <Text style={styles.loadingText}>Preparing your daily quiz...</Text>
        </ToolCard>
      </HealthCheckShell>
    );
  }

  if (progress.completed) {
    const pct = Math.round((progress.score / Math.max(1, total)) * 100);
    const msg = getQuizScoreMessage(progress.score, total);

    return (
      <HealthCheckShell
        title="Car Quiz"
        subtitle="Today's challenge complete"
        navigation={navigation}
        headerIcon="game-controller-outline"
        progress={100}
        stepLabel="Daily quiz finished"
      >
        <View style={styles.compactHero}>
          <View style={styles.compactHeroGlow} />
          <View style={styles.compactHeroRow}>
            <View style={styles.compactHeroCopy}>
              <Text style={styles.heroEyebrow}>Daily score card</Text>
              <Text style={styles.heroTitle}>{msg}</Text>
              <Text style={styles.heroBody}>
                You finished all {total} questions for today. A fresh quiz unlocks after midnight.
              </Text>
            </View>
            <View style={styles.heroIconRight}>
              <Ionicons name="trophy-outline" size={30} color="#F9A8D4" />
            </View>
          </View>
        </View>

        <Animated.View style={[styles.resultHero, { transform: [{ scale }] }]}>
          <View style={styles.resultGlow} />
          <Text style={styles.resultEyebrow}>Today's score</Text>
          <Text style={styles.resultAmount}>
            {progress.score}/{total}
          </Text>
          <Text style={styles.resultSub}>{pct}% correct</Text>
          <View style={styles.resultGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Questions</Text>
              <Text style={styles.statValue}>{total}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Correct</Text>
              <Text style={styles.statValue}>{progress.score}</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.reportSection}>
          <Text style={styles.reportTitle}>Q&A Report</Text>
          {questions.map((q, idx) => {
            const userAnswer = progress.selections[idx];
            const isCorrect = userAnswer === q.correct;
            return (
              <View
                key={`report-${idx}`}
                style={[
                  styles.reportItem,
                  { borderLeftColor: isCorrect ? '#059669' : '#DC2626' },
                ]}
              >
                <View style={styles.reportHeader}>
                  <View style={[styles.reportBadge, { backgroundColor: isCorrect ? '#ECFDF5' : '#FEF2F2' }]}>
                    <Ionicons
                      name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                      size={14}
                      color={isCorrect ? '#059669' : '#DC2626'}
                    />
                    <Text style={[styles.reportBadgeText, { color: isCorrect ? '#065F46' : '#991B1B' }]}>
                      {isCorrect ? 'Correct' : 'Wrong'}
                    </Text>
                  </View>
                  <Text style={styles.reportQNum}>Q{idx + 1}</Text>
                </View>
                <Text style={styles.reportQuestion}>{q.q}</Text>
                {!isCorrect && userAnswer !== null ? (
                  <Text style={styles.reportYourAnswer}>
                    Your answer: <Text style={{ fontWeight: '800' }}>{q.options[userAnswer]}</Text>
                  </Text>
                ) : null}
                <Text style={styles.reportCorrectAnswer}>
                  {isCorrect ? 'Answer' : 'Correct answer'}: <Text style={{ fontWeight: '800' }}>{q.options[q.correct]}</Text>
                </Text>
              </View>
            );
          })}
        </View>

        <ToolCard variant="soft">
          <View style={styles.waitRow}>
            <View style={styles.waitIcon}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.waitCopy}>
              <Text style={styles.waitTitle}>Next quiz in {formatQuizCountdown(countdownMs)}</Text>
              <Text style={styles.waitBody}>
                Come back tomorrow for a brand-new set of car questions.
              </Text>
            </View>
          </View>
        </ToolCard>

        <PrimaryButton label="Back to Smart Tools" icon="arrow-back-outline" onPress={() => navigation.goBack()} />
      </HealthCheckShell>
    );
  }

  return (
    <HealthCheckShell
      title="Car Quiz"
      subtitle={`Question ${progress.currentIndex + 1} of ${total} • Today's set`}
      navigation={navigation}
      headerIcon="game-controller-outline"
      progress={progressPct}
      stepLabel={`Daily quiz • ${getLocalDayKey()}`}
    >
      <View style={styles.compactHero}>
        <View style={styles.compactHeroGlow} />
        <View style={styles.compactHeroRow}>
          <View style={styles.compactHeroCopy}>
            <Text style={styles.heroTitle}>Daily Car Quiz Challenge</Text>
            <Text style={styles.heroBody}>
              One quiz every 24 hours. Answer all questions today, then return tomorrow for new ones.
            </Text>
            <View style={styles.heroPills}>
              <HeroPill icon="today-outline" label="1 set/day" />
              <HeroPill icon="timer-outline" label="24h window" />
              <HeroPill icon="trophy-outline" label="Score card" />
            </View>
          </View>
          <View style={styles.heroIconRight}>
            <Ionicons name="game-controller-outline" size={30} color="#F9A8D4" />
          </View>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.scorePill}>
          <Ionicons name="star" size={12} color="#DB2777" />
          <Text style={styles.scorePillText}>Score {progress.score}</Text>
        </View>
        {question?.category ? (
          <View style={styles.catPill}>
            <Text style={styles.catPillText}>{question.category}</Text>
          </View>
        ) : null}
        <View style={styles.timerPill}>
          <Ionicons name="moon-outline" size={12} color="#64748B" />
          <Text style={styles.timerPillText}>Resets in {formatQuizCountdown(countdownMs)}</Text>
        </View>
      </View>

      {question ? (
        <Animated.View style={{ opacity: fade }}>
          <StepBlock
            icon="help-circle-outline"
            title={`Question ${progress.currentIndex + 1}`}
            hint="Pick one answer to continue"
            badge="Daily challenge"
          >
            {question.brandLogo ? (
              <ToolCard variant="soft" style={styles.logoCard}>
                <BrandLogoImage uri={question.brandLogo} />
                <Text style={styles.logoHint}>Identify the brand</Text>
              </ToolCard>
            ) : null}

            <QuestionBlock label={question.q} required dense>
              <View style={styles.options}>
                {question.options.map((opt, i) => {
                  const isSelected = selected === i;
                  const isCorrect = i === question.correct;
                  const showResult = selected !== null;
                  let borderColor = '#E2E8F0';
                  let backgroundColor = '#FFFFFF';
                  let textColor = '#334155';

                  if (showResult && isCorrect) {
                    borderColor = '#059669';
                    backgroundColor = '#ECFDF5';
                    textColor = '#065F46';
                  } else if (showResult && isSelected && !isCorrect) {
                    borderColor = '#DC2626';
                    backgroundColor = '#FEF2F2';
                    textColor = '#991B1B';
                  } else if (isSelected) {
                    borderColor = COLORS.primary;
                    backgroundColor = '#EFF6FF';
                    textColor = COLORS.primary;
                  }

                  return (
                    <PrimaryOption
                      key={`${question.q}-${opt}`}
                      label={opt}
                      letter={String.fromCharCode(65 + i)}
                      onPress={() => {
                        void pick(i);
                      }}
                      disabled={selected !== null}
                      borderColor={borderColor}
                      backgroundColor={backgroundColor}
                      textColor={textColor}
                      showResult={showResult}
                      isCorrect={isCorrect}
                      isSelected={isSelected}
                    />
                  );
                })}
              </View>
            </QuestionBlock>
          </StepBlock>
        </Animated.View>
      ) : null}

      {justAnswered && selected !== null ? (
        <View style={styles.autoAdvanceHint}>
          <Ionicons name="time-outline" size={14} color="#64748B" />
          <Text style={styles.autoAdvanceText}>Next question in 2s...</Text>
        </View>
      ) : null}
    </HealthCheckShell>
  );
}

function BrandLogoImage({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[styles.brandLogo, styles.brandLogoFallback]}>
        <Ionicons name="help-circle-outline" size={36} color="#94A3B8" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.brandLogo}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

function PrimaryOption({
  label,
  letter,
  onPress,
  disabled,
  borderColor,
  backgroundColor,
  textColor,
  showResult,
  isCorrect,
  isSelected,
}: {
  label: string;
  letter: string;
  onPress: () => void;
  disabled: boolean;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  showResult: boolean;
  isCorrect: boolean;
  isSelected: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionBtn, { backgroundColor, borderColor }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}
    >
      <View style={[styles.optionLetter, { borderColor, backgroundColor: isSelected ? borderColor : '#F8FAFC' }]}>
        <Text style={[styles.optionLetterText, { color: isSelected ? '#FFFFFF' : '#64748B' }]}>{letter}</Text>
      </View>
      <Text style={[styles.optionText, { color: textColor }]}>{label}</Text>
      {showResult && isCorrect ? <Ionicons name="checkmark-circle" size={18} color="#059669" /> : null}
      {showResult && isSelected && !isCorrect ? <Ionicons name="close-circle" size={18} color="#DC2626" /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 18,
  },
  compactHero: {
    backgroundColor: '#111827',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(219, 39, 119, 0.35)',
  },
  compactHeroGlow: {
    position: 'absolute',
    top: -24,
    right: -10,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(219, 39, 119, 0.22)',
  },
  compactHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  compactHeroCopy: { flex: 1, paddingTop: 2 },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F9A8D4',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  heroIconRight: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(219, 39, 119, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249, 168, 212, 0.25)',
    marginTop: 2,
  },
  heroTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', marginBottom: 6 },
  heroBody: { fontSize: 12, fontWeight: '600', color: '#CBD5E1', lineHeight: 17 },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(249, 168, 212, 0.2)',
  },
  heroPillText: { fontSize: 10, fontWeight: '800', color: '#FCE7F3' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FDF2F8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  scorePillText: { fontSize: 12, fontWeight: '800', color: '#DB2777' },
  catPill: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  catPillText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timerPillText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  logoCard: { alignItems: 'center', paddingVertical: 16, marginBottom: 10 },
  brandLogo: { width: 72, height: 72, marginBottom: 8 },
  brandLogoFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderRadius: 12 },
  logoHint: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  options: { gap: 10 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterText: { fontSize: 12, fontWeight: '900' },
  optionText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  autoAdvanceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 8,
  },
  autoAdvanceText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  reportSection: { marginBottom: 16 },
  reportTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  reportItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  reportBadgeText: { fontSize: 11, fontWeight: '800' },
  reportQNum: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  reportQuestion: { fontSize: 13, fontWeight: '700', color: '#334155', lineHeight: 18, marginBottom: 4 },
  reportYourAnswer: { fontSize: 12, fontWeight: '600', color: '#DC2626', marginBottom: 2 },
  reportCorrectAnswer: { fontSize: 12, fontWeight: '600', color: '#059669' },
  resultHero: {
    backgroundColor: '#0B1F44',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#DB2777',
    overflow: 'hidden',
    marginBottom: 10,
  },
  resultGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: 'rgba(219, 39, 119, 0.25)',
  },
  resultEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  resultAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: '#F472B6',
    marginVertical: 6,
  },
  resultSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F9A8D4',
    textAlign: 'center',
    marginBottom: 16,
  },
  resultGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statValue: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  waitRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  waitIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  waitCopy: { flex: 1 },
  waitTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  waitBody: { fontSize: 12, fontWeight: '600', color: '#64748B', lineHeight: 18 },
});
