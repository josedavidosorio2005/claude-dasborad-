# Módulo de Calidad conectado a la plataforma — diagnóstico y plan

Fase 233, 04/11/2026. **Solo lectura y plan**: no se cambió código. Parte del
análisis de la Fase 94 ([`calidad-flujo-edwin-brecha.md`](calidad-flujo-edwin-brecha.md))
y del pedido de Edwin en la reunión del 04/11. Edwin dijo que esto se
trabaja después y con calma.

> **Excel de Edwin** (04/11): resumen y diferencias en la sección siguiente,
> "Actualización 04/11/2026: con los Excel de Edwin".
>
> **Prototipo HTML de Edwin**: ya se revisó (04/11, después de la Fase 237).
> Lo que trae, la comparación con la plataforma y el plan por PRs que
> reemplaza la sección 8 están en la sección siguiente, "Actualización
> 04/11/2026". Las secciones 1 a 8 quedan como estaban, como antecedente.
>
> **05/11/2026 (Fases 252–256)**: ya están construidos B1–B5 (campos por
> plantilla, importador y versiones, formulario Calificar, resumen/detalle/
> diccionario, pestaña Calidad de Mobilize y Mis resultados). Lo que sigue
> abajo, "Diseño: enlace Encuesta NPS → Calidad", es **solo diseño**.

## Diseño: enlace Encuesta NPS → Calidad (05/11/2026, no construido)

**Solo diseño. No se construye sin el OK del usuario.** Pedido: cuando una
encuesta sale mal calificada, la llamada pasa a Calidad para auditarla.

### Qué ya existe

| Pieza | Dónde |
|---|---|
| Encuestas por llamada (Mobilize) | Tabla `encuestas` (`campana`, `fecha`, `agente`, `skill`, `q1`–`q4`, `comentario`, `connId`). `q1` es la pregunta de recomendación (0–10, la del NPS), `connId` es el ID de la llamada (Fase 184) |
| Columnas preparadas en monitoreos | `monitoreos.origen` (`'manual'` hoy) y `monitoreos.encuestaId` (NULL hoy), Fase 252, migración no destructiva |
| Formulario Calificar | Fase 254, plantillas con campos (Mobilize, al importarla) |
| Monitoreo completo obligatorio | Servidor (Fase 252): no se guarda con ítems sin calificar |

### Regla para mandar una llamada a auditar

- **Detractor**: `q1` de 0 a 6, la misma definición del NPS de la pestaña Encuesta.
- Opcional, configurable por campaña en el registro de clientes
  (`parametros.auditoriaNps`): `{ umbralQ1: 6, incluirQ2Bajo: false }`.
  Si `incluirQ2Bajo` es verdadero, también entran las encuestas con `q2` de 1 o 2.
- Solo encuestas con `connId` (sin ID de llamada no hay qué escuchar) y
  cargadas desde que se active la regla. Las viejas no entran solas.

### Flujo propuesto

1. **Al cargar la encuesta** (Centro de cargas, como hoy), el servidor marca
   los detractores como **pendientes de auditoría**: tabla nueva
   `calidad_auditorias` (`id`, `campana`, `encuestaId`, `connId`, `agente`,
   `fecha`, `motivo` ('NPS 3', por ejemplo), `estado` 'pendiente' |
   'auditada' | 'descartada', `monitoreoId`, `asignadoA` (usuario CALIDAD,
   opcional), `createdAt`, `updatedAt`). Es idempotente por `encuestaId`, así
   que recargar el archivo no duplica. **No se crea un monitoreo vacío**: el
   monitoreo existe solo cuando Calidad lo califica.
2. **Calidad › Calificar** muestra arriba una bandeja "Para auditar (N)" con
   fecha, agente, ID de llamada, nota NPS y comentario del cliente. Al
   elegir una, el formulario se llena con asesor, fecha y ID de llamada, y
   el monitoreo se guarda con `origen = 'nps'` y `encuestaId`. La auditoría
   pasa a `auditada` con su `monitoreoId`.
3. **Descartar** (por ejemplo, la llamada no se encuentra) pide un motivo
   corto y deja la auditoría en `descartada`, con quién y cuándo. Nunca se borra.
4. **Resultados**: en Resumen y en Detalle por mes, un filtro "Origen:
   Todos / Manual / NPS". En la pestaña Encuesta (dashboard), una tarjeta
   "Detractores auditados: X de Y (Z %)" y, por cada uno, su nota de calidad.

### Permisos y privacidad

- La bandeja la ven los usuarios CALIDAD con esa campaña (y plantilla), y el
  administrador. El comentario de la encuesta puede traer datos del cliente:
  se muestra solo en la bandeja, igual que hoy en la pestaña Encuesta, y
  nunca se copia al monitoreo.
- El asesor ve en "Mis resultados" que un monitoreo vino de una encuesta
  ("Origen: encuesta"), sin el comentario del cliente.
- Sin teléfonos ni cédulas (pregunta 3 sigue abierta).

### Plan por PRs (cuando se apruebe)

| # | PR | Qué hace | Tamaño |
|---|---|---|---|
| N1 | Regla y bandeja en el servidor | `calidad_auditorias` (migración no destructiva), marcar detractores al cargar, `GET /calidad/auditorias`, descartar. Pruebas sintéticas | M |
| N2 | Bandeja en Calificar | Lista "Para auditar", llenar el formulario, guardar con `origen='nps'` y `encuestaId` | M |
| N3 | Resultados | Filtro por origen y tarjeta "Detractores auditados" en Encuesta | S |

### Preguntas para Edwin

