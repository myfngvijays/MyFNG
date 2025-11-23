// Simple emoji icon replacements for @expo/vector-icons
// Use this instead of Ionicons or MaterialCommunityIcons

export const Icon = {
  // Common icons
  'car-sport': '🚗',
  'mail-outline': '📧',
  'lock-closed-outline': '🔒',
  'eye-outline': '👁️',
  'eye-off-outline': '🙈',
  'arrow-forward': '→',
  'information-circle': 'ℹ️',
  'checkmark-circle': '✅',
  'close-circle': '❌',
  'home': '🏠',
  'person': '👤',
  'log-out': '🚪',
  'settings': '⚙️',
  'menu': '☰',
  'search': '🔍',
  'add': '➕',
  'chevron-forward': '›',
  'chevron-back': '‹',
  'call': '📞',
  'time': '🕐',
  'calendar': '📅',
  'location': '📍',
  'document': '📄',
  'star': '⭐',
  'trending-up': '📈',
  'people': '👥',
  'car': '🚗',
  'clipboard': '📋',
  'alert-circle': '⚠️',
  'refresh': '🔄',
};

export type IconProps = {
  name: keyof typeof Icon;
  size?: number;
  color?: string;
  style?: any;
};

export function IconText({ name, size = 20, color = '#000', style }: IconProps) {
  return { fontSize: size, color, ...style };
}

