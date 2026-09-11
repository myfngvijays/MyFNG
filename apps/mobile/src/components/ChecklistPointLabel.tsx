import { Text, type StyleProp, type TextStyle } from 'react-native';

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
  const parts = String(name || '').split(/(replace)/gi);
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