1. ¿El corte es NPS de 0 a 6 (detractor) o más estricto (0 a 4)?
2. ¿Se audita **todo** detractor o un porcentaje (por ejemplo, el 30 % al azar)?
3. ¿Quién audita: cualquier persona de Calidad de la campaña o alguien asignado?
4. ¿Plazo para auditar (por ejemplo, 48 h)? Si hay plazo, se puede avisar.
5. ¿Las encuestas de ago–oct ya cargadas entran o solo las nuevas?

## Actualización 04/11/2026: con los Excel de Edwin

**Solo plan. No se construye nada (C1–C10) sin el OK del usuario.** Edwin mandó
los 6 Excel de los que sale su HTML: ORLANT, Clínica Aurora, Hospital La María
Sede Castilla, Hospital La María Sede 33, Mobilize 2026 ajustada y SURA. Se
leyeron fuera del repo y solo por estructura (hoja "Diccionario de Ítems",
fila de encabezados de "Monitoreos" y la fórmula del puntaje). No se copió
ningún Excel ni texto de ítems, y no se leyeron las filas de monitoreos de
ejemplo (traen datos de personas). **Regla de Edwin**: no se suben plantillas
por Excel; los Excel solo definen ítems, pesos, críticos, motor y campos, y
cada plantilla se crea en pantalla (C3).

### F. Las 6 plantillas

| Plantilla | Ítems | Críticos | Motor | Respuestas | Campos del formulario en el Excel (además de los ítems) |
|---|---|---|---|---|---|
| ORLANT | 17 (1–17) | 7 | ponderado (`standard`) | SI / NO / N/A | Asesor, Fecha, ID llamada/WhatsApp, Teléfono, Codificación, Evaluador, Observaciones |
| Clínica Aurora | 12 (1, 3–13: no hay ítem 2) | 5 | ponderado | SI / NO / N/A | Igual que ORLANT |
| HLM · Sede Castilla | 12 | 5 | ponderado | SI / NO / N/A | Igual que ORLANT |
| HLM · Sede 33 | 7 | 3 | ponderado | SI / NO / N/A | Igual que ORLANT |
| Mobilize (2026 ajustada) | 14 | 5 | ponderado | SI / NO / N/A | Asesor, Fecha, Placa VH, Tipo de llamada (Entrada/Salida), ID de grabación, Tipificación, Observaciones. **Sin Teléfono ni Evaluador** |
| Televentas SURA | 9 | 4 | por descuento (nuevo) | SI / NO, **sin N/A**; 2 ítems con 4 opciones | Asesor, ID de agente, Fecha de monitoreo, ID llamada, Código de gestión, Evaluador, Cédula cliente, ID contacto, Tipificación sistema, Observaciones, Estrategia, Motivo de afectación, Causa |

Los pesos de las 5 ponderadas suman 100. Los de ORLANT son los mismos que ya
tiene la plataforma.

### G. HTML contra Excel: diferencias

Ítem por ítem (número, nombre, categoría, peso y crítico) las 6 plantillas
del HTML son **iguales** a los Excel, incluidos los descuentos y opciones de
SURA. El HTML conserva la numeración de Aurora (1, 3…13), no la renumera.
Las diferencias son solo de campos y de N/A:

| Tema | HTML | Excel |
|---|---|---|
| ID de agente | En las 6 plantillas | Solo en SURA |
| Motivo de afectación | En las 6 (se arma con los ítems fallados) | Solo en SURA, como columna propia |
| Mobilize, Evaluador | Lo pide | No lo trae |
| Mobilize, ID de grabación y Tipificación | Son el ID de llamada y la codificación con otro nombre | Igual (mismos nombres) |
| N/A en SURA | No lo ofrece | No existe (la fórmula solo descuenta con NO o con la opción elegida) |

### H. Cómo calcula cada una (fórmulas del Excel)

**Ponderado (ORLANT, Aurora, HLM, Mobilize)**, igual al motor `standard` de la
plataforma: SI y N/A suman el peso del ítem (N/A no se renormaliza); NO en un
no crítico suma 0; NO en un crítico suma peso − 20. El total se limita entre 0
y 100. Visto desde 100: un NO no crítico resta su peso y un NO crítico resta 20
fijos. Clasificación: menos de 70 Crítico, 70 a 89 No crítico, 90 o más
Sobresaliente. Alerta por monitoreo: 0 críticos fallados = sin fallos, 1 =
Alerta, 2 o más = Crítico absoluto.

> **HLM Sede 33**: sus 3 críticos pesan 20 cada uno, así que fallar un
> crítico cuesta lo mismo (20 puntos) que si no fuera crítico. Ahí "crítico"
> solo cambia la alerta, no la nota. Es coherente con la regla; se le
> confirma a Edwin.

**Por descuento (SURA)**: motor nuevo `descuento` (C1). El motor `sura` que
existe hoy no sirve. Casos de prueba de C1:

| Caso | Nota |
|---|---|
| NO en cualquiera de los 4 críticos | 0 % |
| Saludo y despedida: no saluda / no se despide / ninguno | −9 % / −6 % / −15 % |
| Escucha y respuesta: NO | −28 % |
| Expresión verbal: NO | −10 % |
| Tipificación: NO | −30 % |
| Manejo de objeciones: maneja 2 / maneja 1 / sin manejo | −7 % / −10 % / −12 % |
| Todo cumple | 100 % |
| Peor caso sin fallar críticos (−15 −28 −10 −30 −12) | 5 % |

Misma clasificación (70 / 90). No hay alerta de críticos: un crítico ya deja la
nota en 0.

### I. Resumen por asesor (C6): dos variantes

| Variante | Columnas |
|---|---|
| Ponderadas (5 plantillas) | # monitoreos, promedio, clasificación del promedio, alerta y total de fallos críticos. Alerta del resumen sobre la suma de fallos del asesor: 0 = sin fallos, 1 = Alerta, 2 o más = **Crítico frecuente** (nombre distinto al "Crítico absoluto" de un solo monitoreo) |
| SURA | # monitoreos, promedio, clasificación, cuántas calificaciones en 0 %, mejor y peor calificación |

