# CloudTransport Operador

App del operador (chofer): ve su viaje en el celular, reporta el avance (estatus) y las incidencias. Web instalable
(PWA); el mismo código se podrá empaquetar después para las tiendas.

> **Paso 2: todo corre con datos de ejemplo.** Aún no hay contrato de API para el operador.

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

## Estatus del viaje

| Viaje | Estatus, en orden (los mismos nombres que oficina) |
| --- | --- |
| Cargado | Asignado → EnPosicionamiento → EnPatioOrigen → EnCarga → **Documentado** → EnTransito → EnPatioDestino → EnDescarga → **Descargado** → Cerrado |
| Vacío | Asignado → EnTransitoVacio → EnPatio (o EnTaller si el último tramo es a Taller) → Cerrado |

- El operador solo avanza hacia adelante y puede saltar intermedios. Asignado y Cerrado los pone la oficina.
- Los intermedios se aplican al momento. **Documentado** y **Descargado** son hitos: quedan "Pendiente de confirmar por
  oficina" (ahí la oficina captura toneladas y estadía).
- La oficina puede avanzar el viaje sin esperar al operador. La app guía desde el estatus más avanzado que conoce (el
  del servidor o lo que el operador ya reportó) y deja de ofrecer los pasos anteriores.
- Las incidencias (Detenido en parador, Falla mecánica, Retén o inspección, Desvío de ruta, Otro) no cambian el estatus.
  En "Otro" la nota es obligatoria.
- Los textos de los botones están en `shared/utils/estatus-viaje.util.ts` (`BOTON_ESTATUS`).

## Datos de ejemplo

- Cualquier celular de 10 dígitos con un PIN de 4 a 8 números entra. Si el celular termina en `0000`, entra sin viaje.
- Una salida con 4 viajes: vacío a cargar combustible, dos cargados, y un regreso vacío cuyo último tramo va al taller.
- La "oficina" de ejemplo:
  - confirma los hitos 20 s después de recibirlos;
  - 30 s después de "Me están cargando" pone **Documentado ella misma** (si el operador no lo reportó);
  - 30 s después de Descargado confirmado, o de la llegada en vacío, cierra el viaje.
- Un estatus igual o anterior al actual se recibe "sin efecto": queda registrado, pero el viaje no retrocede.
- Las pantallas de viaje se releen solas cada 30 s con señal, y al enviarse un reporte o confirmarse un hito.
- Con el teléfono sin señal (modo avión, o "Offline" en DevTools), los reportes quedan pendientes y se envían solos al
  volver la conexión.

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
        ejemplo/                  implementación en memoria, simulación de la oficina y datos de ejemplo
      sesion/                     almacén de sesión (sin PIN), entrar/salir, guards
      viaje/                      asignación (salida y viajes, con copia para ver sin señal) y refresco
      reportes/                   cola de reportes en IndexedDB
      conexion/  ubicacion/  mensajes/  config/
      plataforma.ts               tokens de plataforma (almacenamiento, navigator, reloj)
    features/
      acceso/                     celular + PIN
      viaje/                      Mi viaje y el detalle de cada viaje (/viaje/:id)
      reportes/                   Mis reportes
    shared/
      utils/                      lógica pura (*.util.ts) con sus pruebas: estatus, incidencias, línea de tiempo…
      ui/                         panel de avance, línea de tiempo, datos del viaje, reporte
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
- La app nunca hace retroceder un viaje ni pone Asignado o Cerrado. Los hitos los confirma la oficina.
- El operador nunca ve tarifas, ingresos, costos, utilidad ni pagos. Esos campos no existen en los modelos, y una
  prueba lo verifica sobre los datos de ejemplo.
- Horas siempre en la zona del negocio (America/Mexico_City), en formato dd/MM/yyyy HH:mm.
