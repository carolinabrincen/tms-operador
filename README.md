# CloudTransport Operador

App del operador (chofer): ve su viaje y su hoja de ruta en el celular, reporta el avance (estatus) y las incidencias,
y sube fotos de evidencia. Web instalable (PWA); el mismo código se podrá empaquetar después para las tiendas.

> **M2:** ya existe la implementación de la API real (contratos M1 y M2, `docs/contrato-app-operador-m1.md` y
> `docs/contrato-app-operador-m2.md`): sesión, viaje, reportes, hoja de ruta y evidencias. La app **sigue arrancando con
> datos de ejemplo** hasta que se decida lo contrario (`fuenteDatos` en `src/environments`).

## Requisitos

- Node 22 y npm 10
- Angular 21 (misma versión mayor que el frontend de oficina)

## Comandos

| Qué | Comando |
| --- | --- |
| Instalar | `npm ci` |
| Desarrollo con datos de ejemplo (puerto 4300) | `npm start` → http://localhost:4300 |
| Desarrollo contra la API real local | `npm run start:api` → http://localhost:4300, API en https://localhost:58120/api |
| Pruebas (una vez) | `npm run test:ci` (`ng test --watch=false`) |
| Build de producción | `npm run build` (`ng build`) |
| Aplicar la marca | `npm run marca` |

En Windows, corra las pruebas desde una ruta con la unidad en mayúscula (`C:\ttpFront\tms-operador`). Si la terminal
abre como `c:\...`, vitest carga dos veces su propio módulo y falla con "Vitest failed to find the runner".

El service worker solo se activa en el build de producción. Para probar la PWA en un celular hace falta HTTPS: el
service worker, la ubicación y `crypto.randomUUID` no funcionan en `http://` salvo en `localhost`.

## API real (contrato M1)

- Implementación: `core/api/http/operador-api-http.ts`. Se elige con `environment.fuenteDatos` (`'ejemplo'` o `'api'`).
- `npm run start:api` usa `environment.api-local.ts`. El servidor debe tener `http://localhost:4300` en
  `Cors:OrigenesOperador` y el navegador debe confiar en el certificado de desarrollo de .NET
  (`dotnet dev-certs https --trust`).
- Sesión: PIN de 6 dígitos. Token y refresh se guardan en IndexedDB (nunca en pantalla, consola ni errores). Ante un 401
  se renueva una vez y se repite; si renovar falla, se pide el PIN y la cola de reportes se conserva.
- Salir: se llama a `sesion/cerrar` con el refresh (cierra solo este teléfono) y después se borran token y refresh. Si no
  hay señal, el servidor falla o tarda más de 4 s (`ESPERA_CIERRE_SESION_MS`), se borra igual: salir nunca se bloquea. La renovación va de una en una (también entre pestañas, con Web Locks), porque el refresh
  es rotativo y reusar uno cierra todas las sesiones del operador.
- Errores del reporte (tabla 3.2): 400, 404 y 409 → "No aceptado"; 409 `DESPACHO_EVENTO_CLAVE_DUPLICADA` → otro id y
  se reenvía; 401 sin poder renovar y 403 → pedir el PIN; 429, 503 y 5xx → se reintenta.
- Hitos anulados: la oficina puede anular un Documentado o Descargado ya confirmado. Los reportes confirmados se siguen
  consultando mientras su salida esté activa; si pasan a "sin efecto" se muestra el mensaje del servidor y el paso se
  vuelve a ofrecer (el nuevo reporte lleva otro id).
- El `mensaje` del servidor (acuse y estado) ya viene legible y se muestra tal cual, sin traducir nada dentro.
- Sin salida activa (`{ "salida": null }`, también cuando la oficina cierra o cancela la salida): Mi viaje dice "No tiene
  un viaje activo" y "Mis reportes" conserva todo lo reportado.
- La hora del reporte es la del teléfono: si va adelantada (el servidor rechaza más de 10 minutos), la app avisa desde
  los 5 minutos comparando con la hora del servidor de cada acuse.

