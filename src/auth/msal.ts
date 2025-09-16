import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser';

export const msal = new PublicClientApplication({
  auth: {
    clientId: '60d9a880-0f6c-4e14-b17a-1cc06ea9ba8a',
    authority: 'https://login.microsoftonline.com/cd48ecd9-7e15-4f4b-97d9-ec813ee42b2c',
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'localStorage' },
});

const SCOPES = ['User.Read', 'Sites.ReadWrite.All'];

/** Debe llamarse antes de cualquier API de MSAL */
export async function initMsalOnce(): Promise<void> {
  // MSAL v3 requiere initialize() explícito
  // si lo llamas más de una vez, no pasa nada (es idempotente)
  await msal.initialize();
}

/** Intenta SSO por redirect (y procesa el retorno). No fuerza popup. */
export async function ensureLoginAuto(): Promise<AccountInfo | null> {
  await initMsalOnce();

  // Procesa la respuesta post-redirect (si la hay)
  await msal.handleRedirectPromise();

  let account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  if (account) {
    msal.setActiveAccount(account);
    return account;
  }

  // Intento suave de silent token para ver si hay SSO con sesión del navegador
  try {
    const res = await msal.acquireTokenSilent({ scopes: SCOPES, account: account ?? undefined });
    if (res.account) {
      msal.setActiveAccount(res.account);
      return res.account;
    }
  } catch {
    // Ignora; el flujo sigue sin sesión
  }
  return null; // no hay sesión
}

/** Fuerza login interactivo (popup) */
export async function ensureLoginPopup(): Promise<AccountInfo> {
  await initMsalOnce();

  const res = await msal.loginPopup({
    scopes: SCOPES,
    prompt: 'select_account',
  });
  const account = res.account ?? msal.getAllAccounts()[0]!;
  msal.setActiveAccount(account);
  return account;
}

/** Token de acceso (si no hay sesión, arroja) */
export async function getAccessToken(): Promise<string> {
  await initMsalOnce();

  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
  if (!account) throw new Error('No hay sesión. Llama a ensureLogin/ensureLoginAuto primero.');

  try {
    const res = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return res.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      const res = await msal.acquireTokenPopup({ scopes: SCOPES, account });
      return res.accessToken;
    }
    throw e;
  }
}

/** Logout (popup) */
export async function logout(): Promise<void> {
  await initMsalOnce();
  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
  await msal.logoutPopup({ account });
}