### J. Ajustes a C2 y C3

- **C2 (campos por plantilla)**: la plantilla define sus campos según la tabla
  F. Mobilize sin Teléfono; "ID de grabación" y "Tipificación" son etiquetas de
  ID de llamada y codificación. El evaluador lo pone siempre la plataforma (es
  el usuario que califica), aunque el Excel de Mobilize no lo traiga. ID de
  agente y Motivo de afectación según lo que confirme Edwin (lista de abajo).
  Se mantiene la regla del HTML: no se guarda un monitoreo con ítems sin
  calificar (el Excel les da 0 en silencio).
- **C3 (editor)**: "admite N/A" apagado en los 9 ítems de SURA; respuestas por
  opción con su descuento en los 2 ítems de SURA que las tienen; el número del
  ítem lo escribe el administrador (Aurora salta el 2). La codificación de cada
  plantilla como **lista cerrada** (ya existe `calidad_codificaciones`): el
  Excel de Aurora trae duplicados en texto libre.
- **Ítems que aplican a veces** (Mobilize ítem 2, solo llamadas de salida;
  ORLANT ítem 17, solo pacientes 3P): hoy se marcan N/A a mano. Un N/A
  automático en Mobilize cuando el tipo de llamada es Entrada queda para
  confirmar.

### K. Las 7 preguntas de la sección E

| # | Pregunta | Estado | Por qué |
|---|---|---|---|
| 1 | Orden: C1–C3 o C6 primero | No | Decisión del usuario. Ya no hay bloqueo de datos para C1–C3 |
| 2 | HLM: Castilla o Sede 33 primero | En parte | Las dos plantillas están completas y se pueden crear juntas (la Fase 237 lo permite); falta cuál es la principal |
| 3 | Cédula del cliente en SURA (y teléfono) | No | El Excel confirma que se piden (cédula en SURA; teléfono en ORLANT, Aurora y HLM), pero falta decidir si se guardan completos, enmascarados o no |
| 4 | Calidad ve solo lo que califica | No | El Excel no trae permisos; el HTML dice "solo lo que ella califica", falta la decisión |
| 5 | Quién crea las plantillas en pantalla | No | Igual |
| 6 | Mobilize de 14 ítems | En parte | La "2026 AJUSTADA" tiene los 14 ítems y 5 críticos y una hoja de control de cambios: viene de una de 16. Falta el sí de Edwin y saber si hay monitoreos con la de 16 |
| 7 | Carga masiva de monitoreos por Excel | No | La regla habla de plantillas, no del importador de monitoreos |

### Falta que confirme Edwin

1. **ID de agente**: ¿va en todas las plantillas (como el HTML) o solo en SURA
   (como los Excel)?
2. **Mobilize**: ¿la "2026 AJUSTADA" de 14 ítems es la oficial? ¿Hay
   monitoreos hechos con la de 16 que haya que conservar?
3. **HLM**: ¿cuál sede es la principal? (Las dos se pueden crear ya.)
4. **SURA**: "Motivo de afectación", ¿se arma solo con los ítems fallados o lo
   escribe calidad? Estrategia y Causa, ¿texto libre o lista? ¿Con qué
   opciones?
5. **Cédula (SURA) y teléfono**: ¿completo, últimos 4 dígitos o no se guarda?
6. **N/A automático**: ¿Mobilize ítem 2 va en N/A solo cuando la llamada es de
   Entrada?
7. **Sede 33**: los críticos pesan 20, así que fallarlos cuesta lo mismo que
   un ítem normal. ¿Así está bien?
8. **Listas de codificación** por plantilla (Aurora, HLM, código de gestión de
   SURA, tipificación de Mobilize): ¿las manda?

## Actualización 04/11/2026: con el HTML de Edwin

**Solo plan. No se construye nada sin el OK del usuario.** Se leyó
`Calidad InConexion.html` (fuera del repo, en Descargas) solo como guía: no se
copió al repo ni se pasó ningún texto de sus ítems ni ningún dato. El HTML no
trae datos embebidos (guarda todo en el navegador con `localStorage`).

**Regla nueva del usuario**: no se suben plantillas en Excel. Toda la calidad
se hace desde la página: el administrador arma y edita las plantillas en
pantalla, calidad califica en pantalla y los resultados se ven en pantalla.
Qué pasa con la carga masiva de monitoreos por Excel que ya existe (Fases 130
y 239) es la pregunta 7 de la sección E; mientras tanto no se toca.

### A. Qué trae el HTML

