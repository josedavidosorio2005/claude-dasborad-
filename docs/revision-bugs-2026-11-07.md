# Revisión de errores y bugs — 2026-11-07 (solo lectura)

Revisión antes de la entrega de **Clínica Aurora y Hospital La María** (lunes 09/11;
reunión con el cliente el martes 10/11).

- Se hizo sobre `main` en `8f7a1fa` (v1.144.0) y producción en **1.144.0**.
- **No se cambió código** ni se escribió nada en producción: 0 escrituras; todas quedaron
  bloqueadas en el navegador salvo el inicio de sesión.
- Las cuentas reales se nombran por su rol o su id, nunca por el nombre de la persona.

## 1. Alcance y cómo se hizo

| Parte | Qué se revisó | Resultado |
|---|---|---|
| Pruebas | `npm test` (suite completa) | **2716 / 2716**, 0 fallas |
| Auditoría | `npm audit` (server) | **0 vulnerabilidades** |
| Código | Diff de las Fases 268–286 (PRs #679–#707, 44 archivos, unas 1.900 líneas): Calidad, perfil SUPERVISOR, Errores de Aurora, Tipificación y salida, skills, logo, destello de SURA, Marcar todo, usuarios | Hallazgos en la tabla |
| Producción, administrador | Brave visible, a 1440 y 375 px, sesión del administrador. En ORLANT, Mobilize, Aurora y HLM, cada pestaña y sub-pestaña con:<br>• los filtros del panel (Mes, Cola, Skill, Asesor, Tipo, Granularidad…), cambiados y devueltos;<br>• Marcar todo / Ninguno;<br>• «Meses» en Todos, Ninguno, el mes más nuevo y el más viejo;<br>• Exportar a Excel (el archivo se descartó).<br>En SURA, sus 6 pestañas. | **0 errores de consola**, **0 pedidos fallidos**, 0 gráficas vacías, 0 textos cortados, sin scroll horizontal en los tableros genéricos |
| Producción, SUPERVISOR | No se pudo: no hay clave de una cuenta SUPERVISOR. Se cubrió con el código, las pruebas y la verificación local de la Fase 286 (supervisor de Aurora con la base demo) | — |
| Conteos (solo números) | Usuarios por rol y campaña, monitoreos, plantillas y pestañas ocultas por tablero | Ver § 3 |

## 2. Hallazgos, por gravedad

**🔴 = arreglar o decidir antes del martes 10/11.** «Lo ve el cliente» = lo ve la cuenta
del cliente (CLIENTES_DASH) hoy o en cuanto se encienda esa pestaña.

| # | Cliente / pantalla | Qué pasa | Cómo reproducirlo | Gravedad | ¿Lo ve el cliente? | Arreglo propuesto |
|---|---|---|---|---|---|---|
| 1 🔴 | **HLM y Aurora** · pestañas del cliente | El cliente de **HLM solo ve «Total tráfico»**: Tráfico de Llamadas, Tráfico de WhatsApp, salida, Tipificación y Calidad están ocultas. El de **Aurora** no ve «Llamadas y WhatsApp de salida», «Agendas por usuaria», «Tipificación» ni «Calidad». Además, «Total tráfico» de Aurora suma la salida (16.019 llamadas + 17.166 WhatsApp), pero el cliente no tiene la pestaña donde se ve ese detalle. | Admin › tablero del cliente (o `GET /api/dashboard/<cliente>`): `oculta: true` en esas pestañas. | **Alta** (decisión) | Sí: es lo que va a ver el martes | Decidir con Edwin qué pestañas ve cada cliente y encenderlas con una migración idempotente (`runOnceMigration`), como siempre. No hace falta código nuevo. |
| 2 🔴 | **HLM** · datos | Solo hay **agosto** de tráfico (llamadas y WhatsApp). No hay septiembre ni octubre, ni CDR (sin Tipificación ni salida), ni tiempos de respuesta de WhatsApp: la sub-pestaña «Nivel de Servicio» dice «Sin tiempos de respuesta de WhatsApp cargados todavía». | «Meses» de HLM: solo Agosto 2026. Tráfico de WhatsApp › Nivel de Servicio. | **Alta** (datos) | Sí, en cuanto se encienda Tráfico | Pedir a Edwin el tráfico de sep/oct, el HistCDR, el HistChat y el «10. Detalle de llamadas contestadas» de HLM, y cargarlos por la interfaz con tu OK. |
| 3 🔴 | **Aurora** · Agendas por usuaria | La base que pasó Edwin no era la definitiva: las agendas salen de 3 bases (ya está en `docs/pendientes.md`). Hoy suma 1.678 (octubre 1.509). | Aurora › Agendas por usuaria. | **Alta** (datos) | Hoy no (pestaña oculta); sí si se enciende | Corregir el lunes 09/11 con Edwin. Recargar solo con los archivos definitivos y tu OK. No encender la pestaña antes. |
| 4 🔴 | **Aurora y HLM** · Calidad | Desde la Fase 270, «Calificar» usa una lista de usuarios ASESOR. **No hay ningún ASESOR ni CALIDAD de Aurora ni de HLM** (solo de Mobilize: 3 ASESOR y 1 CALIDAD). Por eso el campo Asesor sale deshabilitado y no se puede calificar ningún monitoreo. Las plantillas sí están: Aurora id 10, HLM id 11. Hay 0 monitoreos y la pestaña Calidad está oculta en los dos. | Calidad › Calificar › campaña Aurora: «Esta campaña no tiene usuarios ASESOR». | **Alta** si Calidad entra en la entrega | No hoy | Crear las cuentas ASESOR (y CALIDAD si aplica) de Aurora y HLM por Usuarios, con tu OK (es escritura en producción). No es código. |
| 5 🔴 | **Todos** · Calidad · datos que llegan al cliente | `GET /api/monitoreos` le entrega a la cuenta del cliente cada monitoreo completo **menos el teléfono**: nombre del asesor, nombre del evaluador, ID de llamada, codificación, respuestas y **observaciones**. Pasa también en Aurora y HLM, donde el registro dice que el cliente no ve nombres de asesor (`asesorVisibleCliente: false`). La pantalla esconde el asesor, pero el dato viaja en la red. Las observaciones son texto libre y, a diferencia de Errores, **no se revisan** para frenar documentos o teléfonos de pacientes. Hoy Aurora y HLM tienen 0 monitoreos: aún no hay nada expuesto. | Cuenta de cliente de Aurora › Calidad › herramientas del navegador › respuesta de `/api/monitoreos`. Código: `server/routes/calidad.js` (`monitoreoPara`, solo quita `telefono`). | **Alta** (privacidad, antes del primer monitoreo de Aurora/HLM) | Sí (por la red; en pantalla, las observaciones) | En el servidor, para CLIENTES_DASH: quitar `asesor` y `asesorUserId` si el cliente no tiene `asesorVisibleCliente`, y los nombres del evaluador. Rechazar en las observaciones de monitoreos los documentos o teléfonos, con la misma regla de Errores (ver #11). Con pruebas. |
| 6 🔴 | **Aurora** · Errores | La pestaña Errores (visible para el cliente) muestra los **nombres de las asesoras**, quién registró o editó cada error y las observaciones, también en Exportar. Las demás pestañas de Aurora ocultan los nombres de asesor al cliente. Así lo pidió Edwin en su modelo, pero choca con la regla de Aurora. Hoy hay 0 errores registrados. | Cuenta del cliente de Aurora › Errores (con un error registrado). `GET /api/calidad/errores` trae `porAsesor[].asesor`, `creadoPorNombre` y `observacion`. | **Media** (decisión) | Sí | Confirmar con Edwin si el cliente debe ver los nombres en Errores. Si no: en el servidor, para CLIENTES_DASH, agrupar sin nombre (o «Asesora 1, 2…») y sin `creadoPorNombre`. |
| 7 | **ORLANT** · abrir el tablero | La primera apertura tardó **4,7 s** a 1440 (después, 0,9 s). Es la única demora de más de 3 s de la revisión; todas las pestañas tardaron entre 0,3 y 0,4 s. | Abrir ORLANT por primera vez en la sesión (caché fría). | **Media** | Sí (cliente de ORLANT) | Medir qué pedido tarda al abrir (probablemente `/dashboard/ORLANT` con la caché fría). Si es así, calentar la caché al arrancar o pedir en paralelo. Sin urgencia para el martes. |
| 8 | **Mobilize** · Tipificación vs Llamadas Únicas y de Salida | Los números de salida no cuadran entre pestañas. Tipificación: «185 Llamadas de salida · 135 Conectadas · 50 No conectadas». Únicas y de Salida: «404 de salida · 185 conectadas · 219 no conectadas». Es el pendiente conocido (Fase 191) de las filas «-» tipificadas «Cliente_no_contesta». | Mobilize › Tipificación (oculta para el cliente) y › Llamadas Únicas y de Salida, Meses = Todos. | **Media** | No (Tipificación está oculta para el cliente de Mobilize) | Decisión de Edwin (ya en pendientes): si esas filas cuentan como conectadas. Mientras tanto, no encender Tipificación de Mobilize al cliente. |
| 9 | **Mobilize** · Calidad | El único monitoreo (50 %) se calificó con la plantilla vieja (10 ítems). La pestaña, visible para el cliente, muestra un solo monitoreo y «1 con fallos críticos». | Mobilize › Calidad. | **Media** | Sí | Ya en pendientes: Edwin decide si se vuelve a calificar con la plantilla de 14 ítems (escritura con tu OK). |
| 10 | **SURA** · Agentes a 375 px | El panel «Agentes» se puede desplazar de lado en el celular, y la captura de esa pestaña seguía mostrando «Cumplimiento» marcado arriba. Puede ser la tabla ancha de agentes, con scroll interno a propósito, y el clic que cayó en el menú lateral oculto. **Por confirmar.** | SURA a 375 px › Agentes. | **Baja** (por confirmar) | Sí (2 cuentas de cliente de SURA) | Revisarlo a mano a 375 px. Si es la tabla, dejarla con scroll interno (como las demás); si no, ajustar el ancho. |
| 11 | **Aurora** · Errores › observación y plan | La regla de «datos de pacientes» (`\d[\d .-]{6,}\d`) también rechaza **fechas con guiones o espacios**, como «15-10-2026» o «2026-10-15». El mensaje dice que hay un documento o teléfono, y confunde a quien escribe. Con barras («15/10/2026») sí pasa. | Agregar errores › Observación «Cita del 15-10-2026 mal agendada» › Guardar → 400. | **Baja** | No (lo ve el supervisor) | Que la regla no cuente las fechas `DD-MM-AAAA` / `AAAA-MM-DD`, o que el mensaje sugiera escribirlas con barras. Con pruebas. |
| 12 | **ORLANT / Mobilize** · Tipificación | La tarjeta «Conectadas (72.97%)» usa **punto decimal y sin espacio**. El resto de la plataforma usa coma y espacio («72,97 %»). | Mobilize › Tipificación › tarjetas. Código: `public/js/tipificacion.js:363`. | **Baja** | No (Tipificación oculta para los clientes) | Formatear con `es-CO` como las demás tarjetas. |
| 13 | **Mobilize** · Calidad › filtros Mes / Asesor | «Ninguno» en el filtro Mes de Calidad deja **vacío** el tablero («Sin opciones para los meses elegidos»). En «Meses» de arriba, Ninguno equivale a Todos. Las dos listas se comportan distinto. | Mobilize › Calidad › Mes › Ninguno. | **Baja** | Sí | Que Ninguno equivalga a «Todos», como en Meses, o un aviso más claro («Marca al menos un mes»). |
| 14 | **Usuarios** · SUPERVISOR migrado | Al pasar un SUPERVISOR al perfil nuevo, la casilla «Puede cargar datos operativos» se esconde y **se conserva lo guardado**. Si una cuenta vieja tenía `cargarDatos: true`, seguiría cargando bases de **todos** los clientes, no solo de los que supervisa. Hoy las 3 cuentas SUPERVISOR lo tienen en `false`: sin efecto. | Leer el código de `saveUser` / `syncSupervisa` (`public/js/users.js`). | **Baja** | No | Al guardar un SUPERVISOR en el perfil nuevo, poner `cargarDatos: false`. Con prueba. |
| 15 | **Usuarios** · fecha de creación | `users.createdAt` se guarda en **UTC** y el Historial en hora de Colombia: la cuenta id 56 dice «21:02» en Usuarios y «16:02» en el Historial. | Admin › Usuarios vs Historial de la misma cuenta. | **Baja** | No | Guardar `createdAt` con la hora de Colombia (como `nowStr` del historial), sin tocar las fechas ya guardadas. |

### Revisado sin problema

- **Permisos del perfil SUPERVISOR** (Fase 283):
  - el servidor y el navegador usan la misma regla (`permisosEfectivos`) en el inicio de
    sesión, `getActor` y `/users`;
  - `/dashboard/cargas` filtra a los clientes del supervisor;
  - las cargas exigen el acceso al cliente;
  - `accesosSinEscalar` impide dar `supervisa_` de un cliente que quien edita no tiene.
- **Errores** (Fases 284 y 286):
  - solo el administrador o el SUPERVISOR del cliente escriben; el cliente recibe 403;
  - «Guardar» escribe el error y el plan en una transacción;
  - con la asesora vacía se guarda solo el plan;
  - un mes sin datos o fuera de «Meses» muestra un aviso, sin errores de consola.
- **Salida de Aurora** (Fases 277–278): la entrada se calcula como «no salida» con la misma
  condición (`condSalidaCanalSql`), así que las colas 4062 y 4063 no se cuentan dos veces.
- **Cuadre de tarjetas entre pestañas en producción**, con Meses = Todos:

  | Cliente | Total ingresados | Total contestados |
  |---|---|---|
  | ORLANT | 30.557 + 23.724 + 23.645 + 10.979 = **88.905** | **87.322** |
  | Aurora | 3.797 + 18.940 + 16.019 + 17.166 = **55.922** | **55.560** |
  | HLM | 12.087 + 14.202 = **26.289** | **21.027** |

  La salida de ORLANT por línea más «Sin clasificar» suma el total (52 llamadas y 73
  WhatsApp sin clasificar).
- **XSS**: en lo nuevo, todo texto que viene de datos pasa por `esc()`. Lo concatenado sin
  escapar son nombres de campaña (los fija el administrador) y textos fijos.
- **Exportar** solo exporta la pestaña abierta, así que Errores exporta lo que se ve.
- **Destello de SURA** (Fase 273): SURA abre en 1,5–1,8 s con el indicador de carga y sin
  errores.

## 3. Conteos en producción (07/11, solo números)

| Qué | Valor |
|---|---|
| Usuarios activos por rol | CLIENTES_DASH 6, SUPERVISOR 3, ADMIN 3, CALIDAD 1, ASESOR 3 |
| ASESOR por campaña | MOBILIZE 3 — **Aurora 0, HLM 0** |
| CALIDAD por campaña | MOBILIZE 1 — **Aurora 0, HLM 0** |
| Cuentas de cliente por tablero | ORLANT 3, MOBILIZE 3, Aurora 1, HLM 1, SURA 2 |
| SUPERVISOR | id 40: los 5 clientes · id 46: MOBILIZE · id 56: Aurora y HLM (ninguno con `cargarDatos`) |
| Monitoreos | ORLANT 153 · MOBILIZE 1 · Aurora 0 · HLM 0 |
| Errores de Aurora | 0 |
| Meses con datos | ORLANT ago–oct · MOBILIZE ago–nov · Aurora jul–oct · **HLM solo ago** |

## 4. Bugs de la revisión del 03/11 (`docs/revision-bugs-2026-11-03.md`)

| Del 03/11 | Estado hoy |
|---|---|
| H1 — usuario nuevo con todos los clientes y campañas marcados | **Cerrado** (Fase 222, PR #631): nacen sin marcar, y `accesosSinEscalar` en el servidor |
| H2 — `DD/MM/AAAA` leído como mes/día | **Cerrado** (Fase 223, PR #633): `gdFechaTextoAIso` en Calidad, Metas y Tráfico |
| H3 — fecha y hora desde las 7 p. m. corrida al día siguiente | **Cerrado** (Fase 223): `2026-10-31 20:30` → `2026-10-31` (comprobado hoy) |
| H4 — «mes actual» en UTC | **Cerrado** (Fase 223): `gdHoyLocal` / `fechaLimitesHoyColombia` |
| H5 — sin lint | **Abierto, en espera** (decisión del 04/11): ESLint trae `minimatch` con aviso de `npm audit` |
| S1 — base inicial de SURA completa al cliente | **Cerrado** (Fase 222, PR #632): solo 10 columnas |
| S2 — columnas de SURA por posición fija | **Abierto** (por diseño, como el HTML de Edwin); sin aviso todavía |
| S3 — WhatsApp rechaza `31/10/2026` | **Abierto, por diseño**: desde la Fase 223 el lector de WhatsApp usa mes primero (`mesPrimero`), así que `31/10/2026` sigue dando `null` (comprobado hoy) |
| S4 — `/dashboard/cargas` lista cargas de todos los clientes | **Abierto (por diseño) para `cargarDatos`**. Desde la Fase 283, un SUPERVISOR solo ve las de sus clientes |

## 5. Qué hacer antes del martes 10/11 (propuesta, nada aplicado)

1. **Decidir con Edwin el lunes** qué pestañas ve el cliente de Aurora y el de HLM (#1), y
   si Errores muestra nombres al cliente (#6).
2. **Cargar con tu OK** lo que Edwin mande de HLM (#2) y las agendas definitivas de Aurora
   (#3).
3. **Si Calidad de Aurora/HLM entra en la entrega:**
   - crear las cuentas ASESOR/CALIDAD (#4);
   - antes del primer monitoreo, el arreglo de privacidad de `/monitoreos` (#5): un PR
     pequeño con pruebas.
4. Lo demás (#7–#15) puede ir después de la entrega.
