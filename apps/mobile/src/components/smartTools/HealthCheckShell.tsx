import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { COLORS } from '../../constants/theme';

type Props = {
  title: string;
  subtitle?: string;
  navigation: any;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  progress?: number;
  stepLabel?: string;
  headerIcon?: keyof typeof Ionicons.glyphMap;
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0B1F44',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  android: { elevation: 4 },
  default: {},
});

const softShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 2 },
  default: {},
});

export default function HealthCheckShell({
  title,
  subtitle,
  navigation,
  children,
  footer,
  scroll = true,
  progress,
  stepLabel,
  headerIcon = 'pulse',
}: Props) {
  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scroll, styles.content]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <View style={styles.headerAccent} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name={headerIcon} size={16} color={COLORS.primary} />
          </View>
        </View>
        {typeof progress === 'number' ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressMeta}>
              <Text style={styles.progressLabel}>{stepLabel || 'Progress'}</Text>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
            </View>
          </View>
        ) : null}
      </View>
      {body}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function ToolCard({
  children,
  style,
  variant = 'default',
}: {
  children: React.ReactNode;
  style?: object;
  variant?: 'default' | 'soft' | 'outline';
}) {
  const variantStyle =
    variant === 'soft' ? cardStyles.soft : variant === 'outline' ? cardStyles.outline : cardStyles.card;
  return <View style={[variantStyle, style]}>{children}</View>;
}

export function HeroCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[heroStyles.wrap, style]}>
      <View style={heroStyles.glowA} />
      <View style={heroStyles.glowB} />
      <View style={heroStyles.inner}>{children}</View>
    </View>
  );
}