| Pieza | En el HTML |
|---|---|
| Roles | **Administrador** (todo + Usuarios), **Calidad** (Calificar; solo ve los monitoreos que ella califica; Detalle por mes, Diccionario y Resumen), **Supervisor** (Resultados del equipo de sus plantillas) y **Asesor** (Mis resultados) |
| Acceso por plantilla | Cada usuario tiene una lista de plantillas; el administrador las ve todas |
| Plantillas | 6: Televentas SURA, Clínica Orlant, Clínica Aurora, Hospital La María · Sede 33, Hospital La María · Sede Castilla y Mobilize |
| Cálculo "ponderado" (ORLANT, Aurora, HLM, Mobilize) | Parte de 100. NO en un crítico resta 20; NO en un no crítico resta su peso; SI y N/A no restan. Los pesos suman 100. 1 crítico fallado = Alerta; 2 o más = Crítico absoluto |
| Cálculo "por descuento" (SURA) | Cualquier NO en un crítico deja la nota en 0 %. Los no críticos descuentan su porcentaje, y algunos tienen opciones con descuento parcial (por ejemplo, solo falta la despedida) |
| Clasificación | < 70 Crítico, < 90 No crítico, ≥ 90 Sobresaliente (igual que la plataforma) |
| Monitoreo incompleto | No se guarda hasta calificar todos los ítems ("Faltan ítems por calificar") |
| Campos del formulario | Comunes: asesor, ID de agente, fecha, ID de llamada, código de gestión, evaluador, motivo (se arma solo con los ítems fallados), observaciones. ORLANT, Aurora y HLM: + teléfono. Mobilize: + placa y tipo de llamada. SURA: + cédula del cliente, ID de contacto, tipificación del sistema, estrategia y causa |
| Calidad | "Sugerir observación", Detalle por mes, Resumen por asesor, Importar/Exportar Excel |
| Supervisor (resultado) | Indicadores, calificación por asesor y por mes, torta por clasificación, ítems más afectados, asesores con cada falla, Detalle por mes y Resumen por asesor (con clic al detalle) |
| Asesor | Su calificación por mes, sus monitoreos por clasificación, ítems a reforzar en el mes, la lista de sus monitoreos y el detalle de cada uno |
| Diccionario | Por plantilla: cada ítem con su número, nombre, si es crítico, su peso y su descripción (SURA además con viñetas) |

### B. Comparación con la plataforma (después de las Fases 236 y 237)

| Pieza | Plataforma hoy | Qué falta |
|---|---|---|
| Login y usuarios | Ya existe (el login del HTML era solo de muestra) | Nada |
| Roles | CALIDAD, ASESOR, SUPERVISOR, GERENCIA, CLIENTES_DASH, ADMIN | "Resultado" = permiso `ver_calidad` sobre los roles que ya ven el dashboard (sección 2). No hace falta un rol nuevo |
| Varias plantillas por cliente | Ya existe la base (Fase 237: `nombre`, `principal`, `monitoreos.plantillaId`) | Crear las plantillas reales y una pantalla para hacerlo |
| Acceso por plantilla | Ya existe (Fase 237: `plantilla_<id>`, sin ninguna marcada = todas las de sus campañas) | Nada |
| Aviso al asesor | Ya existe (Fase 236: cada 3 min; pestaña Calidad cada 5 min) | Nada |
| Cálculo ORLANT, Aurora, HLM, Mobilize | El motor `standard` da **el mismo número** que el "ponderado" del HTML cuando los pesos suman 100 (NO en crítico = peso − 20, es decir −20 sobre 100) | Exigir todos los ítems antes de guardar (hoy calcula con los que haya) |
| Pesos de ORLANT | Los 17 pesos y los 7 críticos son **idénticos** a los del HTML | Solo el texto del diccionario |
| Cálculo de SURA | El motor `sura` actual (solo SI suma; los críticos solo se cuentan) **no es** el del HTML | Motor nuevo `descuento`, con su prueba, sin tocar los dos que existen |
| Plantilla de Mobilize | Genérica de 10 ítems | La del HTML tiene 14 ítems y 5 críticos |
| Aurora y HLM | Sin plantilla; pestaña Calidad oculta | Aurora 12 ítems (5 críticos); HLM Sede 33 7 ítems (3 críticos) y Castilla 12 (5 críticos) |
| SURA | Sin el módulo `calidad` en el registro; su tablero es Televentas | Agregar el módulo sin crear un tablero genérico, y el botón Calidad en Televentas |
| Campos por plantilla | Fijos: asesor, fecha, canal, ID de llamada, teléfono, codificación, evaluador, observaciones | ID de agente, placa, tipo de llamada, ID de contacto, tipificación del sistema, estrategia, causa y motivo. **Cédula del cliente**: dato personal, ver pregunta 3 |
| Diccionario | Solo una hoja del Excel de carga masiva | Descripción por ítem y una pantalla de diccionario |
| Resumen por asesor | Barras de promedio por asesor (ORLANT); Mobilize desde Excel (Fase 172) | Tabla por asesor desde los monitoreos: # monitoreos, promedio, clasificación, alerta y total de fallos críticos; clic → sus monitoreos → detalle |
| "Interactivo" (supervisor) | No existe | Ítems más afectados, asesores con cada falla, Detalle por mes |
| Vista del asesor | "Mis Resultados" (lista y detalle) | Calificación por mes, torta por clasificación e ítems a reforzar |
| Calidad solo ve lo que califica | Hoy CALIDAD ve los monitoreos de sus campañas | Confirmar (pregunta 4) |

### C. Formulario por cliente

Todas las plantillas se crean **en pantalla** (Admin › Calidad › Plantillas,
PR C3). Nada se siembra con los textos del HTML desde el repo: el repo es
público y esos textos son de Edwin. Lo que sí define el código es la forma
(campos, motor) que cada plantilla puede usar.

| Cliente | Plantilla(s) | Motor | Ítems / críticos | Campos extra |
|---|---|---|---|---|
| ORLANT | Clínica Orlant (ya existe, principal) | `standard` | 17 / 7 (iguales) | — (agregar descripciones) |
| SURA | Televentas SURA | `descuento` (nuevo) | 9 / 4, con opciones de descuento parcial | ID de agente, ID de contacto, tipificación del sistema, estrategia, causa (+ cédula según la pregunta 3) |
| Mobilize | Mobilize (reemplaza a la genérica como principal) | `standard` | 14 / 5 | ID de agente, placa, tipo de llamada |
| Clínica Aurora | Clínica Aurora | `standard` | 12 / 5 | ID de agente |
| Hospital La María | **Sede Castilla** primero (o Sede 33, la que Edwin confirme) | `standard` | Castilla 12 / 5; Sede 33 7 / 3 | ID de agente |

