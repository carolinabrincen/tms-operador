import { Routes } from '@angular/router';
import { conSesionGuard, sinSesionGuard } from './core/sesion/sesion.guards';
import { AccesoPage } from './features/acceso/acceso.page';
import { MiDespachoPage } from './features/despacho/mi-despacho.page';
import { MisReportesPage } from './features/reportes/mis-reportes.page';
import { ReportarAvancePage } from './features/reportes/reportar-avance.page';

// Rutas sin carga diferida: la app es pequeña y así queda completa en el teléfono desde la primera visita
// (el service worker la guarda para usarla sin señal).
export const routes: Routes = [
  { path: 'acceso', component: AccesoPage, canActivate: [sinSesionGuard] },
  {
    path: '',
    canActivate: [conSesionGuard],
    children: [
      { path: 'despacho', component: MiDespachoPage },
      { path: 'avance/:tipo/:id', component: ReportarAvancePage },
      { path: 'reportes', component: MisReportesPage },
      { path: '', pathMatch: 'full', redirectTo: 'despacho' },
    ],
  },
  { path: '**', redirectTo: '' },
];
