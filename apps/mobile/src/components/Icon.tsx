import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

/**
 * Maps legacy MaterialCommunityIcons / lucide-style names used across the app
 * to valid Ionicons glyph names. Unknown names fall back to help-circle (never a dot).
 */
const ICON_MAP: Record<string, IoniconsName> = {
  // Navigation / chevrons
  'arrow-left': 'arrow-back',
  'arrow-right': 'arrow-forward',
  'arrow-back': 'arrow-back',
  'chevron-left': 'chevron-back',
  'chevron-right': 'chevron-forward',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  'menu': 'menu',
  'dots-vertical': 'ellipsis-vertical',
  'close': 'close',
  'close-circle': 'close-circle',
  'x-circle': 'close-circle',

  // Common actions
  'plus': 'add',
  'add': 'add',
  'create': 'add-circle',
  'plus-circle': 'add-circle',
  'minus': 'remove',
  'remove': 'remove',
  'subtract': 'remove',
  'check': 'checkmark',
  'check-circle': 'checkmark-circle',
  'pencil': 'pencil',
  'edit': 'create-outline',
  'eye': 'eye-outline',
  'magnify': 'search',
  'refresh': 'refresh',
  'logout': 'log-out-outline',
  'content-copy': 'copy-outline',
  'content-save': 'save-outline',
  'delete': 'trash-outline',
  'trash': 'trash-outline',
  'share': 'share-outline',
  'download': 'download-outline',
  'upload': 'cloud-upload-outline',
  'send': 'send',
  'save': 'save-outline',
  'print': 'print-outline',
  'link': 'link-outline',
  'attachment': 'attach-outline',
  'filter': 'filter-outline',
  'sort': 'swap-vertical-outline',
  'tune': 'options-outline',
  'settings': 'settings-outline',
  'cog': 'settings-outline',
  'play': 'play',
  'undo': 'arrow-undo-outline',
  'redo': 'arrow-redo-outline',
  'reply': 'arrow-undo-outline',
  'forward': 'arrow-redo-outline',
  'restore': 'refresh-circle-outline',
  'archive': 'archive-outline',
  'inbox': 'mail-unread-outline',

  // Communication
  'phone': 'call-outline',
  'phone-off': 'call-outline',
  'phone-forward': 'phone-portrait-outline',
  'phone-plus': 'call-outline',
  'whatsapp': 'logo-whatsapp',
  'email': 'mail-outline',
  'message': 'mail-outline',
  'message-text': 'chatbubble-outline',
  'chat': 'chatbubble-outline',
  'comment': 'chatbubble-ellipses-outline',
  'bell': 'notifications-outline',

  // People / account
  'account': 'person-outline',
  'account-circle': 'person-circle-outline',
  'account-plus': 'person-add-outline',
  'account-off': 'person-outline',
  'account-convert': 'swap-horizontal-outline',
  'account-arrow-right': 'person-outline',
  'users': 'people-outline',
  'lock': 'lock-closed-outline',
  'lock-reset': 'lock-closed-outline',
  'unlock': 'lock-open-outline',
  'key': 'key-outline',
  'shield': 'shield-outline',
  'briefcase': 'briefcase-outline',
  'building': 'business-outline',

  // Vehicle / location / service
  'car': 'car-outline',
  'car-side': 'car-outline',
  'car-info': 'car-outline',
  'car-pickup': 'car-outline',
  'car-sport': 'car-sport-outline',
  'wrench': 'construct-outline',
  'map-marker': 'location-outline',
  'map-pin': 'location-outline',
  'location': 'location-outline',
  'navigation': 'navigate-outline',
  'compass': 'compass-outline',
  'city': 'business-outline',
  'store': 'storefront-outline',
  'store-off': 'storefront-outline',
  'gas-station': 'water-outline',
  'water': 'water-outline',

  // Calendar / time
  'calendar': 'calendar-outline',
  'calendar-clock': 'time-outline',
  'calendar-check': 'calendar-outline',
  'calendar-today': 'calendar-outline',
  'clock': 'time-outline',
  'time': 'time-outline',
  'timer': 'timer-outline',
  'stopwatch': 'stopwatch-outline',
  'alarm': 'alarm-outline',
  'hourglass': 'hourglass-outline',
  'history': 'time-outline',
  'schedule': 'calendar-outline',
  'event': 'calendar-outline',
  'date': 'calendar-outline',
  'month': 'calendar-outline',
  'year': 'calendar-outline',
  'week': 'calendar-outline',
  'day': 'sunny-outline',
  'night': 'moon-outline',

  // Status / alerts
  'alert-circle': 'alert-circle-outline',
  'alert-triangle': 'warning-outline',
  'alert-octagon': 'alert-outline',
  'warning': 'warning-outline',
  'error': 'alert-circle',
  'success': 'checkmark-circle',
  'info': 'information-circle-outline',
  'information': 'information-circle-outline',
  'information-outline': 'information-circle-outline',
  'help': 'help-circle-outline',
  'priority-high': 'flag-outline',
  'flag': 'flag-outline',

  // Files / docs
  'file': 'document-outline',
  'folder': 'folder-outline',
  'document': 'document-text-outline',
  'file-document': 'document-text-outline',
  'file-document-outline': 'document-text-outline',
  'file-export': 'download-outline',
  'clipboard': 'clipboard-outline',
  'script-text-outline': 'reader-outline',
  'text': 'document-text-outline',
  'image': 'image-outline',
  'camera': 'camera-outline',
  'video': 'videocam-outline',

  // Finance / charts
  'cash': 'cash-outline',
  'cash-multiple': 'cash-outline',
  'cash-check': 'cash-outline',
  'chart-line': 'trending-up-outline',
  'percent': 'pie-chart-outline',
  'credit-card': 'card-outline',
  'trophy': 'trophy-outline',
  'star': 'star',
  'heart': 'heart',
  'heart-outline': 'heart-outline',
  'bookmark': 'bookmark-outline',
  'tag': 'pricetag-outline',
  'tags': 'pricetags-outline',

  // Misc / admin
  'home': 'home-outline',
  'source-branch': 'git-network-outline',
  'package-variant': 'cube-outline',
  'database': 'server-outline',
  'database-sync': 'sync-outline',
  'cloud': 'cloud-outline',
  'cloud-outline': 'cloud-outline',
  'wifi': 'wifi-outline',
  'bluetooth': 'bluetooth-outline',
  'battery': 'battery-half-outline',
  'signal': 'cellular-outline',
  'target': 'locate-outline',
  'auto-fix': 'construct-outline',
  'two-factor-authentication': 'shield-checkmark-outline',
  'api': 'code-slash-outline',
  'backup-restore': 'cloud-download-outline',
  'broom': 'brush-outline',
  'restart': 'refresh-circle-outline',
  'google-maps': 'map-outline',
  'arrow-u-left-top': 'return-up-back-outline',
  'like': 'thumbs-up-outline',
  'dislike': 'thumbs-down-outline',
};

function resolveIconName(name?: string): IoniconsName {
  if (!name) return 'help-circle-outline';
  if (ICON_MAP[name]) return ICON_MAP[name];
  // Already a valid-looking ionicons name — try as-is
  return name as IoniconsName;
}

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

export function Icon({ name, size = 24, color = '#000', style }: IconProps) {
  return (
    <Ionicons
      name={resolveIconName(name)}
      size={size}
      color={color}
      style={style}
    />
  );
}

export default Icon;