HLM: el HTML trae las dos sedes con ítems distintos, así que no son "la misma
plantilla". Se arma **solo una** (la que Edwin confirme como vigente) y la otra
queda para después; con la Fase 237 una segunda plantilla del mismo cliente ya
cabe sin cambios de base.

### D. Plan por PRs (reemplaza la tabla de la sección 8)

Ya hechos: 1 (Fase 234), 2 (Fase 236), 3 y 4 (Fase 237). Lo que sigue, en
este orden, un PR por fila, cada uno con su versión, CHANGELOG, pruebas con
datos sintéticos y verificación en producción en solo lectura:

| # | PR | Qué hace | Tamaño | Depende de |
|---|---|---|---|---|
| C1 | Motor `descuento` (SURA) | `computeScore` con el motor nuevo: crítico en NO → 0; no críticos con descuento total o parcial por opción. Prueba con casos sintéticos. No cambia `standard` ni `sura` | S | Nada |
| C2 | Campos por plantilla y monitoreo completo | Columna `extras` (JSON) en `monitoreos` con los campos que defina la plantilla (lista cerrada de campos permitidos); el servidor rechaza un monitoreo con ítems sin calificar. Migración no destructiva | M | Pregunta 3 (cédula) |
| C3 | Editor de plantillas en pantalla (solo ADMIN) | Crear, editar, desactivar y marcar principal: nombre, cliente, motor, campos, ítems (categoría, nombre, peso, crítico, N/A, descripción, opciones). Valida que los pesos sumen 100 en `standard`. Una plantilla con monitoreos no cambia sus ítems: se crea una versión nueva para no recalcular los viejos | M | C1, C2 |
| C4 | Calidad en SURA, Aurora y HLM | Módulo `calidad` en SURA (sin tablero genérico) y destapar Calidad en Aurora y HLM cuando haya plantilla; migración idempotente | S | C3 |
| C5 | Diccionario | Botón "Diccionario" en el formulario, en Mis Resultados y en la pestaña Calidad; sale de la plantilla | S | C3 |
| C6 | Resumen por asesor | Tabla por asesor (filtros Mes y Asesor) con clic a sus monitoreos y al detalle; para calidad y para quien vea la pestaña Calidad | M | C3 |
| C7 | Resultados del equipo ("interactivo") | Ítems más afectados, asesores con cada falla, calificación por mes y Detalle por mes | M | C6 |
| C8 | Permiso `ver_calidad` (resultado) | Casilla en el formulario de usuario, apagada por defecto; la pestaña Calidad del cliente solo con ese permiso (el administrador siempre). Respeta `asesorVisibleCliente` | S | C6 |
| C9 | Botón Calidad en cada dashboard | Un botón "Calidad" en el encabezado de ORLANT, Mobilize, Aurora, HLM y Televentas de SURA que abre la pestaña Calidad del cliente (o la vista de resultados en SURA), solo con `ver_calidad` | S | C8 |
| C10 | Vista del asesor | Mis Resultados con calificación por mes, torta por clasificación e ítems a reforzar | S | C6 |

Después de C3, el administrador (o Edwin con su usuario) crea en pantalla las
plantillas de SURA, Mobilize, Aurora y la de HLM, en producción, como un
usuario real. Eso es una escritura en producción: se hace solo con tu
autorización explícita en esa fase.

### E. Preguntas abiertas para decidir antes de construir

1. **Orden**: ¿empezamos por C1–C3 (motor, campos, editor) o prefieres ver
   primero el resumen por asesor (C6) con la plantilla de ORLANT que ya
   existe?
2. **HLM**: ¿cuál va primero, Sede Castilla o Sede 33?
3. **Cédula del cliente en SURA**: es un dato personal. ¿Se pide, se pide
   enmascarada (últimos 4 dígitos) o se deja por fuera? Lo mismo con el
   teléfono (pendiente abierto desde la Fase 151).
4. **Calidad solo ve lo que ella califica** (como el HTML) o todo lo de sus
   campañas (como hoy). Cambiarlo restringe a usuarios que ya trabajan.
5. **Quién crea las plantillas en pantalla**: solo el administrador, o
   también un usuario de calidad con un permiso nuevo.
6. **Mobilize**: ¿la plantilla de 14 ítems del HTML es la de Kelly? Si sí, los
   monitoreos viejos siguen con la genérica y los nuevos con la de 14.
7. **Carga masiva de monitoreos por Excel** (Calidad › Importar, y la
   exportación): ¿se deja como respaldo, o se retira para que todo pase por
   la página? Retirarla no borra datos.


## Lo que pidió Edwin (04/11)

- **Roles**:
  - **CALIDAD** escoge una plantilla, monitorea a un asesor y guarda. Ve el
    resumen por asesor y el diccionario.
  - **ASESOR** solo ve sus resultados y el diccionario, en su propia pantalla.
  - **RESULTADO** ve el resumen por asesor, el diccionario y el interactivo,
    dentro del dashboard de cada cliente, en una pestaña "Calidad" (por
    ejemplo ORLANT › Calidad).
- **Acceso por plantilla**: al crear un usuario de calidad, el administrador
  elige a qué plantillas tiene acceso (una, varias o todas). Cada plantilla es
  diferente.
- **Plantillas**: ya están listas las de SURA, Aurora, Hospital La María y
  ORLANT. Falta la de Mobilize, que la manda Kelly.
- **Tiempo real**: cuando calidad guarda un monitoreo, el asesor recibe un
  aviso y se actualiza el reporte de Calidad.
- **Todos los asesores**: van a entrar todos, así que la lista de usuarios de
  Admin debe poder filtrarse o agruparse por campaña y por rol.
