import { Routes } from '@angular/router';
import { conSesionGuard, sinSesionGuard } from './core/sesion/sesion.guards';
import { AccesoPage } from './features/acceso/acceso.page';
import { EvidenciasPage } from './features/evidencias/evidencias.page';
import { HojaRutaPage } from './features/hoja-ruta/hoja-ruta.page';
import { MisReportesPage } from './features/reportes/mis-reportes.page';
import { MiViajePage } from './features/viaje/mi-viaje.page';
import { ViajePage } from './features/viaje/viaje.page';

// Rutas sin carga diferida: la app es pequeña y así queda completa en el teléfono desde la primera visita
// (el service worker la guarda para usarla sin señal).
export const routes: Routes = [
  { path: 'acceso', component: AccesoPage, canActivate: [sinSesionGuard] },
  {
    path: '',
    canActivate: [conSesionGuard],
    children: [
      { path: 'viaje', component: MiViajePage },
      { path: 'viaje/:id', component: ViajePage },
      { path: 'reportes', component: MisReportesPage },
      { path: 'hoja-ruta', component: HojaRutaPage },
      { path: 'evidencias', component: EvidenciasPage },
      // Rutas del paso 1 (por si quedó un acceso directo guardado).
      { path: 'despacho', redirectTo: 'viaje' },
      { path: '', pathMatch: 'full', redirectTo: 'viaje' },
    ],
  },
  { path: '**', redirectTo: '' },
];