## Hoja de ruta (contrato M2, sección 1)

- "Mi viaje" → **Ver hoja de ruta** (`/hoja-ruta`): empresa y teléfonos (tráfico 24 h y oficina; al tocarlos, llama),
  unidad y remolques, y cada tramo en orden con cliente, origen y destino (con dirección si la ruta está completa),
  citas en hora del negocio, producto con **MATERIAL PELIGROSO** si aplica, toneladas, referencia, notas o motivo del
  vacío, paradas autorizadas y casetas por nombre. **Abrir en mapa** por tramo con `ligaMapa` (solo ligas https).
- Se guarda en el teléfono (localStorage, por operador) para verla sin señal y se vuelve a pedir al recuperar la señal.
  Muestra "Generada el …" y, si se ve la copia guardada, avisa que puede no estar al día. Sin salida activa lo dice.
- Nunca lleva importes: la traducción de la API arma cada campo por lista blanca y una prueba de guarda lo revisa.

## Evidencias (contrato M2, sección 2)

- **Agregar foto** en el detalle de cada viaje **cargado** (los vacíos no reciben fotos; en un viaje cancelado se explica
  que la oficina puede subirla): tomar con la cámara o elegir de la galería, tipo, descripción (obligatoria con Otro) y
  nota. La ubicación se toma igual que en los reportes; sin permiso o sin GPS la foto se envía igual.
- Antes de guardarla se reduce a 1600 px por lado y JPEG al 80 % (`shared/utils/foto.util.ts`).
- **Cola sin señal** (`core/evidencias/`): cada foto nace con su id, se guarda primero en IndexedDB (versión 4, almacén
  `evidencias`) y se sube después; reenviar el mismo id con la misma foto no duplica; 409 de id duplicado → otro id.
  Estados: Pendiente, Enviada (acuse), Recibida (el servidor la confirma), Anulada por la oficina (con su motivo) y No
  aceptada (con un texto de usted por cada código). Una enviada que el servidor no conoce se vuelve a subir. Desde 10
  fotos sin enviar hay un aviso. Ya recibida o anulada, la foto se borra del teléfono.
- Tras reportar **Descargado** se sugiere "Tomar foto del acuse de recibido", ligada a ese reporte (`reporteId`). No obliga
  ("Ahora no"). La foto ligada espera a que el reporte llegue al servidor.
- **Galería del viaje**: las fotos del operador se descargan con el token al tocar "Ver foto" y se muestran como blob; las
  de la oficina aparecen solo como renglón ("Subida por la oficina"), sin pedir su archivo (el servidor da 404 y no es un
  error). La app no anula fotos.
- Menú **Evidencias** (`/evidencias`): todas las fotos del teléfono con su estado.

## Estatus del viaje

| Viaje | Estatus, en orden (los mismos nombres que oficina) |
| --- | --- |
| Cargado | Asignado → EnPosicionamiento → EnPatioOrigen → EnCarga → **Documentado** → EnTransito → EnPatioDestino → EnDescarga → **Descargado** → Cerrado (o **Cancelado** por la oficina: se muestra y no admite reportes) |
| Vacío | Asignado → EnTransitoVacio → EnPatio (o EnTaller si el último tramo es a Taller) → Cerrado |

- El operador solo avanza hacia adelante y puede saltar intermedios. Asignado y Cerrado los pone la oficina.
- Los intermedios se aplican al momento. **Documentado** y **Descargado** son hitos: quedan "Pendiente de confirmar por
  oficina" (ahí la oficina captura toneladas y estadía).
- La oficina puede avanzar el viaje sin esperar al operador. La app guía desde el estatus más avanzado que conoce (el
  del servidor o lo que el operador ya reportó) y deja de ofrecer los pasos anteriores.
