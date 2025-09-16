// src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import './App.css';

import { makeSettingsPortSingle } from './Ports/settingsPort';

import Availability from './Components/Reservar/Reservar';
import MisReservas from './Components/Mis-Reservas/mis-reservas';
import AdminCells from './Components/AdminCells/admin-cells';
import AdminSettings from './Components/Admin-Settings/AdminSettings';
import ColaboradoresInscritos from './Components/Colaboradores-Permanentes/Colaboradores';
import { ToastProvider } from './Components/Toast/ToastProvider';
import Reportes from './Components/Reportes/reportes';
import PicoPlacaAdmin from './Components/PicoPlaca/PicoPlaca';

import type { GetAllOpts } from './Models/Commons';

// Auth + Graph context + UserService
import { useAuth } from './auth/AuthProvider';
import { GraphServicesProvider, useGraphServices } from './graph/GraphServicesContext';
import { UserService } from './Services/User.Service';

// ------------------ Constantes UI ------------------
const NAVS_ADMIN = [
  { key: 'misreservas', label: 'Reservas' },
  { key: 'celdas', label: 'Celdas' },
  { key: 'admin', label: 'Administración' },
  { key: 'pyp', label: 'Pico y placa' },
  { key: 'colaboradores', label: 'Colaboradores' },
  { key: 'reportes', label: 'Reportes' },
] as const;
type AdminNavKey = typeof NAVS_ADMIN[number]['key'];
type NavKey = AdminNavKey;

type User = {
  displayName?: string;
  mail?: string;
  jobTitle?: string;
} | null;