export function FeaturePills({ items }: { items: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> }) {
  return (
    <View style={pillStyles.row}>
      {items.map((item) => (
        <View key={item.label} style={pillStyles.pill}>
          <Ionicons name={item.icon} size={13} color="#93C5FD" />
          <Text style={pillStyles.text}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function ConsentCard({
  checked,
  onToggle,
  title,
  body,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  body: string;
}) {
  return (
    <TouchableOpacity
      style={[consentStyles.card, checked ? consentStyles.cardOn : null]}
      onPress={onToggle}
      activeOpacity={0.9}
    >
      <View style={[consentStyles.iconWrap, checked ? consentStyles.iconWrapOn : null]}>
        <Ionicons name={checked ? 'shield-checkmark' : 'shield-outline'} size={20} color={checked ? '#FFFFFF' : COLORS.primary} />
      </View>
      <View style={consentStyles.copy}>
        <Text style={consentStyles.title}>{title}</Text>
        <Text style={consentStyles.body}>{body}</Text>
      </View>
      <View style={[consentStyles.check, checked ? consentStyles.checkOn : null]}>
        {checked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
      </View>
    </TouchableOpacity>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={fieldStyles.label}>{children}</Text>;
}

export function FieldInput({
  value,
  onChangeText,
  placeholder,
  ...rest
}: React.ComponentProps<typeof TextInput>) {
  return (
    <View style={fieldStyles.inputWrap}>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        {...rest}
      />
    </View>
  );
}

export function OptionSelectField({
  value,
  onChange,
  options,
  sheetTitle,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  sheetTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((opt) => opt.value === value) ?? options[0];

  return (
    <>
      <View style={fieldStyles.inputWrap}>
        <TouchableOpacity style={fieldStyles.selectTouch} onPress={() => setOpen(true)} activeOpacity={0.88}>
          <Text style={[fieldStyles.input, fieldStyles.selectValue]} numberOfLines={1}>
            {selected?.label}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={selectStyles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={selectStyles.sheet}>
          <Text style={questionStyles.label}>{sheetTitle ?? 'Select option'}</Text>
          {options.map((opt) => {
            const active = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[selectStyles.option, active ? selectStyles.optionActive : null]}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                activeOpacity={0.88}
              >
                <Text style={[selectStyles.optionText, active ? selectStyles.optionTextActive : null]}>{opt.label}</Text>
                {active ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

export function InlineOptionField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <View style={fieldStyles.inputWrap}>
      <View style={fieldStyles.inlineOptions}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[fieldStyles.inlineOption, active ? fieldStyles.inlineOptionActive : null]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.88}
            >
              <Text
                style={[fieldStyles.inlineOptionText, active ? fieldStyles.inlineOptionTextActive : null]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[btnStyles.primary, disabled ? btnStyles.primaryDisabled : null]}
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
    >
      {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
      <Text style={btnStyles.primaryText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={btnStyles.secondary} onPress={onPress} activeOpacity={0.88}>
      <Text style={btnStyles.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={btnStyles.link} onPress={onPress} activeOpacity={0.85}>
      <Text style={btnStyles.linkText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ChipRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={chipStyles.row}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[chipStyles.chip, active ? chipStyles.chipActive : null]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.85}
          >
            <Text style={[chipStyles.text, active ? chipStyles.textActive : null]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function StepBlock({
  icon,
  title,
  hint,
  badge,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <ToolCard variant="outline">
      <View style={stepStyles.head}>
        <View style={stepStyles.icon}>
          <Ionicons name={icon} size={17} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={stepStyles.title}>{title}</Text>
          {hint ? <Text style={stepStyles.hint}>{hint}</Text> : null}
        </View>
      </View>
      {badge ? (
        <View style={stepStyles.badge}>
          <Ionicons name="sparkles" size={11} color="#059669" />
          <Text style={stepStyles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {children}
    </ToolCard>
  );
}

export function QuestionBlock({
  label,
  hint,
  required,
  dense,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  dense?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[questionStyles.block, dense ? questionStyles.blockDense : null]}>
      <Text style={questionStyles.label} allowFontScaling={false}>
        {label}
        {required ? <Text style={questionStyles.required}> *</Text> : <Text style={questionStyles.requiredHidden}> *</Text>}
      </Text>
      {hint ? <Text style={questionStyles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function RegPlate({ number }: { number: string }) {
  return (
    <View style={regStyles.wrap}>
      <View style={regStyles.chip}>
        <Text style={regStyles.chipText}>IND</Text>
      </View>
      <Text style={regStyles.number}>{number}</Text>
    </View>
  );
}

export function SelectChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={chipStyles.grid}>
      {options.map((opt) => {
        const on = selected.includes(opt.id);
        return (
          <TouchableOpacity
            key={opt.id}
            style={[chipStyles.gridChip, on ? chipStyles.chipActive : null]}
            onPress={() => onToggle(opt.id)}
            activeOpacity={0.88}
          >
            <Text style={[chipStyles.gridText, on ? chipStyles.textActive : null]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ToggleOption({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[toggleStyles.row, checked ? toggleStyles.rowOn : null]} onPress={onPress} activeOpacity={0.88}>
      <View style={[toggleStyles.box, checked ? toggleStyles.boxOn : null]}>
        {checked ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
      </View>
      <Text style={[toggleStyles.label, checked ? toggleStyles.labelOn : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function TwoColRow({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <View style={fieldStyles.twoCol}>
      <View style={fieldStyles.col}>{left}</View>
      <View style={fieldStyles.col}>{right}</View>
    </View>
  );
}

export type HealthFuelType = 'Petrol' | 'Diesel' | 'CNG';

const FUEL_COLORS: Record<HealthFuelType, { bg: string; border: string; text: string; tint: string }> = {
  Petrol: { bg: '#2563EB', border: '#93C5FD', text: '#1D4ED8', tint: '#EFF6FF' },
  Diesel: { bg: '#D97706', border: '#FCD34D', text: '#B45309', tint: '#FFFBEB' },
  CNG: { bg: '#16A34A', border: '#86EFAC', text: '#15803D', tint: '#F0FDF4' },
};

export function FuelChipRow({
  value,
  onChange,
}: {
  value: HealthFuelType;
  onChange: (v: HealthFuelType) => void;
}) {
  return (
    <View style={fuelStyles.row}>
      {(['Petrol', 'Diesel', 'CNG'] as HealthFuelType[]).map((fuel) => {
        const active = value === fuel;
        const colors = FUEL_COLORS[fuel];
        return (
          <TouchableOpacity
            key={fuel}
            style={[
              fuelStyles.chip,
              {
                borderColor: active ? colors.bg : colors.border,
                backgroundColor: active ? colors.bg : colors.tint,
              },
            ]}
            onPress={() => onChange(fuel)}
            activeOpacity={0.88}
          >
            <Text style={[fuelStyles.text, { color: active ? '#FFFFFF' : colors.text }]}>{fuel}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function YearPickerField({
  value,
  onChange,
  placeholder = 'Select year',
}: {
  value?: number;
  onChange: (year: number) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 1989 }, (_, i) => current - i);
  }, []);

  return (
    <>
      <TouchableOpacity style={yearStyles.field} onPress={() => setOpen(true)} activeOpacity={0.88}>
        <Text style={[yearStyles.value, !value ? yearStyles.placeholder : null]}>{value ? String(value) : placeholder}</Text>
        <Ionicons name="calendar-outline" size={18} color="#64748B" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={yearStyles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={yearStyles.sheet}>
          <View style={yearStyles.sheetHead}>
            <Text style={yearStyles.sheetTitle}>Registration Year</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={yearStyles.done}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={years}
            keyExtractor={(y) => String(y)}
            style={{ maxHeight: 280 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const active = value === item;
              return (
                <TouchableOpacity
                  style={[yearStyles.option, active ? yearStyles.optionActive : null]}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={[yearStyles.optionText, active ? yearStyles.optionTextActive : null]}>{item}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

function formatHealthDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
}

function parseDisplayDate(raw?: string): Date {
  if (!raw) return new Date();
  const dmy = raw.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function DatePickerField({
  value,
  onChange,
  placeholder = 'DD-MM-YYYY',
}: {
  value?: string;
  onChange: (formatted: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseDisplayDate(value));

  const onPickerChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (!selected) return;
    setDraft(selected);
    onChange(formatHealthDate(selected));
  };

  return (
    <>
      <TouchableOpacity
        style={yearStyles.field}
        onPress={() => {
          setDraft(parseDisplayDate(value));
          setOpen(true);
        }}
        activeOpacity={0.88}
      >
        <Text style={[yearStyles.value, !value ? yearStyles.placeholder : null]}>{value || placeholder}</Text>
        <Ionicons name="calendar-outline" size={18} color="#64748B" />
      </TouchableOpacity>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker value={draft} mode="date" display="default" onChange={onPickerChange} />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <TouchableOpacity style={yearStyles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={yearStyles.sheet}>
            <View style={yearStyles.sheetHead}>
              <Text style={yearStyles.sheetTitle}>Select Date</Text>
              <TouchableOpacity
                onPress={() => {
                  onChange(formatHealthDate(draft));
                  setOpen(false);
                }}
              >
                <Text style={yearStyles.done}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker value={draft} mode="date" display="spinner" onChange={(_e, d) => d && setDraft(d)} />
          </View>
        </Modal>
      ) : null}
    </>
  );
}

export function SectionDivider() {
  return <View style={stepStyles.divider} />;
}

const headerShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EEF3FA' },
  headerWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...headerShadow,
  },
  headerAccent: {
    height: 4,
    backgroundColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: 0.2 },
  subtitle: { marginTop: 2, fontSize: 11, fontWeight: '700', color: '#64748B', lineHeight: 15 },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  progressBlock: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  progressPct: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 28, flexGrow: 1 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 22,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...softShadow,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    marginBottom: 12,
    ...cardShadow,
  },
  soft: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  outline: {
    backgroundColor: '#FAFCFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D7F5',
    marginBottom: 12,
    ...cardShadow,
  },
});

const heroStyles = StyleSheet.create({
  wrap: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#0B1F44',
    ...cardShadow,
  },
  glowA: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(37, 99, 235, 0.28)',
  },
  glowB: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  inner: {
    padding: 22,
  },
});

const pillStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.25)',
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E2E8F0',
    letterSpacing: 0.2,
  },
});

const consentStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...softShadow,
  },
  cardOn: {
    borderColor: COLORS.primary,
    backgroundColor: '#F8FBFF',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: COLORS.primary,
  },
  copy: { flex: 1 },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 3,
  },
  body: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 16,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
});

const fieldStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 2,
    marginBottom: 4,
  },
  input: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 10,
  },
  selectValue: { flex: 1, paddingVertical: 0, color: '#64748B' },
  twoCol: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  col: { flex: 1, minWidth: 0 },
  selectTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 8,
  },
  inlineOptions: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  inlineOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    minHeight: 36,
  },
  inlineOptionActive: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  inlineOptionText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  inlineOptionTextActive: { color: COLORS.primary, fontWeight: '700' },
});

const btnStyles = StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 50,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  primaryDisabled: {
    opacity: 0.45,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
      default: {},
    }),
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.2, flexShrink: 1, textAlign: 'center' },
  secondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  secondaryText: { fontSize: 13, fontWeight: '800', color: '#334155' },
  link: { alignItems: 'center', paddingVertical: 12 },
  linkText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
});

const chipStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minHeight: 36,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#EFF6FF', borderColor: COLORS.primary },
  text: { fontSize: 12, fontWeight: '700', color: '#475569' },
  textActive: { color: COLORS.primary, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  gridChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minHeight: 36,
    justifyContent: 'center',
  },
  gridText: { fontSize: 12, fontWeight: '700', color: '#475569' },
});

const stepStyles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  title: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginBottom: 2 },
  hint: { fontSize: 11, fontWeight: '600', color: '#64748B', lineHeight: 16 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#059669' },
  divider: { height: 1, backgroundColor: '#E8EEF7', marginVertical: 12 },
});

const questionStyles = StyleSheet.create({
  block: { marginBottom: 14 },
  blockDense: { marginBottom: 0 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4, lineHeight: 16 },
  required: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  requiredHidden: { color: 'transparent', fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginBottom: 8, lineHeight: 14 },
});

const regStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  chip: {
    backgroundColor: '#004AAD',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  chipText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  number: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.2 },
});

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginTop: 8,
  },
  rowOn: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  label: { flex: 1, fontSize: 12, fontWeight: '600', color: '#334155' },
  labelOn: { color: COLORS.primary, fontWeight: '800' },
});

const fuelStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  text: { fontSize: 12, fontWeight: '800' },
});

const selectStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  sheet: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '42%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  optionActive: { backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  optionTextActive: { color: COLORS.primary, fontWeight: '800' },
});

const yearStyles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 46,
  },
  value: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  placeholder: { color: '#94A3B8', fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sheetTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  done: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionActive: { backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 16, fontWeight: '700', color: '#334155' },
  optionTextActive: { color: COLORS.primary, fontWeight: '900' },
});
