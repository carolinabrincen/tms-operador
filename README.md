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
  un viaje activo" y "Reportes" conserva todo lo reportado.
- La hora del reporte es la del teléfono: si va adelantada (el servidor rechaza más de 10 minutos), la app avisa desde
  los 5 minutos comparando con la hora del servidor de cada acuse.

## Incidencias abiertas y "Ya continué" (contrato M1, secciones 2 y 7)

- La asignación trae `incidenciasAbiertas` (también las que registró la oficina). En Mi viaje, arriba del botón
  principal, hay un aviso ámbar delgado por cada una: tipo, "Abierta desde 2:07 p. m." (hora del negocio) y el botón
  **Ya continué** a la derecha.
- "Ya continué" pide confirmar (muestra la nota de la incidencia; nota propia opcional) y manda el término por **la misma cola** que los reportes: id propio,
  se guarda primero en el teléfono, se envía con señal, reenviar el mismo id no duplica y lleva la ubicación si hay
  permiso. En cola, la tarjeta dice "Pendiente de enviar" y no repite el botón. Si el servidor responde que ya estaba
  terminada (por usted, por un estatus o por la oficina), se toma como hecho, sin error.
- No bloquea nada: si el operador reporta su siguiente paso, el servidor termina las abiertas de ese viaje y al
  refrescar la tarjeta desaparece. Una incidencia reportada desde la app aparece de inmediato (sin botón hasta que la
  oficina la recibe y la asignación trae su id).
- Errores de la sección 7: un texto de usted por código (`shared/utils/incidencias-abiertas.util.ts`).

## Hoja de ruta (contrato M2, sección 1)

- Mi viaje → renglón **Hoja de ruta · próxima caseta: …** (`/hoja-ruta`): teléfonos de oficina y de tráfico con
  **Llamar**; por tramo, origen y destino con una línea de detalle, **MATERIAL PELIGROSO** si aplica, la parada
  autorizada y **solo la próxima caseta** ("Próxima caseta · 1 de 3", su nombre en grande y **Ya la pasé**). "Ya la
  pasé" se recuerda en el teléfono por salida (`core/hoja-ruta/casetas.service.ts`, solo conteos); **Ver todas** abre la
  lista completa (y permite regresar una marcada por error); al terminar, "Sin casetas pendientes". Lo demás del tramo
  (cliente, producto, toneladas, referencia, motivo del vacío, notas) va plegado en "Más datos del tramo".
  **Abrir en mapa** por tramo con `ligaMapa` (solo ligas https). Al final, datos de la salida y de la unidad.
- Se guarda en el teléfono (localStorage, por operador) para verla sin señal y se vuelve a pedir al recuperar la señal.
  El encabezado dice "al día …" y, si se ve la copia guardada, avisa que puede no estar al día. Sin salida activa lo dice.
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
- Menú **Fotos** (`/evidencias`): todas las fotos del teléfono con su estado. En Mi viaje, el botón **Foto** abre la
  hoja para tomarla (solo viajes cargados).

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
- Una incidencia abierta que registró la oficina en el viaje 1 (Retén o inspección); "Salí" la termina sola.
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

## Estilo visual (referencia aprobada el 26/11/2026)

- La referencia está en `docs/diseno-app-operador/mi-viaje.html` y `hoja-ruta.html` (carpeta de documentos). Sus tokens
  (colores, radios, medidas, letra Manrope con respaldo `system-ui`) están **solo** en `src/tema.scss`.
- La letra **Manrope va dentro de la app**: `src/fuentes/manrope/` (woff2 de 400, 500, 600 y 700, subconjunto latino, de
  `@fontsource/manrope` 5.1.0) con su licencia SIL OFL 1.1 (`OFL.txt`). Se declara con `@font-face` en `styles.scss`;
  el build la copia a `media/` y el service worker la descarga junto con la app. No se pide nada a Google Fonts.