// ------------------ Helpers que usan el contexto ------------------
function useRoleHelpers() {
  const { usuariosParking } = useGraphServices();

  const changeUser = async (userEmail: string) => {
    const email = (userEmail ?? '').trim();
    if (!email) throw new Error('userEmail requerido');
    const emailSafe = email.replace(/'/g, "''");

    const opt: GetAllOpts = { filter: `Title eq '${emailSafe}'`, top: 1 as any };
    const res = await usuariosParking.getAll(opt);
    const rows = Array.isArray(res) ? res : [];
    const user = rows[0];
    if (!user) throw new Error(`Usuario no encontrado: ${email}`);

    const id = (user as any).ID ?? (user as any).Id ?? (user as any).id;
    if (id == null) throw new Error('El usuario no tiene ID');

    const currentRol = String((user as any).Rol ?? (user as any).rol ?? '').toLowerCase();
    const nextRol = currentRol === 'admin' ? 'Usuario' : 'admin';

    await usuariosParking.update(String(id), { Rol: nextRol } as any);
    return { ok: true, id, email, before: currentRol, after: nextRol };
  };

  const isUserPermitted = async (userEmail: string): Promise<boolean> => {
    const email = (userEmail ?? '').trim();
    if (!email) return false;
    const emailSafe = email.replace(/'/g, "''");

    const opt: GetAllOpts = { filter: `Title eq '${emailSafe}'`, top: 1 as any };
    const res = await usuariosParking.getAll(opt);
    const rows = Array.isArray(res) ? res : [];
    const user = rows[0];
    if (!user) return false;

    const raw =
      (user as any).Permitidos ??
      (user as any).permitidos ??
      (user as any).Permitido;
    return raw === true || raw === 1 || String(raw).toLowerCase() === 'true';
  };

  return { changeUser, isUserPermitted };
}

// ------------------ App interna (requiere sesión) ------------------
function AppInner() {
  const [selected, setSelected] = useState<NavKey>('misreservas');
  const [user, setUser] = useState<User>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState(false);
  const [canChangeRole, setCanChangeRole] = useState(false);

  const settingsPort = useMemo(() => makeSettingsPortSingle(), []);
  const { graph, shared } = useGraphServices();
  const userSvc = useMemo(() => new UserService(graph), [graph]);
  const { signOut } = useAuth();

  const { changeUser, isUserPermitted } = useRoleHelpers();

  const onChangeRole = async () => {
    if (!user?.mail || changingRole) return;
    try {
      setChangingRole(true);
      const { after } = await changeUser(user.mail);
      setUserRole(after.toLowerCase());
    } catch (e) {
      console.error(e);
    } finally {
      setChangingRole(false);
    }
  };

  // Cargar perfil con Graph
  useEffect(() => {
    let cancel = false;
    setUserLoading(true);
    (async () => {
      try {
        const me = await userSvc.getMeBasic();
        if (cancel) return;
        setUser({
          displayName: me.displayName ?? undefined,
          mail: me.mail ?? me.userPrincipalName ?? undefined,
          jobTitle: me.jobTitle ?? undefined,
        });
      } catch (e) {
        if (!cancel) setUser(null);
        console.error(e);
      } finally {
        if (!cancel) setUserLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [userSvc]);

  // Reset rol si cambia el mail
  useEffect(() => { setUserRole(null); }, [user?.mail]);

  // Cargar rol (shared.getRole)
  useEffect(() => {
    const mail = user?.mail;
    if (!mail) return;
    let cancel = false;
    (async () => {
      try {
        const role = await shared.getRole(mail); // 'admin' | 'usuario'
        if (!cancel) {
          setUserRole(role);
          if (role === 'admin') setSelected(prev => prev ?? 'misreservas');
        }
      } catch (e) {
        console.error(e);
        if (!cancel) setUserRole('usuario');
      }
    })();
    return () => { cancel = true; };
  }, [user?.mail, shared]);

  // ¿Puede cambiar su rol?
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!user?.mail) { setCanChangeRole(false); return; }
      try {
        const ok = await isUserPermitted(user.mail);
        if (!cancel) setCanChangeRole(ok);
      } catch {
        if (!cancel) setCanChangeRole(false);
      }
    })();
    return () => { cancel = true; };
  }, [user?.mail, isUserPermitted]);

  const isAdmin = userRole === 'admin';
  const handleNavClick = (key: NavKey) => setSelected(key);

  if (userLoading || userRole === null) {
    return (
      <div className="center muted" style={{ padding: 24 }}>
        Cargando permisos…
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="page">
        {/* HEADER */}
        <div className="section userCard">
          <div className="userRow">
            <div className="brand">
              <h1>PARKING EDM</h1>
            </div>

            <div className="userCluster">
              <div className="avatar">
                {user?.displayName ? user.displayName[0] : <span>?</span>}
              </div>
              <div className="userInfo">
                {user ? (
                  <>
                    <div className="userName">{user.displayName}</div>
                    <div className="userMail">{user.mail}</div>
                    <div className="userMail">{isAdmin ? 'admin' : 'usuario'}</div>
                    {user.jobTitle && <div className="userTitle">{user.jobTitle}</div>}
                  </>
                ) : (
                  <div className="errorText">No se pudo cargar el usuario</div>
                )}
              </div>

              <div style={{ marginLeft: 'auto' }}>
                <button className="btn-change-role" onClick={signOut}>
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* NAV solo admin */}
        {isAdmin && (
          <nav className="nav">
            {NAVS_ADMIN.map((nav) => (
              <button
                key={nav.key}
                onClick={() => handleNavClick(nav.key)}
                className="navBtn"
                style={{
                  background: selected === nav.key ? '#38bdf8' : '#fff',
                  color: selected === nav.key ? '#fff' : '#2563eb',
                  boxShadow: selected === nav.key ? '0 2px 8px #38bdf855' : 'none',
                }}
              >
                {nav.label}
              </button>
            ))}
          </nav>
        )}

        {/* MAIN */}
        <main className="main">
          {!isAdmin && user?.mail && (
            <>
              <div className="center">
                <h2>Reservar Parqueadero</h2>
                <Availability userEmail={user.mail} userName={user.displayName!} />
              </div>
              <MisReservas userMail={user.mail} isAdmin={false} />
            </>
          )}

          {isAdmin && selected === 'misreservas' && user?.mail && (
            <MisReservas userMail={user.mail} isAdmin />
          )}

          {isAdmin && selected === 'celdas' && <AdminCells />}

          {isAdmin && selected === 'admin' && (
            <div className="center">
              <h2>Administración</h2>
              <AdminSettings port={settingsPort} />
            </div>
          )}

          {isAdmin && selected === 'colaboradores' && (
            <div className="center">
              <h2>Colaboradores</h2>
              <ColaboradoresInscritos />
            </div>
          )}

          {isAdmin && selected === 'reportes' && <Reportes />}

          {isAdmin && selected === 'pyp' && (
            <div className="center">
              <PicoPlacaAdmin />
            </div>
          )}

          <br />
          {canChangeRole && (
            <button
              onClick={onChangeRole}
              disabled={!user?.mail || changingRole}
              className="btn-change-role"
              aria-busy={changingRole || undefined}
            >
              {changingRole ? 'Actualizando…' : 'Cambiar rol'}
            </button>
          )}
        </main>
      </div>
    </ToastProvider>
  );
}

// ------------------ App raíz ------------------
// Si NO hay sesión lista, muestra pantalla con botón de login (popup).
export default function App() {
  const { ready, account, signIn } = useAuth();

  if (!ready) {
    return (
      <div className="center muted" style={{ padding: 24 }}>
        Conectando…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="page">
        <div className="section userCard">
          <div className="userRow">
            <div className="brand">
              <h1>PARKING EDM</h1>
            </div>
          </div>
        </div>

        <main className="main">
          <div className="center" style={{ display: 'grid', gap: 12 }}>
            <h2>Inicia sesión para continuar</h2>
            <button className="btn-change-role" onClick={signIn}>
              Iniciar sesión
            </button>
            <small className="muted">
              Si tu navegador bloquea la ventana emergente, habilítala para este sitio.
            </small>
          </div>
        </main>
      </div>
    );
  }

  // Con sesión: monta GraphServicesProvider + AppInner
  return (
    <GraphServicesProvider>
      <AppInner />
    </GraphServicesProvider>
  );
}