- Las incidencias (Detenido en parador, Falla mecánica, Retén o inspección, Desvío de ruta, Otro) no cambian el estatus.
  En "Otro" la nota es obligatoria. Viajan con los valores del backend (`DetenidoEnParador`, `IncidenciaMecanica`,
  `RetenOInspeccion`, `DesvioDeRuta`, `Otro`); igual los motivos de tramo (`CargaCombustible` → "Carga de combustible").
- Estados del reporte: Pendiente de enviar, Enviado, Pendiente de confirmar por oficina, Confirmado, Descartado por
  oficina (con su motivo) y No aceptado. Un Confirmado puede volver a "Enviado" sin efecto si la oficina anula el hito.
  El `mensaje` del servidor se muestra tal cual.
- Los textos de los botones están en `shared/utils/estatus-viaje.util.ts` (`BOTON_ESTATUS`).

## Datos de ejemplo

- Cualquier celular de 10 dígitos con un PIN de 6 números entra. Si el celular termina en `0000`, entra sin viaje.
- Una salida con 4 viajes: vacío a cargar combustible, dos cargados, y un regreso vacío cuyo último tramo va al taller.
- Hoja de ruta de esa salida (el tramo 3 lleva material peligroso) y, en el viaje 2, una Carta Porte que "subió la
  oficina" (se ve solo como renglón). Las fotos se guardan en memoria con las reglas del contrato.
- La "oficina" de ejemplo:
  - confirma los hitos 20 s después de recibirlos;
  - 30 s después de "Me están cargando" pone **Documentado ella misma** (si el operador no lo reportó);
  - 30 s después de Descargado confirmado, o de la llegada en vacío, cierra el viaje.
- Un estatus igual o anterior al actual se recibe "sin efecto": queda registrado, pero el viaje no retrocede.
- En pruebas, la "oficina" de ejemplo también puede anular un hito confirmado (`anularHito`), anular una foto
  (`anularEvidencia`) y cerrar la salida (`cerrarSalida`); en la app de ejemplo no lo hace sola.
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
        http/                     implementación real (contrato M1): traducción y errores en *.util.ts
      almacen/                    base IndexedDB (cola de reportes, credenciales y cola de fotos)
      evidencias/                 cola de fotos (IndexedDB) y su almacén
      hoja-ruta/                  hoja de ruta con copia en el teléfono
      reloj/                      aviso de hora del teléfono mal puesta
      sesion/                     almacén de sesión (sin PIN), entrar/salir, guards
      viaje/                      asignación (salida y viajes, con copia para ver sin señal) y refresco
      reportes/                   cola de reportes en IndexedDB
      conexion/  ubicacion/  mensajes/  config/
      plataforma.ts               tokens de plataforma (almacenamiento, navigator, reloj)
    features/
      acceso/                     celular + PIN
      viaje/                      Mi viaje y el detalle de cada viaje (/viaje/:id)
      reportes/                   Mis reportes
      hoja-ruta/                  Hoja de ruta
      evidencias/                 Evidencias (fotos del teléfono)
    shared/
      utils/                      lógica pura (*.util.ts) con sus pruebas: estatus, incidencias, línea de tiempo…
      ui/                         panel de avance, línea de tiempo, datos del viaje, reporte
    testing/                      apoyo para pruebas (fuera del build de la app)
scripts/marca.mjs                 aplica la marca e iconos
```

## Para publicar contra la API real

1. En `src/environments/environment.ts`: `fuenteDatos: 'api'` y `apiUrl` con la URL pública de TMS.WebAPI (con `/api`).
2. Agregar el origen de la app publicada a `Cors:OrigenesOperador` en el servidor.

## Reglas que no cambian

- El operador solo ve lo suyo.
- La app nunca hace retroceder un viaje ni pone Asignado o Cerrado. Los hitos los confirma la oficina.
- El operador nunca ve tarifas, ingresos, costos, utilidad, pagos ni importes (tampoco de casetas o diésel). Esos campos
  no existen en los modelos, y las pruebas lo verifican sobre los datos de ejemplo y sobre la traducción de la API real.
- Horas siempre en la zona del negocio (America/Mexico_City), en formato dd/MM/yyyy HH:mm.
