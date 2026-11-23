import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AlmacenSesion } from './almacen-sesion';

/** Pantallas del operador: requieren sesión. */
export const conSesionGuard: CanActivateFn = () =>
  inject(AlmacenSesion).sesion() ? true : inject(Router).createUrlTree(['/acceso']);

/** Pantalla de acceso: si ya hay sesión, va directo a su viaje. */
export const sinSesionGuard: CanActivateFn = () =>
  inject(AlmacenSesion).sesion() ? inject(Router).createUrlTree(['/viaje']) : true;
