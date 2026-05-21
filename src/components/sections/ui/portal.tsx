import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

type PortalEntry = { key: string; node: React.ReactNode };

type PortalApi = {
  mount: (key: string, node: React.ReactNode) => void;
  update: (key: string, node: React.ReactNode) => void;
  unmount: (key: string) => void;
};

const PortalContext = createContext<PortalApi | null>(null);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<PortalEntry[]>([]);

  const mount = useCallback((key: string, node: React.ReactNode) => {
    setEntries(prev => {
      const exists = prev.some(e => e.key === key);
      if (exists) return prev.map(e => (e.key === key ? { key, node } : e));
      return [...prev, { key, node }];
    });
  }, []);

  const update = useCallback((key: string, node: React.ReactNode) => {
    setEntries(prev => prev.map(e => (e.key === key ? { key, node } : e)));
  }, []);

  const unmount = useCallback((key: string) => {
    setEntries(prev => prev.filter(e => e.key !== key));
  }, []);

  const api = useMemo(() => ({ mount, update, unmount }), [mount, update, unmount]);

  return (
    <PortalContext.Provider value={api}>
      <View style={styles.appRoot}>
        {children}
        {/* Everything mounted here renders above normal screens */}
        {entries.length > 0 ? (
          <View pointerEvents="box-none" style={styles.portalHost}>
            {entries.map(e => (
              <React.Fragment key={e.key}>{e.node}</React.Fragment>
            ))}
          </View>
        ) : null}
      </View>
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error('usePortal must be used within PortalProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  portalHost: {
    ...StyleSheet.absoluteFillObject,
  },
});

