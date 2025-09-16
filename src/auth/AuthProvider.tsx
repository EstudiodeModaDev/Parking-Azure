// src/auth/AuthProvider.tsx
import * as React from 'react';
import type { AccountInfo } from '@azure/msal-browser';
import { ensureLogin, getAccessToken, logout } from './msal'; // ⬅️ tus funciones

type AuthCtx = {
  ready: boolean;                 // true cuando hay sesión lista
  account: AccountInfo | null;    // cuenta activa (o null)
  getToken: () => Promise<string>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = React.createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = React.useState(false);
  const [account, setAccount] = React.useState<AccountInfo | null>(null);

  // Auto-login al montar (puedes quitarlo si prefieres “click para iniciar sesión”)
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const acc = await ensureLogin(); // popup si no hay sesión
        if (!cancel) {
          setAccount(acc);
          setReady(true);
        }
      } catch (err) {
        // Opcional: si quieres NO forzar login automático, marca ready aunque no haya sesión
        if (!cancel) setReady(true);
        console.error('[AuthProvider] ensureLogin error:', err);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const signIn = React.useCallback(async () => {
    const acc = await ensureLogin(); // vuelve a pedir popup si se cerró sesión
    setAccount(acc);
    setReady(true);
  }, []);

  const signOut = React.useCallback(async () => {
    await logout();
    setAccount(null);
    setReady(true);
  }, []);

  const getToken = React.useCallback(async () => {
    const token = await getAccessToken();
    return token;
  }, []);

  const value = React.useMemo<AuthCtx>(() => ({
    ready,
    account,
    getToken,
    signIn,
    signOut,
  }), [ready, account, getToken, signIn, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useAuth(): AuthCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
