import {
  DEFAULT_SMART_TOOLS_HANDLER,
  fetchSmartToolsHandlerConfig,
  loadSmartToolsDisplayContext,
  type SmartToolsDisplayContext,
  type SmartToolsHandlerConfig,
} from './smartToolsConfig';

type SmartToolsStoreState = {
  config: SmartToolsHandlerConfig;
  context: SmartToolsDisplayContext;
  loading: boolean;
};

const DEFAULT_CONTEXT: SmartToolsDisplayContext = {
  isLoggedIn: false,
  activeMembershipPlanId: null,
  customerPhoneLast10: null,
};

let store: SmartToolsStoreState = {
  config: DEFAULT_SMART_TOOLS_HANDLER,
  context: DEFAULT_CONTEXT,
  loading: true,
};

const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeSmartToolsStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSmartToolsStoreSnapshot(): SmartToolsStoreState {
  return store;
}

export function invalidateSmartToolsStore() {
  store = {
    config: DEFAULT_SMART_TOOLS_HANDLER,
    context: DEFAULT_CONTEXT,
    loading: true,
  };
  inflight = null;
  emit();
}

export function ensureSmartToolsStoreLoaded(force = false): Promise<void> {
  if (force) {
    inflight = null;
    store = { ...store, loading: true };
    emit();
  }

  if (!store.loading && !force) {
    return Promise.resolve();
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const config = await fetchSmartToolsHandlerConfig(force);
      const context = await loadSmartToolsDisplayContext(config);
      store = { config, context, loading: false };
    } catch {
      store = {
        config: DEFAULT_SMART_TOOLS_HANDLER,
        context: DEFAULT_CONTEXT,
        loading: false,
      };
    } finally {
      inflight = null;
      emit();
    }
  })();

  return inflight;
}
