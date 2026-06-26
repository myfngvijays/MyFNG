import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  DEFAULT_APP_FOOTER_CONFIG,
  fetchAppFooterConfig,
  invalidateAppFooterConfigCache,
  type AppFooterConfig,
} from '../lib/appFooterConfig';

type AppFooterContextValue = {
  footer: AppFooterConfig;
  loading: boolean;
  refreshFooter: () => Promise<AppFooterConfig>;
};

const AppFooterContext = createContext<AppFooterContextValue>({
  footer: DEFAULT_APP_FOOTER_CONFIG,
  loading: false,
  refreshFooter: async () => DEFAULT_APP_FOOTER_CONFIG,
});

export function AppFooterProvider({ children }: { children: React.ReactNode }) {
  const [footer, setFooter] = useState<AppFooterConfig>(DEFAULT_APP_FOOTER_CONFIG);
  const [loading, setLoading] = useState(true);

  const refreshFooter = useCallback(async () => {
    invalidateAppFooterConfigCache();
    const config = await fetchAppFooterConfig(true);
    setFooter(config);
    setLoading(false);
    return config;
  }, []);

  useEffect(() => {
    void refreshFooter();
  }, [refreshFooter]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshFooter();
    });
    return () => sub.remove();
  }, [refreshFooter]);

  const value = useMemo(
    () => ({
      footer,
      loading,
      refreshFooter,
    }),
    [footer, loading, refreshFooter],
  );

  return <AppFooterContext.Provider value={value}>{children}</AppFooterContext.Provider>;
}

export function useAppFooter() {
  return useContext(AppFooterContext);
}

export function preloadAppFooterConfig() {
  void fetchAppFooterConfig(true);
}
