import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SmartToolShell, { PrimaryButton, ToolCard } from '../../components/smartTools/SmartToolShell';
import { COLORS } from '../../constants/theme';
import {
  computeHealthScoreFromAnswers,
  getVisibleHealthSteps,
  healthGrade,
  type HealthStep,
} from '../../lib/smartToolsLogic';

type Props = { navigation: any };

export default function CarHealthCheckScreen({ navigation }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentStepId, setCurrentStepId] = useState('service_gap');
  const [done, setDone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const steps = useMemo(() => getVisibleHealthSteps(answers), [answers]);
  const current = steps.find((s) => s.id === currentStepId) || steps[0];
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === currentStepId));
  const score = useMemo(() => computeHealthScoreFromAnswers(answers), [answers]);
  const grade = healthGrade(score);

  const animateNext = (next: () => void) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slide, { toValue: -16, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      next();
      slide.setValue(16);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

  const pick = (step: HealthStep, value: string) => {
    const nextAnswers = { ...answers, [step.id]: value };
    const nextSteps = getVisibleHealthSteps(nextAnswers);
    const idx = nextSteps.findIndex((s) => s.id === step.id);
    const isLast = idx >= nextSteps.length - 1;

    animateNext(() => {
      setAnswers(nextAnswers);
      if (isLast) {
        setDone(true);
        return;
      }
      setCurrentStepId(nextSteps[idx + 1].id);
    });
  };

  const restart = () => {
    setAnswers({});
    setCurrentStepId('service_gap');
    setDone(false);
  };

  if (done) {
    return (
      <SmartToolShell title="Car Health Check" subtitle="Your health report" navigation={navigation}>
        <View style={styles.heroCard}>
          <View style={[styles.ringOuter, { borderColor: grade.color }]}>
            <View style={styles.ringInner}>
              <Text style={[styles.score, { color: grade.color }]}>{score}%</Text>
              <Text style={styles.scoreLabel}>Health Score</Text>
            </View>
          </View>
          <Text style={[styles.grade, { color: grade.color }]}>{grade.label}</Text>
          <Text style={styles.tip}>{grade.tip}</Text>
        </View>

        <ToolCard>
          <Text style={styles.sectionTitle}>Assessment Summary</Text>
          {steps.map((step) => {
            const val = answers[step.id];
            const opt = step.options.find((o) => o.value === val);
            return (
              <View key={step.id} style={styles.summaryRow}>
                <View style={[styles.dot, { backgroundColor: (opt?.score || 0) <= 5 ? '#10B981' : (opt?.score || 0) <= 12 ? '#F59E0B' : '#EF4444' }]} />
                <View style={styles.summaryText}>
                  <Text style={styles.summaryQ}>{step.question}</Text>
                  <Text style={styles.summaryA}>{opt?.label || '—'}</Text>
                </View>
              </View>
            );
          })}
        </ToolCard>

        <PrimaryButton label="Book Service via Misa AI" icon="sparkles" onPress={() => navigation.navigate('AIBooking', { prefill: 'Suggest service based on my car health check report' })} />
        <TouchableOpacity style={styles.linkBtn} onPress={restart}>
          <Text style={styles.linkText}>Run Check Again</Text>
        </TouchableOpacity>
      </SmartToolShell>
    );
  }

  if (!current) return null;
  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <SmartToolShell title="Car Health Check" subtitle={`Question ${stepIndex + 1} of ${steps.length}`} navigation={navigation}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
        <ToolCard style={styles.questionCard}>
          <View style={styles.qIconWrap}>
            <Ionicons name="medkit" size={22} color="#059669" />
          </View>
          <Text style={styles.question}>{current.question}</Text>
          {current.hint ? <Text style={styles.hint}>{current.hint}</Text> : null}
        </ToolCard>
        <View style={styles.options}>
          {current.options.map((opt) => (
            <TouchableOpacity key={opt.value} style={styles.optionBtn} onPress={() => pick(current, opt.value)} activeOpacity={0.88}>
              <Text style={styles.optionText}>{opt.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </SmartToolShell>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#DBEAFE', marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#059669', borderRadius: 999 },
  questionCard: { marginBottom: 12 },
  qIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  question: { fontSize: 18, fontWeight: '900', color: '#111827', lineHeight: 26 },
  hint: { marginTop: 8, fontSize: 12, fontWeight: '600', color: '#6B7280', lineHeight: 18 },
  options: { gap: 10 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  optionText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#374151' },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 14,
  },
  ringOuter: { width: 132, height: 132, borderRadius: 66, borderWidth: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ringInner: { alignItems: 'center' },
  score: { fontSize: 34, fontWeight: '900' },
  scoreLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginTop: 2 },
  grade: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  tip: { fontSize: 13, fontWeight: '600', color: '#D1D5DB', textAlign: 'center', lineHeight: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#111827', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  summaryText: { flex: 1 },
  summaryQ: { fontSize: 12, fontWeight: '700', color: '#374151' },
  summaryA: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#6B7280' },
  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  linkText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
});
