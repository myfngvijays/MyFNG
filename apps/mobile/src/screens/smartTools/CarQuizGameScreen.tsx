import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SmartToolShell, { PrimaryButton, ToolCard } from '../../components/smartTools/SmartToolShell';
import { COLORS } from '../../constants/theme';
import { getDailyQuizQuestions } from '../../lib/smartToolsLogic';

type Props = { navigation: any };

export default function CarQuizGameScreen({ navigation }: Props) {
  const questions = useMemo(() => getDailyQuizQuestions(), []);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;

  const q = questions[index];

  const pick = (optionIndex: number) => {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === q.correct) {
      setScore((s) => s + 1);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  };

  const next = () => {
    if (index >= questions.length - 1) {
      setFinished(true);
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setIndex((i) => i + 1);
      setSelected(null);
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  };

  const restart = () => {
    setIndex(0);
    setScore(0);
    setSelected(null);
    setFinished(false);
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const msg = pct >= 80 ? 'Car Expert!' : pct >= 50 ? 'Good Job!' : 'Keep Learning!';
    return (
      <SmartToolShell title="Car Quiz" subtitle="Daily challenge result" navigation={navigation}>
        <Animated.View style={[styles.resultCard, { transform: [{ scale }] }]}>
          <View style={styles.trophyWrap}>
            <Ionicons name="trophy" size={36} color="#F59E0B" />
          </View>
          <Text style={styles.resultScore}>
            {score}/{questions.length}
          </Text>
          <Text style={styles.resultPct}>{pct}% Correct</Text>
          <Text style={styles.resultMsg}>{msg}</Text>
          <Text style={styles.dailyNote}>New questions refresh every day</Text>
        </Animated.View>
        <PrimaryButton label="Play Again" onPress={restart} />
      </SmartToolShell>
    );
  }

  return (
    <SmartToolShell title="Car Quiz" subtitle={`Question ${index + 1} of ${questions.length} • Daily Set`} navigation={navigation}>
      <View style={styles.topRow}>
        <View style={styles.scorePill}>
          <Text style={styles.scorePillText}>Score {score}</Text>
        </View>
        {q.category ? (
          <View style={styles.catPill}>
            <Text style={styles.catPillText}>{q.category}</Text>
          </View>
        ) : null}
      </View>

      <Animated.View style={{ opacity: fade }}>
        {q.brandLogo ? (
          <ToolCard style={styles.logoCard}>
            <Image source={{ uri: q.brandLogo }} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.logoHint}>Identify the brand</Text>
          </ToolCard>
        ) : null}

        <Text style={styles.question}>{q.q}</Text>

        <View style={styles.options}>
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === q.correct;
            const show = selected !== null;
            let border = '#E5E7EB';
            let bg = '#FFFFFF';
            if (show && isCorrect) {
              border = '#059669';
              bg = '#ECFDF5';
            } else if (show && isSelected && !isCorrect) {
              border = '#DC2626';
              bg = '#FEF2F2';
            }
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.optionBtn, { backgroundColor: bg, borderColor: border }]}
                onPress={() => pick(i)}
                disabled={selected !== null}
                activeOpacity={0.88}
              >
                <Text style={styles.optionText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {selected !== null ? (
        <View style={{ marginTop: 12 }}>
          <PrimaryButton label={index === questions.length - 1 ? 'View Score Card' : 'Next Question'} onPress={next} />
        </View>
      ) : null}
    </SmartToolShell>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  scorePill: { backgroundColor: '#FDF2F8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#FBCFE8' },
  scorePillText: { fontSize: 12, fontWeight: '800', color: '#DB2777' },
  catPill: { backgroundColor: '#EFF6FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#BFDBFE' },
  catPillText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
  logoCard: { alignItems: 'center', paddingVertical: 18 },
  brandLogo: { width: 72, height: 72, marginBottom: 8 },
  logoHint: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  question: { fontSize: 18, fontWeight: '900', color: '#111827', lineHeight: 26, marginBottom: 14 },
  options: { gap: 10 },
  optionBtn: { borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14 },
  optionText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  resultCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  trophyWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  resultScore: { fontSize: 38, fontWeight: '900', color: '#FFFFFF' },
  resultPct: { marginTop: 4, fontSize: 16, fontWeight: '800', color: '#34D399' },
  resultMsg: { marginTop: 8, fontSize: 14, fontWeight: '700', color: '#D1D5DB' },
  dailyNote: { marginTop: 10, fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
});
