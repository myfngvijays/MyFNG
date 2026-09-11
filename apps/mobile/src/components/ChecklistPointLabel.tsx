import { Text, type StyleProp, type TextStyle } from 'react-native';

function displayChecklistName(name: string) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (n.includes('power steering') && n.includes('clutch oil')) {
    return 'Steering / Clutch Oil Top-up';
  }
  return name;
}

/** Highlight the word "Replace" in checklist point names. */
export default function ChecklistPointLabel({
  name,
  style,
  numberOfLines,
}: {
  name: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const parts = displayChecklistName(String(name || '')).split(/(replace)/gi);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        /^replace$/i.test(part) ? (
          <Text key={i} style={{ color: '#DC2626', fontWeight: '700' }}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        ),
      )}
    </Text>
  );
}
