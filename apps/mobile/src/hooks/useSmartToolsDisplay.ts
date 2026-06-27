import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  navigateToSmartTool,
  resolveSmartToolsForSlot,
  type ResolvedSmartTool,
} from '../lib/smartToolsConfig';
import type { SmartToolScreen } from '../lib/smartToolsPlacements';
import {
  ensureSmartToolsStoreLoaded,
  getSmartToolsStoreSnapshot,
  subscribeSmartToolsStore,
} from '../lib/smartToolsStore';

type SmartToolsSlotProps = {
  screen: SmartToolScreen;
  slot: string;
  navigation: any;
  city?: string;
};

export function useSmartToolsSlot({ screen, slot, navigation, city }: SmartToolsSlotProps) {
  const { config, context, loading } = useSyncExternalStore(
    subscribeSmartToolsStore,
    getSmartToolsStoreSnapshot,
    getSmartToolsStoreSnapshot,
  );

  useEffect(() => {
    void ensureSmartToolsStoreLoaded();
  }, []);

  const tools = useMemo(
    () => resolveSmartToolsForSlot(config, screen, slot, context),
    [config, context, screen, slot],
  );

  const openTool = useCallback(
    (tool: ResolvedSmartTool) => {
      navigateToSmartTool(navigation, tool, { city, isLoggedIn: context.isLoggedIn });
    },
    [navigation, city, context.isLoggedIn],
  );

  const visible = config.section.enabled && tools.length > 0;
  const showSectionHeading = slot === 'main_grid';

  return { section: config.section, tools, loading, visible, showSectionHeading, openTool };
}

/** @deprecated use useSmartToolsSlot */
export function useSmartToolsDisplay(surface: 'home' | 'search', navigation: any, city?: string) {
  return useSmartToolsSlot({
    screen: surface,
    slot: 'main_grid',
    navigation,
    city,
  });
}
