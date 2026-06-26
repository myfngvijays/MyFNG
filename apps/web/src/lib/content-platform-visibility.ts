export type ContentPlatform = 'web' | 'android' | 'ios' | 'app';

export const MIGRATION_230_HINT =
  'Run `database/230_content_android_ios_visibility.sql` for separate Android vs iOS visibility toggles.';

export function normalizeContentPlatform(raw: unknown): ContentPlatform {
  const value = String(raw || 'app').toLowerCase();
  if (value === 'web') return 'web';
  if (value === 'android') return 'android';
  if (value === 'ios') return 'ios';
  return 'app';
}

export type ContentVisibilityFields = {
  visible_android: boolean;
  visible_ios: boolean;
  visible_web: boolean;
  visible_app: boolean;
  active: boolean;
};

export function resolveContentVisibility(row: Record<string, unknown>, activeFallback = true): ContentVisibilityFields {
  const visibleWeb = row.visible_web !== undefined ? row.visible_web !== false : activeFallback;
  const hasSplit = row.visible_android !== undefined || row.visible_ios !== undefined;
  const visibleAndroid = hasSplit
    ? row.visible_android !== false
    : row.visible_app !== undefined
      ? row.visible_app !== false
      : activeFallback;
  const visibleIos = hasSplit
    ? row.visible_ios !== false
    : row.visible_app !== undefined
      ? row.visible_app !== false
      : activeFallback;
  const visibleApp = visibleAndroid || visibleIos;
  return {
    visible_android: visibleAndroid,
    visible_ios: visibleIos,
    visible_web: visibleWeb,
    visible_app: visibleApp,
    active: visibleApp || visibleWeb,
  };
}

export function isVisibleOnPlatform(fields: ContentVisibilityFields, platform: ContentPlatform) {
  if (platform === 'web') return fields.visible_web;
  if (platform === 'android') return fields.visible_android;
  if (platform === 'ios') return fields.visible_ios;
  return fields.visible_app;
}

export function buildVisibilityInsert(body: Record<string, unknown>) {
  const visibleAndroid = body.visible_android !== undefined ? !!body.visible_android : body.visible_app !== undefined ? !!body.visible_app : true;
  const visibleIos = body.visible_ios !== undefined ? !!body.visible_ios : body.visible_app !== undefined ? !!body.visible_app : true;
  const visibleWeb = body.visible_web !== undefined ? !!body.visible_web : true;
  const visibleApp = visibleAndroid || visibleIos;
  return {
    visible_android: visibleAndroid,
    visible_ios: visibleIos,
    visible_web: visibleWeb,
    visible_app: visibleApp,
    active: visibleApp || visibleWeb,
  };
}

export function buildVisibilityPatch(body: Record<string, unknown>, current?: ContentVisibilityFields) {
  const visibleAndroid = body.visible_android !== undefined ? !!body.visible_android : current?.visible_android;
  const visibleIos = body.visible_ios !== undefined ? !!body.visible_ios : current?.visible_ios;
  const visibleWeb = body.visible_web !== undefined ? !!body.visible_web : current?.visible_web;
  const patch: Record<string, unknown> = {};
  if (body.visible_android !== undefined) patch.visible_android = !!body.visible_android;
  if (body.visible_ios !== undefined) patch.visible_ios = !!body.visible_ios;
  if (body.visible_web !== undefined) patch.visible_web = !!body.visible_web;
  if (
    body.visible_android !== undefined ||
    body.visible_ios !== undefined ||
    body.visible_web !== undefined
  ) {
    const android = visibleAndroid ?? true;
    const ios = visibleIos ?? true;
    const web = visibleWeb ?? true;
    patch.visible_app = android || ios;
    patch.active = android || ios || web;
  } else if (body.active !== undefined) {
    patch.active = !!body.active;
  }
  return patch;
}

export function platformVisibilityColumn(platform: ContentPlatform): string {
  if (platform === 'web') return 'visible_web';
  if (platform === 'android') return 'visible_android';
  if (platform === 'ios') return 'visible_ios';
  return 'visible_app';
}

export function migrationHintForAndroidIosError(message: string): string | undefined {
  if (/visible_android|visible_ios/i.test(message)) return MIGRATION_230_HINT;
  return undefined;
}