- Criterios de aceptación (operador promedio de 42 años, en ruta; heurísticas de Nielsen): ningún texto menor de 13 px
  (solo etiquetas del menú y de la línea de avance), datos de 16-17 px, secundarios de 14 px, todo en rem; texto
  secundario nunca más claro que #4B5563 y contraste ≥ 4.5:1 (prueba en `core/config/tema-colores.spec.ts`); botón
  principal de 72 px y los demás de 50 a 64 px.
- **Mi viaje**: barra con nombre corto, unidad y el estado real de la cola ("Con señal · todo enviado", "Enviando…",
  "Sin señal · 2 por enviar") y **Tráfico** (llama al teléfono de tráfico de la hoja guardada; si no hay, a la oficina;
  si no hay ninguno, no aparece). Bloque oscuro del paso actual ("Usted está aquí · paso 4 de 10", estatus en 40 px con
  su nombre formal, "desde …" y la línea por hitos con el marcador amarillo en la posición real). Origen y destino
  (tocarlos abre el detalle del viaje) con el renglón de la hoja de ruta. Abajo, **fijos sobre el menú** (nunca quedan
  fuera de la vista; lo de arriba se desplaza por debajo), el **botón principal** con el paso en palabras del operador
  ("Ya cargué") y su línea de ayuda ("Toque cuando termine la carga"), y la fila **Incidencia · Foto · Otro paso**.
- El estatus del bloque oscuro va en un renglón: si no cabe a 40 px baja por pasos (36, 32) hasta 28 px, medido con la
  letra real; solo si ni así cabe usa dos renglones (`shared/utils/tamano-estatus.util.ts`).
- **Deshacer**: al tocar el botón principal, el reporte se guarda y espera 8 s (`LAPSO_DESHACER_MS`) antes de enviarse;
  mientras, "Guardado: «Ya cargué», 11:32 a. m." con **Deshacer**, que lo borra sin enviar nada. La ubicación se agrega
  si llega en ese lapso. Si se cierra la app durante el lapso, se envía al volver. Mientras el navegador vaya a pedir el
  permiso de ubicación, primero se abre la hoja con la explicación.
- Menú inferior: Mi viaje, Reportes, Fotos y **Mi cuenta** (celular, "Gastos, próximamente" y **Salir** con
  confirmación). Con datos de ejemplo, franja fija arriba: "Datos de ejemplo: no son viajes reales".
- Horas en 12 horas ("1:26 p. m.") en la zona del negocio; fechas cortas ("29 nov"). Al entrar, una vez por sesión:
  "Por su seguridad, use la app con la unidad detenida." (no bloquea). Sin señal no es error: "Quedó guardado y se
  enviará solo cuando haya señal."
- El detalle del viaje (`/viaje/:id`) tiene lo que no cabe en Mi viaje: datos, fotos, línea de tiempo, los demás viajes
  de la salida, la unidad y "Actualizar".

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
      hoja-ruta/                  hoja de ruta con copia en el teléfono y casetas pasadas
      reloj/                      aviso de hora del teléfono mal puesta
      sesion/                     almacén de sesión (sin PIN), entrar/salir, guards
      viaje/                      asignación (salida y viajes, con copia para ver sin señal) y refresco
      reportes/                   cola de reportes en IndexedDB
      conexion/  ubicacion/  mensajes/  config/
      plataforma.ts               tokens de plataforma (almacenamiento, navigator, reloj)
    features/
      acceso/                     celular + PIN
      viaje/                      Mi viaje y el detalle de cada viaje (/viaje/:id)
      reportes/                   Reportes
      hoja-ruta/                  Hoja de ruta
      evidencias/                 Fotos (las del teléfono)
      cuenta/                     Mi cuenta (Salir, Gastos próximamente)
    shared/
      utils/                      lógica pura (*.util.ts) con sus pruebas: estatus, incidencias, línea de tiempo…
      ui/                         encabezado, paso actual, trayecto, panel de avance, línea de tiempo, datos del viaje…
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
- Horas siempre en la zona del negocio (America/Mexico_City), en 12 horas ("29 nov, 1:26 p. m.").