- **Login**: se usan los usuarios y el login de la plataforma; el login del
  prototipo de Edwin era solo para explicar.

## 1. Tabla de brecha

Qué cambió desde la Fase 94:
- la Fase 95 bloqueó la fecha y el evaluador, agregó la lista de
  codificaciones y el aviso al asesor;
- la Fase 134 dejó solo las plantillas de ORLANT y Mobilize;
- la Fase 153 hizo que la lista de campañas de Calidad salga del registro de
  clientes;
- la Fase 172 agregó el Resumen de calidad por asesor de Mobilize, cargado
  desde Excel;
- la Fase 222 hizo que las casillas de un usuario nuevo nazcan sin marcar.

| Pieza del pedido | Estado | Dónde (archivo:línea) |
|---|---|---|
| Login y usuarios de la plataforma | **Ya existe** | `server/auth.js`, `server/routes/usuarios.js` |
| Rol CALIDAD crea monitoreos de una campaña con permiso | **Ya existe** | `canEvaluateCampaign`, `server/auth.js:201-205`; `POST /monitoreos`, `server/routes/calidad.js:314` |
| Calidad "escoge una plantilla" | **Existe distinto** | Hoy hay **una plantilla por campaña**: `calidad_plantillas.campana` es `UNIQUE` (`server/db.js:98-105`). Se escoge la campaña y la plantilla viene sola. No hay varias plantillas en un mismo cliente |
| Plantillas de SURA, Aurora, HLM y ORLANT | **Existe distinto** | Solo hay ORLANT (17 ítems) y una genérica para Mobilize (`server/calidad-plantillas-seed.js:61-64`). Las de Aurora y SURA se quitaron en la Fase 134. HLM nunca tuvo plantilla. Falta cargar las 4 de Edwin |
| Motor de puntaje | **Ya existe** (2 motores) | `computeScore`, `server/calidad-logic.js:18-57`. `standard`: crítico en NO resta 20 y N/A suma el peso. `sura`: solo SI suma y los críticos solo cuentan fallos |
| "No aplica" | **Ya existe** | `N/A` en los dos motores (mismo archivo) |
| Fecha del día y evaluador fijos | **Ya existe** (Fase 95) | `public/index.html:1024` y `:1037` (`disabled`); `public/js/calidad.js:424-427` |
| Codificación en lista | **Ya existe** (Fase 95) | Tabla `calidad_codificaciones`, `server/db.js:114-127`. Si una campaña no tiene lista, la codificación sigue en texto libre |
| Diccionario | **Existe distinto** | Solo como hoja "Diccionario" del Excel de carga masiva (`public/js/calidad-carga-masiva.js:4`, `:38`). No hay una pantalla de diccionario para el asesor ni para el cliente |
| ASESOR ve solo sus resultados | **Ya existe** | `GET /monitoreos/mios`, `server/routes/calidad.js:231-246` (por `asesorUserId`, o por nombre y campaña en los viejos); pantalla "Mis Resultados", `public/js/mis-resultados.js` |
| Aviso al asesor | **Ya existe al iniciar sesión** (Fase 95) | Banner "Tienes N monitoreos nuevos" y contador en el menú (`public/js/mis-resultados.js:55-86`, se llama en `public/js/session.js:178`); `GET /monitoreos/mios/nuevos` y `PUT /monitoreos/:id/visto`, `server/routes/calidad.js:253-290`. **Falta** que llegue mientras la sesión ya está abierta |
| Reporte de Calidad "se actualiza" | **Existe distinto** | Se actualiza al abrir o recargar la pestaña. No se refresca solo |
| Pestaña Calidad en el dashboard del cliente | **Ya existe** (parcial) | ORLANT: `calidad_kpis`, `calidad_pie` y `calidad_bar_asesores` (`server/dashboard-config-seed.js:243-247`, dibujo en `_gdRenderCalidad`, `public/js/dashboard-generic.js:2038`). Mobilize: `calidad_resumen_panel` (Fase 172, desde Excel, no desde monitoreos) |
| Resumen por asesor (tabla) e "interactivo" | **Existe distinto** | Barras de promedio por asesor (`calidad_bar_asesores`). No hay tabla ítem por ítem ni filtros como los del prototipo (pendiente de verlo) |
| Acceso por plantilla al crear el usuario | **Falta** | Hoy el acceso es por campaña (`campana_<CLIENTE>`), `buildCampaignCheckboxes`, `public/js/users.js:202` |
| Lista de usuarios por campaña y rol | **Falta** | `renderUsers`, `public/js/users.js:7-14`: un solo buscador de texto (nombre, usuario o rol); no hay filtro por campaña ni agrupación |
| Campañas con Calidad | **Ya existe** | Salen del registro de clientes (módulo `calidad`), `server/clientes-registro.js:153-155` |

## 2. Roles

- **CALIDAD y ASESOR se reutilizan** tal cual: ya tienen pantallas, permisos y
  pruebas.
- **RESULTADO**: recomiendo **no crear un rol nuevo**. Es un **permiso de ver
  la pestaña Calidad** sobre los roles que ya ven el dashboard del cliente
  (CLIENTES_DASH, SUPERVISOR y GERENCIA).
  - **Por qué**: la pestaña Calidad vive dentro del dashboard del cliente, y
    quien entra ahí ya tiene `cliente_<CLIENTE>`. Un rol nuevo obligaría a
    repetir el acceso al dashboard, el menú y las pruebas de permisos.
  - **Cómo**: la pestaña Calidad se muestra solo si el usuario tiene el permiso
    `ver_calidad` (una casilla nueva en el formulario, apagada por defecto). El
    administrador la ve siempre.
  - **Riesgo a cuidar**: los datos personales. Hoy el cliente ve nombres de
    asesor solo donde `asesorVisibleCliente` lo permite
    (`server/clientes-registro.js:160`). Hay que mantener esa misma regla.

