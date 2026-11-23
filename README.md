# CloudTransport Operador

App del operador (chofer): ve su despacho en el celular y reporta sus avances. Web instalable (PWA); el mismo código
se podrá empaquetar después para las tiendas.

> **Paso 1: todo corre con datos de ejemplo.** Aún no hay contrato de API para el operador.

## Requisitos

- Node 22 y npm 10
- Angular 21 (misma versión mayor que el frontend de oficina)

## Comandos

| Qué | Comando |
| --- | --- |
| Instalar | `npm ci` |
| Desarrollo (puerto 4300) | `npm start` → http://localhost:4300 |
| Pruebas (una vez) | `npm run test:ci` (`ng test --watch=false`) |
| Build de producción | `npm run build` (`ng build`) |
| Aplicar la marca | `npm run marca` |

En Windows, corra las pruebas desde una ruta con la unidad en mayúscula (`C:\ttpFront\tms-operador`). Si la terminal
abre como `c:\...`, vitest carga dos veces su propio módulo y falla con "Vitest failed to find the runner".

El service worker solo se activa en el build de producción. Para probar la PWA en un celular hace falta HTTPS: el
service worker, la ubicación y `crypto.randomUUID` no funcionan en `http://` salvo en `localhost`.

## Datos de ejemplo

- Cualquier celular de 10 dígitos con un PIN de 4 a 8 números entra.
- Si el celular termina en `0000`, entra sin despacho activo.
- Con el teléfono sin señal (modo avión, o "Offline" en DevTools), los reportes quedan pendientes y se envían solos al
  volver la conexión.
- La "oficina" de ejemplo confirma cada reporte 20 s después de recibirlo (se ve con "Actualizar estados").

## Marca (nombre visible)

El nombre visible, el nombre corto y los colores están **solo** en `src/marca.json`. `npm run marca` regenera desde ahí
`public/manifest.webmanifest`, el `<title>` y los metas de `src/index.html` y los iconos provisionales. `npm start` y
`npm run build` lo corren solos. Si usa `ng build` directamente, corra antes `npm run marca`.

## Estructura

```
src/
  marca.json                      nombre visible y colores (única fuente)
  environments/                   apiUrl y fuenteDatos ('ejemplo' | 'api'); sin secretos
  app/
    core/
      api/                        OperadorApi (interfaz única), modelos y provideOperadorApi()
        ejemplo/                  implementación en memoria y datos de ejemplo
      sesion/                     almacén de sesión (sin PIN), entrar/salir, guards
      despacho/                   asignación del operador (con copia para ver sin señal)
      reportes/                   cola de reportes en IndexedDB
      conexion/  ubicacion/  mensajes/  config/
      plataforma.ts               tokens de plataforma (almacenamiento, navigator, reloj)
    features/
      acceso/                     celular + PIN
      despacho/                   Mi despacho
      reportes/                   Reportar avance y Mis reportes
    shared/
      utils/                      lógica pura (*.util.ts) con sus pruebas
      ui/                         componentes compartidos
    testing/                      apoyo para pruebas (fuera del build de la app)
scripts/marca.mjs                 aplica la marca e iconos
```

## Cuando llegue el contrato de la API

1. Crear `OperadorApiHttp` que implemente `OperadorApi` (`core/api/operador-api.ts`) usando `environment.apiUrl`, y
   traducir las respuestas a los modelos de `operador-api.modelos.ts`. Rechazar siempre con `ErrorApiOperador` para que
   la cola sepa si reintentar.
2. Elegirla en `provideOperadorApi()` cuando `fuenteDatos` sea `'api'`.
3. El servidor debe ser idempotente por `id` de reporte: reenviar el mismo id no debe duplicar.

## Reglas que no cambian

- El operador solo ve lo suyo.
- Un reporte es un **reporte**: la oficina lo confirma. La app nunca cambia el estado del viaje.
- El operador nunca ve tarifas, ingresos, costos, utilidad ni pagos. Esos campos no existen en los modelos, y una
  prueba lo verifica sobre los datos de ejemplo.
- Horas siempre en la zona del negocio (America/Mexico_City), en formato dd/MM/yyyy HH:mm.
