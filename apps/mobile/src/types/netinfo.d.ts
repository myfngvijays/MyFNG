declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean | null;
    isInternetReachable?: boolean | null;
    type?: string;
  }

  export type NetInfoSubscription = () => void;

  export function fetch(): Promise<NetInfoState>;
  export function addEventListener(listener: (state: NetInfoState) => void): NetInfoSubscription;

  const NetInfo: {
    fetch: typeof fetch;
    addEventListener: typeof addEventListener;
  };

  export default NetInfo;
}


