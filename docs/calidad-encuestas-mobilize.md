# Calidad de encuestas — Mobilize (Fase 331)

Pedido del supervisor, comprometido con el cliente: las llamadas cuya encuesta
salió mal calificada se escuchan y se califican desde el Módulo de Calidad.

## Regla de "mal calificada"

Configurable por pregunta en la tabla `encuesta_monitoreo_reglas` (campaña,
pregunta, rango `min..max` inclusivo), no fija en el código. Sembrada solo para
MOBILIZE (11/11/2026):

| Pregunta | Escala | Mal calificada |
|---|---|---|
| P1 (recomendación) | 0 a 10 | 0 a 5 |
| P2 (satisfacción) | 1 a 5 | 1 a 3 (el 3 sí cuenta) |
| P3 (resuelto en el primer contacto) | 1 = Sí, 2 = No | No |
| P4 (facilidad) | 1 a 5 | 1 a 3 |

Las columnas Q05–Q10 del HistIVR vienen vacías y no se leen.

## Cómo funciona

- **Vínculo encuesta → monitoreo por CONN_ID** (`monitoreos.encuestaConnId`,
  `origen = 'encuesta'`), con índice único parcial: el servidor rechaza un
  segundo monitoreo para la misma llamada. No se usa `encuestas.id` porque al
  volver a subir un mes las filas se reinsertan con otro id.
- **Una fila por llamada**, aunque haya fallado varias preguntas.
- **Bloqueo** "La está calificando otra persona" (`encuesta_monitoreo_bloqueos`):
  15 minutos, renovado cada 2 minutos mientras el formulario está abierto; se
  libera al guardar, al cancelar, al cerrar el módulo o al cambiar de campaña.
- **Sin ID de la llamada**: esas encuestas no se pueden ubicar en Wolkvox; no
  entran a la lista y se cuentan en un aviso discreto.
- **Hora**: desde la versión 1.166.0 se guarda la hora de la llamada (HH:MM de
  `DATE`). Las encuestas cargadas antes quedan sin hora hasta que se vuelva a
  subir ese mes.
- **Acceso**: administrador, supervisor, CALIDAD, Reportes y Gerencia de la
  campaña ven la lista; solo quien puede calificar (administrador, supervisor,
  CALIDAD) abre una llamada. El ASESOR y la cuenta de cliente nunca (403).
- **Promedios**: hoy nada filtra por origen, así que un monitoreo de encuesta
  entra al promedio de Calidad de Mobilize y de cada asesor como cualquier otro.
  Queda marcado por origen y se puede filtrar; **el supervisor decide** si debe
  salir del promedio (pendiente).

## Plan por PRs

1. Servidor: reglas, vínculo, bloqueo y rutas (v1.165.0, PR #759).
2. Pestaña «Calidad de encuestas» en Calidad › Mobilize, hora de la llamada y
   el formulario Calificar ya lleno (v1.166.0).
3. Marca y filtro por origen (encuesta / manual) en Monitoreos.
4. Botón «Monitoreo» por pregunta en la pestaña Encuesta del dashboard de
   Mobilize (no lo ve la cuenta de cliente).

## Si más adelante el supervisor pide el teléfono

Hoy **no se guarda** (regla de la Fase 131, confirmada por el usuario el
11/11/2026). Si se aprueba guardarlo, haría falta:

1. OK escrito del usuario (es un dato personal del cliente final).
2. Lector (`public/js/encuesta-logic.js`): leer la columna `ANI` al final del
   payload, como `connId` y `hora` (opcional, para que una carga vieja siga
   válida).
3. Validación (`encuestaFilaArraySchema`) y migración `ADD COLUMN telefono`
   en `encuestas`, sin tocar filas.
4. Devolverlo **solo** en las rutas de Calidad de encuestas (nunca en
   resumen/comentarios de la Encuesta ni a la cuenta de cliente) y llenar
   `telefono` en el formulario Calificar.
5. Actualizar las pruebas que hoy vigilan que el teléfono no viaje
   (`fase147-b-encuesta`, `fase184-encuesta-conn-id`, `fase331-*`).
6. Que el supervisor vuelva a subir los meses ya cargados para tener los
   teléfonos.
