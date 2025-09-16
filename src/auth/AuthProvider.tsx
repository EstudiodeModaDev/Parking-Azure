import * as React from 'react';
import type { AccountInfo } from '@azure/msal-browser';
import { ensureLoginAuto, ensureLoginPopup, getAccessToken, logout } from './msal';

type AuthCtx = {
  ready: boolean;                 // MSAL inicializado y verificado
  account: AccountInfo | null;    // cuenta activa (o null)
  getToken: () => Promise<string>;
  signIn: () => Promise<void>;    // popup
  signOut: () => Promise<void>;
};

const Ctx = React.createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = React.useState(false);
  const [account, setAccount] = React.useState<AccountInfo | null>(null);

  // Auto-login "suave": intenta SSO/redirect; si no hay sesión, solo marca ready
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const acc = await ensureLoginAuto(); // NO abre popup
        if (!cancel) {
          setAccount(acc);
          setReady(true);
        }
      } catch (err) {
        console.error('[AuthProvider] auto-login error:', err);
        if (!cancel) setReady(true);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const signIn = React.useCallback(async () => {
    const acc = await ensureLoginPopup(); // SÍ abre popup
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