## 3. Permiso por plantilla

- **Cómo guardarlo**: recomiendo permisos `plantilla_<id>` en el mismo JSON de
  `perms` de cada usuario, igual que `campana_<CLIENTE>` y `cargar_<modulo>`.
  - Así se reutilizan el formulario, `accesosSinEscalar` (Fase 222) y el
    historial de cambios.
  - Una tabla aparte solo valdría la pena si las plantillas se crearan y
    borraran muy seguido, y no es el caso.
- **Regla en el servidor**: un usuario CALIDAD puede monitorear con una
  plantilla solo si tiene `campana_<CLIENTE>` y `plantilla_<id>`. Las dos se
  revisan en `POST /monitoreos`, nunca solo en el navegador.
- **En el formulario de usuario**: con el rol CALIDAD aparece, debajo de las
  campañas, el grupo "Plantillas", agrupado por cliente. El grupo tiene un
  botón "Todas las de este cliente" y casillas **sin marcar por defecto**.
  - Se repiten las reglas de la Fase 222 (bug H1): no se guarda sin al menos
    una plantilla, y nadie da una plantilla que él mismo no tiene.
- **Usuarios de calidad que ya existen**: hay que decidir si la migración les
  da todas las plantillas de sus campañas (para no cortarles el trabajo) o
  ninguna. **Se le pregunta al usuario antes de construir.**

## 4. Plantillas

- **Lo que hay que cambiar en la base**: permitir varias plantillas por
  cliente. Se quita el `UNIQUE(campana)` y se agregan `id` estable, `nombre` y
  `cliente`.
  - Los monitoreos deben guardar con qué plantilla se hicieron
    (`plantillaId`), porque si no, cambiar una plantilla recalcula mal los
    monitoreos viejos.
  - La migración es idempotente y no destructiva: las plantillas de ORLANT y
    Mobilize siguen con el mismo id lógico, y los monitoreos viejos quedan
    con esa plantilla.
- **Lo que hace falta de cada plantilla de Edwin**: ítems con su categoría,
  peso, si es crítico, si admite "No aplica", y el texto del diccionario de
  cada ítem.
  - El diccionario es nuevo: hoy cada ítem tiene solo `label`, así que hay que
    agregar `descripcion`.
- **Si el motor actual sirve**:

  | Plantilla | Motor probable | Qué falta confirmar |
  |---|---|---|
  | ORLANT | `standard` (ya está) | Si cambió la plantilla de 17 ítems (pregunta 2 de la Fase 94, sigue abierta) |
  | SURA | `sura` (ya existe, sin uso desde la Fase 134) | Que la fórmula del prototipo sea esa: solo SI suma y los críticos solo cuentan |
  | Aurora | ¿`standard`? | Pesos, críticos y si el crítico resta 20 |
  | Hospital La María | ¿`standard`? | Lo mismo; y si va por sede |
  | Mobilize | — | La plantilla la manda Kelly; hoy usa una genérica |

  Si alguna plantilla del prototipo usa otra fórmula (por ejemplo, un crítico
  en NO deja la nota en 0, o se pondera por categoría), se agrega un motor
  nuevo en `computeScore` con su prueba, sin tocar los dos que ya existen.
- **Cómo se cargan**: con una migración por plantilla, a partir de un archivo
  de ítems que Edwin entrega sin datos de personas. No se cargan escribiendo
  a mano en la base de producción.

## 5. Pestaña Calidad en el dashboard del cliente

- **Lo que hay hoy en ORLANT**:
  - tarjetas de resumen (`calidad_kpis`);
  - torta de clasificación (`calidad_pie`);
  - barras de promedio por asesor (`calidad_bar_asesores`).

  Todo sale de los monitoreos (`CAL_DB`) y se filtra por MESES.
- **Lo que hay hoy en Mobilize**: el Resumen de calidad por asesor, cargado
  desde Excel (`calidad_resumen_panel`, Fase 172), más tarjetas y torta.
- **Lo que falta para el prototipo**:
  - **Resumen por asesor en tabla**: asesor, cantidad de monitoreos, nota
    promedio, fallos críticos y, quizá, el % por categoría. Sale de los mismos
    monitoreos, sin datos nuevos.
  - **Diccionario**: la lista de ítems de la plantilla con su descripción,
    peso y si es crítico. Es de solo lectura y sale de la plantilla.
  - **"Interactivo"**: hay que verlo en el prototipo. Podría ser hacer clic en
    un asesor y ver el detalle ítem por ítem (como en "Mis Resultados"), o
    filtros por plantilla, evaluador o canal.
  - **Filtro por plantilla**, si un cliente tiene más de una.

## 6. Aviso al asesor y "tiempo real"

El aviso al iniciar sesión ya existe (Fase 95). Lo que falta es que llegue
**mientras la sesión ya está abierta**, y que el reporte del cliente se
refresque solo. No hay precedente de conexión abierta (WebSocket o
EventSource) en la plataforma.

| Opción | Cómo funciona | Costo | Riesgo |
|---|---|---|---|
| A. Aviso al iniciar sesión (hoy) | Banner y contador al entrar | Ya está | No llega si la sesión sigue abierta todo el día |
| B. Consultar cada pocos minutos (**recomendada**) | El portal del asesor pide `GET /monitoreos/mios/nuevos` cada 2–5 minutos, solo con la pestaña visible; el dashboard de Calidad vuelve a pedir sus datos cada 5 minutos o al volver a la pestaña | Chico: 1 PR, sin infraestructura nueva | Bajo: una consulta liviana con índice; respeta el límite de tasa |
| C. Refrescar al abrir | Al entrar a "Mis Resultados" o a la pestaña Calidad se piden datos frescos | Muy chico | No avisa si el asesor no abre nada |
| D. Conexión abierta (SSE) | El servidor empuja el aviso al guardar | Grande: conexiones abiertas en Caddy y Node, reconexión, pruebas nuevas, una sola instancia | Medio: es infraestructura nueva para una ganancia de segundos |

