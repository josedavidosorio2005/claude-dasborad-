# ORLANT · Tablero nuevo — Ficha de fórmulas por indicador (C2) — BORRADOR

> Borrador del 24/11/2026 para revisar con Edwin (plan de acción del 20/11, C2). Anexo para Teleacción
> cuando Edwin lo apruebe. **Sin datos reales.**
>
> Fuentes: el código del tablero nuevo (`server/orlant-tablero.js`, N1 en producción oculto y N2 en el PR #941),
> `plan.md` de esta carpeta, el plan de acción del 20/11 y la «PROPUESTA FORMULAS INCONEX_ORLANT»
> (121 indicadores por canal; vive fuera del repo).
>
> **Estado:**
> - **Implementado** = ya lo calcula el tablero nuevo (N1/N2).
> - **Con datos nuevos** = se puede hacer, pero falta una fuente o un reporte de Wolkvox.
> - **Pendiente de Edwin** = falta una definición.
> - **En pausa** = no hay de dónde sacar el dato todavía.
>
> **«¿Edwin?»** marca lo que no está claro y hay que confirmar.

## Reglas comunes

- **Filtros del tablero:** rango de fechas (desde/hasta), granularidad (día, semana de lunes a domingo o mes),
  línea (Total, Línea General, 3P) y canal (Llamadas, WhatsApp, Citas).
- **Línea de una llamada de entrada:** sale del «Mapa de skills» (Administración). Un skill sin guardar queda
  «Sin definir» y no entra ni en General ni en 3P; un skill «No cuenta» no entra en nada.
  **Pendiente de Edwin:** confirmar el mapa (General / 3P / No cuenta) de cada skill de ORLANT.
- **Promedios de tiempo (TMO, ASA):** ponderados por las llamadas contestadas de cada fila (día × skill),
  nunca el promedio simple de los días.
- **Porcentajes:** con los totales del período (suma de numeradores / suma de denominadores), nunca el
  promedio de porcentajes diarios.
- **Variación contra el período anterior:** en % para cantidades y en puntos para porcentajes (NS, atención,
  abandono).

## 1. Llamadas de entrada (C3)

Fuente: **Flujo de llamadas** (archivo de «Tráfico de Llamadas» o Wolkvox `skill_1`, un día por consulta) →
tabla `calidad_nivel_servicio_diario` (una fila por día y skill). Tipificación: **CDR** (archivo o `cdr_1`) →
`tipificaciones`, canal Llamadas. Periodicidad: diaria (se ve por día, semana o mes).

| Indicador | Fórmula en el tablero | Fuente | Estado | Nota |
|---|---|---|---|---|
| Llamadas recibidas | Σ llamadas ingresadas (TOTAL_LLAMADAS / `inbound_calls`) | Flujo | Implementado | Propuesta: «conteo de llamadas ofrecidas a la cola». |
| Llamadas contestadas | Σ contestadas | Flujo | Implementado (Ver más) | |
| Llamadas abandonadas | Σ abandonadas del archivo; si la fila no las trae, recibidas − contestadas | Flujo | Implementado | Misma regla que la pestaña «Tráfico de Llamadas». |
| NS 20 s (TSF) | Σ (NS 20 s del día × recibidas) / Σ recibidas de las filas con NS × 100 | Flujo | Implementado | **¿Edwin?** La propuesta dice «elegibles para TSF»: ¿se descuentan los abandonos cortos? Wolkvox entrega el % ya calculado; los días sin NS no entran (no se inventan). |
| Nivel de atención | contestadas / recibidas × 100 | Flujo | Implementado | |
| Abandono | abandonadas / recibidas × 100 | Flujo | Implementado | |
| TMO / AHT | Σ (AHT × contestadas) / Σ contestadas | Flujo | Implementado | **¿Edwin?** La propuesta pide Talk + Hold + ACW. El AHT de Wolkvox, ¿incluye el ACW? |
| ASA | Σ (ASA × contestadas) / Σ contestadas | Flujo | Implementado (Ver más) | |
| Participación por skill | recibidas del skill / recibidas totales × 100 | Flujo | Implementado | |
| Tendencia y comparativo | Serie por período + variación contra el anterior | Flujo | Implementado | Primera gráfica: contestadas + abandonadas y línea de NS 20 s. |
| Motivos de llamada (tipificación) | llamadas con la tipificación / llamadas de entrada con tipificación × 100; las 15 primeras y «Otras» | CDR | Implementado | Excluye la salida (skill «-»). **¿Edwin?** ¿«Sin tipificación» cuenta en el denominador? Hoy sí cuenta. |
| Por línea (General / 3P) | Lo mismo, filtrado por el Mapa de skills | Flujo + mapa | **Pendiente de Edwin** | Falta confirmar el mapa. |
| Talk, Hold y ACW promedio | Σ tiempo / atendidas | Wolkvox `agent_1` | Con datos nuevos | Reportes de agente (`agent_*`): requieren autorización nueva por escrito. |
| Ocupación | (Talk + Hold + ACW) / (… + disponible) × 100 | Wolkvox `agent_1` | Con datos nuevos | Pestaña Asesores (E2). |
| Número de asesores | asesores únicos con actividad | CDR o `agent_1` | Con datos nuevos | **¿Edwin?** ¿Desde el CDR (quien contestó) o desde el login? |
| Calidad promedio | puntos obtenidos / puntos posibles × 100 | Módulo Calidad | Con datos nuevos (D2) | Depende de los 3 formatos nuevos (D1). |

## 2. WhatsApp de entrada (C4)

Fuente: **Tráfico de WhatsApp** (archivo por cola y período) → `trafico_whatsapp`. Tiempos: archivo de tiempos
(Fase 142) → `whatsapp_tiempos`. Por API: `chat_1`/`chat_13`, en prueba (rechazan las fechas). Periodicidad: la del
archivo (un día o un mes por fila). Una fila entra al rango solo si cae completa dentro de él.

| Indicador | Fórmula en el tablero | Fuente | Estado | Nota |
|---|---|---|---|---|
| Conversaciones recibidas | Σ total WhatsApp | Tráfico WhatsApp | Implementado | Propuesta: «conversaciones únicas». **¿Edwin?** ¿El archivo ya viene sin repetidas? |
| Atendidas de 0 a 3 / de 3 a 5 / más de 5 min | conteo de conversaciones por segundos hasta contestar (≤180, 181–300, >300) | Tiempos | Implementado | **¿Edwin?** ¿Es la «primera respuesta humana» de la propuesta? |
| Abandono | abandonados / recibidos × 100 (solo si el archivo trae abandonados; nunca recibidos − contestados) | Tráfico WhatsApp | Implementado | |
| Nivel de atención | contestados / recibidos × 100 | Tráfico WhatsApp | Implementado | |
| ASA | Σ (ASA × contestados) / Σ contestados | Tráfico WhatsApp | Implementado | |
| Meta de nivel de servicio | % atendidas en el tiempo meta | Tiempos | **Pendiente** | La meta la define Jairo con ORLANT. |
| TMO / AHT, ACW | tiempo de gestión + ACW / atendidas | `chat_1` | Con datos nuevos | Espera las pruebas de la API. |
| Chats simultáneos, ocupación, asesores | — | `chat_*` / `agent_*` | Con datos nuevos | |
| Por línea (General / 3P) | por cola | Mapa de colas | **Pendiente de Edwin** | Falta el mapa de colas (N3). |

## 3. Citas (C5 y B1/B2)

Fuente: **Agendas** (archivo de citas, una fila por cita, con línea General / 3P) → `agendas`, por fecha de
solicitud. Periodicidad: diaria.

| Indicador | Fórmula | Fuente | Estado | Nota |
|---|---|---|---|---|
| Citas agendadas | conteo de citas por fecha de solicitud, por línea | Agendas | Implementado | |
| Tasa de agenda / efectividad de agendamiento | citas agendadas / interacciones atendidas × 100 | Agendas + Flujo (+ WhatsApp, + salida) | PR #902 (dashboard actual) | **¿Edwin?** La propuesta divide por llamadas atendidas de cada canal; B1 divide por todas las interacciones (entrada + salida, llamadas + WhatsApp). ¿Cuál va en el tablero nuevo? |
| Citas asistidas, inasistencia (general, por sede, entidad, especialidad, confirmadas, no confirmadas) | no asistidas / programadas con fecha cumplida × 100 | Archivo de asistencia | **Pendiente de Edwin** | Qué base usar para el corte mensual (B2). |
| Citas por canal | — | — | **Pendiente de Edwin** | Definición del canal (N4). |
| Cupos liberados y reasignados | — | Servinte / STA | En pausa (F1) | |

## 4. Salida (C6)

Fuente: **salida por mes** (archivo de salida o CDR, General / 3P / sin asignar) → `salidaCombinadaPorMes`.
Periodicidad: **mensual** (un mes entra si se cruza con el rango).

| Indicador | Fórmula | Fuente | Estado | Nota |
|---|---|---|---|---|
| Llamadas realizadas | Σ llamadas de salida del mes, por línea | Salida | Implementado | |
| Conversaciones de WhatsApp realizadas | Σ WhatsApp de salida del mes, por línea | Salida | Implementado | |
| Contactabilidad (aló) | contestadas por una persona / realizadas × 100 | CDR + `cdr_5` | **Pendiente de Edwin** | En ORLANT, «no conectada» = NO_CONTESTAN + BUZÓN. **¿Edwin?** ¿Con eso basta? |
| Contacto con titular | — | — | **¿Edwin?** | No hay un campo que lo diga. |
| Intentos por registro | intentos / registros únicos | CDR | Con datos nuevos | Requiere el ID del registro. **¿Edwin?** |
| Separar la salida por skill | — | Wolkvox | **Pendiente de Edwin + Isa** | Hoy la salida sale con «-» o 0. |
| TMO, Talk, ocupación, citas confirmadas | — | `agent_*`, agendas | Con datos nuevos | |

## 5. Lo que queda fuera de la Entrega 1

| Bloque | Indicadores de la propuesta | Estado | Depende de |
|---|---|---|---|
| Autoservicio IVR (9) | Contención, recontacto 24 h, transferencia, uso del menú, mal enrutadas, abandono en IVR, enrutamiento correcto, número de llamadas, volumen informativo | En pausa (F3) | Sistemas (cómo bajar el flujo del IVR); Wolkvox `diagram_1` trae la opción de menú. **¿Edwin?** |
| Back office (17) | Horas en estado BO, tareas recibidas y procesadas, productividad, tiempos de manejo y de ciclo, SLA, backlog, reproceso, resultado, calidad, citas | Pendiente de Edwin (N10, E1) | Qué es una «tarea» y de dónde sale (el STA sirve para una sub-pestaña). |
| Correo (11) y SMS (9) | Envío, entrega, rebote, apertura, clics, conversión, costo | En pausa (F2) | Reportes del proveedor de SMS y del correo. |
| Costos (por canal) | Costo por transacción y por cita | En pausa (F4) | Costos operativos de Jairo. |
| Asesores (E2) | Ocupación, horas logueadas, Talk/Hold/ACW, intervalos de 30 min, asesores por canal | Con datos nuevos | Reportes `agent_*` de ORLANT (autorización nueva). |

## 6. Preguntas para Edwin (resumen)

1. Mapa de skills de ORLANT: qué skill es General, cuál 3P y cuál no cuenta.
2. NS 20 s: ¿el % de Wolkvox alcanza, o hay que descontar abandonos cortos?
3. TMO: ¿el AHT de Wolkvox incluye Hold y ACW?
4. Tipificación: ¿«Sin tipificación» va en el denominador?
5. Tasa de agenda: ¿por canal (propuesta) o sobre todas las interacciones (B1)?
6. WhatsApp: ¿conversaciones únicas? ¿El tiempo de los rangos es la primera respuesta humana? ¿Cuál es la meta?
7. Asistencia con corte mensual: qué base usar.
8. Salida: contactabilidad, contacto con titular e intentos por registro: ¿de dónde salen?
