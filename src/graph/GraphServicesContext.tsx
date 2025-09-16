// src/graph/GraphServicesContext.tsx
import * as React from 'react';

// ⚙️ Auth (usa tu hook real)
import { useAuth } from '../auth/AuthProvider';
// 🔗 Cliente REST para Graph
import { GraphRest } from './GraphRest';

// 🧩 Servicios (versiones 100% Graph que ya creaste)
import { ParkingSlotsService } from '../Services/ParkingSlot.service';
import { ColaboradoresFijosService } from '../Services/Colaboradoresfijos.service';
import { ReservationsService } from '../Services/Reservations.service';
import { SettingsService } from '../Services/Setting.service';
import { UsuariosParkingService } from '../Services/UsuariosParking.service';
import { PicoYPlacaService } from '../Services/PicoPlaca';
import { SharedServices } from '../Services/Shared.service'; // <- singular

// ================== Tipos ==================
export type GraphSiteConfig = {
  hostname: string;          // p.ej. "estudiodemoda.sharepoint.com"
  sitePath: string;          // p.ej. "/sites/TransformacionDigital/IN/SA"
  lists: {
    parkingSlots: string;        // "parkingslots"
    colaboradoresFijos: string;  // "Colaboradores fijos"
    reservations: string;        // "reservations"
    usuariosParking: string;     // "usuariosparking"
    settings: string;            // "settings"
    picoYPlaca: string;          // "pico y placa"
  };
};

export type GraphServices = {
  graph: GraphRest;
  // SharePoint list services
  parkingSlots: ParkingSlotsService;
  colaboradoresFijos: ColaboradoresFijosService;
  reservations: ReservationsService;
  usuariosParking: UsuariosParkingService;
  settings: SettingsService;
  picoYPlaca: PicoYPlacaService;
  shared: SharedServices; // <- singular
};

// ================== Contexto ==================
const GraphServicesContext = React.createContext<GraphServices | null>(null);

// ================== Provider ==================
type ProviderProps = {
  children: React.ReactNode;
  /** Permite sobreescribir host, ruta de sitio y nombres de listas si cambian por ambiente. */
  config?: Partial<GraphSiteConfig>;
};

const DEFAULT_CONFIG: GraphSiteConfig = {
  hostname: 'estudiodemoda.sharepoint.com',
  sitePath: '/sites/TransformacionDigital/IN/SA',
  lists: {
    parkingSlots: 'parkingslots',
    colaboradoresFijos: 'Colaboradores fijos',
    reservations: 'reservations',
    usuariosParking: 'usuariosparking',
    settings: 'settings',
    picoYPlaca: 'pico y placa',
  },
};

export const GraphServicesProvider: React.FC<ProviderProps> = ({ children, config }) => {
  const { getToken } = useAuth();

  // Mergear config
  const cfg: GraphSiteConfig = React.useMemo(() => {
    const base = DEFAULT_CONFIG;
    const sitePath = (config?.sitePath ?? base.sitePath);
    return {
      hostname: config?.hostname ?? base.hostname,
      sitePath: sitePath.startsWith('/') ? sitePath : `/${sitePath}`,
      lists: {
        parkingSlots:      config?.lists?.parkingSlots      ?? base.lists.parkingSlots,
        colaboradoresFijos:config?.lists?.colaboradoresFijos?? base.lists.colaboradoresFijos,
        reservations:      config?.lists?.reservations      ?? base.lists.reservations,
        usuariosParking:   config?.lists?.usuariosParking   ?? base.lists.usuariosParking,
        settings:          config?.lists?.settings          ?? base.lists.settings,
        picoYPlaca:        config?.lists?.picoYPlaca        ?? base.lists.picoYPlaca,
      },
    };
  }, [config]);

  // Cliente Graph REST (usa getToken del AuthContext/MSAL)
  const graph = React.useMemo(() => {
    // tu GraphRest original sólo acepta getToken
    return new GraphRest(getToken);
  }, [getToken]);

  // Instancias de servicios (memo)
  const services = React.useMemo<GraphServices>(() => {
    const { hostname, sitePath, lists } = cfg;

    const parkingSlots       = new ParkingSlotsService(graph, hostname, sitePath, lists.parkingSlots);
    const colaboradoresFijos = new ColaboradoresFijosService(graph, hostname, sitePath, lists.colaboradoresFijos);
    const reservations       = new ReservationsService(graph, hostname, sitePath, lists.reservations);
    const usuariosParking    = new UsuariosParkingService(graph, hostname, sitePath, lists.usuariosParking);
    const settings           = new SettingsService(graph, hostname, sitePath, lists.settings);
    const picoYPlaca         = new PicoYPlacaService(graph, hostname, sitePath, lists.picoYPlaca);

    // SharedService depende de UsuariosParkingService
    const shared             = new SharedServices(usuariosParking);

    return {
      graph,
      parkingSlots,
      colaboradoresFijos,
      reservations,
      usuariosParking,
      settings,
      picoYPlaca,
      shared,
    };
  }, [graph, cfg]);

  return (
    <GraphServicesContext.Provider value={services}>
      {children}
    </GraphServicesContext.Provider>
  );
};

// ================== Hook de consumo ==================
export function useGraphServices(): GraphServices {
  const ctx = React.useContext(GraphServicesContext);
  if (!ctx) throw new Error('useGraphServices debe usarse dentro de <GraphServicesProvider>.');
  return ctx;
}