**Recomendación**: B más C. Para "tiempo real" en un contact center, un
aviso que llega en menos de 5 minutos alcanza, y no agrega piezas nuevas en
producción. La caché por usuario (Fase 161) ya se limpia cuando cambian los
datos (`datos_version`); hay que confirmar que guardar un monitoreo la limpie.

## 7. Lista de usuarios por campaña y rol en Admin

- **Filtros arriba de la tabla**: "Rol" (desplegable) y "Campaña" (desplegable
  con las campañas de Calidad y los clientes), además del buscador de texto
  que ya existe.
- **Agrupar por campaña**: un interruptor que pinta un encabezado por campaña.
  Un asesor sale bajo su `asesorCampana`; un usuario de calidad, bajo cada
  campaña que tiene.
- **Contador**: "N usuarios" según el filtro.
- **Tamaño**: con todos los asesores pueden ser cientos de filas. Se filtra
  en el navegador (la lista ya llega completa). Si pasa de unas 500 filas, se
  agrega paginación.
- **Carga masiva de asesores**: si van a entrar todos, crear uno por uno no
  escala. Conviene una carga desde Excel (nombre, usuario, campaña) con
  contraseña temporal y cambio obligatorio al primer ingreso. Es un tema
  aparte, con su propio PR y revisión de seguridad.

## 8. Plan por fases (reemplazado por la sección D de la actualización)

PRs pequeños, en este orden. Ninguno se empieza sin el OK del usuario, y los
que dependen de Edwin esperan sus respuestas.

| # | PR | Qué hace | Tamaño | Depende de |
|---|---|---|---|---|
| 1 | Usuarios por campaña y rol | Filtros, agrupar y contador en Admin › Usuarios (sección 7) | S | Nada: se puede hacer ya |
| 2 | Aviso cada pocos minutos | Opción B y C de la sección 6 | S | Nada |
| 3 | Varias plantillas por cliente | Migración de `calidad_plantillas` (id, nombre, cliente, descripción por ítem) y `monitoreos.plantillaId`; ORLANT y Mobilize igual | M | Nada (no cambia nada visible) |
| 4 | Permiso por plantilla | `plantilla_<id>` en el formulario, sin marcar por defecto, validado en el servidor | M | 3 y la decisión sobre los usuarios que ya existen |
| 5 | Selector de plantilla en "Nuevo monitoreo" | CALIDAD elige entre sus plantillas | S | 4 |
| 6 | Cargar plantillas de Edwin | Una migración por plantilla (SURA, Aurora, HLM, ORLANT actualizada) | S cada una | Archivos de ítems de Edwin y confirmar el motor de cada una |
| 7 | Diccionario | Pantalla de diccionario para el asesor y en la pestaña Calidad | S | 3 y 6 |
| 8 | Resumen por asesor en la pestaña Calidad | Tabla por asesor y detalle al hacer clic | M | Ver el prototipo |
| 9 | Permiso `ver_calidad` (RESULTADO) | Casilla en el formulario; la pestaña Calidad se muestra solo con ese permiso | S | 8 |
| 10 | Plantilla de Mobilize | Igual que el 6 | S | Kelly |
| 11 | Carga masiva de asesores (opcional) | Excel → usuarios ASESOR con contraseña temporal | M | OK aparte y revisión de seguridad |

Tamaños: S = menos de un día; M = 1 o 2 días, con pruebas y verificación.

## Preguntas para Edwin

1. ~~¿Puedes mandar el HTML de prueba?~~ **Resuelta** (04/11): llegó y se
   revisó fuera del repo.
2. ¿Cada cliente tiene **una** plantilla o puede tener **varias**? Por
   ejemplo, ¿ORLANT llamadas y ORLANT WhatsApp son plantillas distintas?
3. ~~Críticos, "No" en crítico y "No aplica" por plantilla~~ **Resuelta**
   (Excel, 04/11): ponderadas, crítico en NO = −20 y N/A en todos los ítems;
   SURA, crítico en NO = nota 0 y sin N/A (secciones F y H).
4. ~~¿Cómo es el diccionario?~~ **Resuelta** (Excel, 04/11): un texto por
   ítem con su categoría; SURA trae además opciones e impacto en la nota.
5. ¿Qué es exactamente el "interactivo" de la vista de resultados?
6. ¿Quién debe ver la pestaña Calidad del cliente: el cliente (por ejemplo
   Jairo), solo gerencia o los dos? ¿Ve los nombres de los asesores?
7. "Tiempo real": ¿le sirve que el aviso llegue en unos minutos, o necesita
   que salga en el mismo segundo?
8. ¿Los usuarios de calidad que ya existen deben quedar con **todas** las
   plantillas de sus campañas o empezar sin ninguna?
9. ¿Van a entrar todos los asesores? ¿Cuántos son, más o menos? ¿Hay una lista
   en Excel para crearlos de una vez?
10. ~~¿Misma plantilla para Sede 33 y Castilla?~~ **Resuelta** (Excel, 04/11):
    son distintas (7 y 12 ítems).
11. De la Fase 94: la 1 (fórmula) y la 2 (pesos de ORLANT) quedan **resueltas**
    con los Excel (04/11: misma fórmula que `standard`, mismos pesos). Siguen
    abiertas la 3, la 6 y la 9 (si el asesor acepta el monitoreo, si la fecha
    puede ser de un día anterior y el límite por asesor).
