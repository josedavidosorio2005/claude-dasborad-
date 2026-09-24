# Inventario de bases de ORLANT (Fase 70, 2026-09-24; actualizado Fase 71)

**Actualización Fase 71** (2026-09-24, Edwin): de las 23 métricas de la hoja
`resumen`, las 7 de tráfico (Llamadas/WhatsApp 3P y Línea General + sus 3
niveles de atención) ya NO se le piden a Edwin — se calculan solas todos
los meses desde Trafico de Llamadas/WhatsApp (mismo mecanismo que ya
sincronizaba 4 de esas 7 desde la Fase 39, extendido en esta fase para
cubrir también WhatsApp). La plantilla descargable de ORLANT ya no muestra
esas 7 filas. Ver el detalle completo, y la lista exacta de las 16
métricas que SÍ hay que llenar, en la sección "Para la primera base
recomendada" más abajo.

Contexto: quedan ~1.5 semanas, foco exclusivo en ORLANT. Edwin va a ir
entregando ~15 bases (codificaciones/tipificaciones, agendas, inasistencia,
nivel de servicio...). Este documento existe para saber qué ya está
construido con datos reales, qué está construido pero vacío, y qué no
existe — antes de pedirle nada, para no reconstruir dos veces lo mismo.

Fuentes usadas: código (`server/dashboard-config-seed.js`,
`server/dashboard-secciones.js`, `public/js/cargas.js`, `public/js/cargas-logic.js`),
base de datos LOCAL de desarrollo (`server/data/inconexion.db`), y
`PROGRESS.md` (histórico de fases, especialmente Fase 29 — auditoría general
del 2026-09-17 — y Fase 67 — verificación real de producción del
2026-09-23). **No se disparó ningún workflow de producción para este
inventario** — ya existe uno genérico de solo lectura
(`.github/workflows/diagnostico-dashboard-produccion.yml`, PRs #38-40) que
podría confirmar el estado exacto de producción hoy mismo si hace falta,
pero no da un desglose limpio por sección/cliente/último-período — se
puede disparar bajo pedido. El estado de "sin datos reales" para
resumen/salida/tipificación/sta_categorias está confirmado por un hallazgo
real de la Fase 67 (ver más abajo), no supuesto.

## Cómo está organizado ORLANT hoy

### Pestañas del dashboard (10 en total — 3 visibles, 7 ocultas desde la Fase 40b)

| Pestaña | Visible | Hoja/sección fuente | Qué falta para mostrarse |
|---|---|---|---|
| Calidad | Sí | Hoja `Monitoreos` → tabla `monitoreos` | Nada — tiene datos reales (ver caveat abajo) |
| Trafico de Llamadas | Sí | Hoja `LLAMADAS` → tabla `calidad_nivel_servicio_diario` | Nada — tiene datos reales (agosto 2026) |
| Trafico de WhatsApp | Sí | Hoja `WHATSAPP` → tabla `trafico_whatsapp` | Nada — tiene datos reales (agosto 2026) |
| Flujo Mensual | Oculta | Sección `resumen` (columnas `llamadas_3p`/`wpp_3p`/`llamadas_general`/`wpp_general`) | Datos reales de `resumen`. **Ojo**: esta pestaña muestra prácticamente lo mismo que ya cubren Trafico de Llamadas/WhatsApp (totales por mes), pero desde una carga MANUAL en vez de la automática de Wolkvox — candidata a no revivirse nunca (ver recomendación abajo) |
| Salida | Oculta | Sección `salida` (diaria: `salida_general`/`salida_3p`/`wpp_salida_general`/`wpp_salida_3p`) | Datos reales de `salida` |
| Tipificacion | Oculta | Sección `tipificacion` (`linea`/`tipificacion`/`cantidad`) | Datos reales + el glosario completo de categorías (solo 2 de las categorías reales están documentadas hoy, del PDF de InCo — el resto "pendiente confirmar contra el archivo real cuando se cargue", comentario explícito en el código) |
| Agendamiento | Oculta | Sección `resumen` (`ordmed_*`, `recup_*`, `total_agendas`, `agendas_general`/`agendas_3p`) | Datos reales de `resumen` (mismo archivo que Flujo Mensual/Inasistencia/Efectividad Citas/parte de STA — ver nota) |
| Inasistencia | Oculta | Sección `resumen` (`inasist_audifonos`/`inasist_audiologia`/`inasist_examenes`/`inasist_total`) | Datos reales de `resumen` |
| Gestion STA | Oculta | Sección `sta_categorias` (por servicio/estado/mes) + columnas `sta_*` de `resumen` | Datos reales de las 2 hojas |
| Efectividad Citas | Oculta | Sección `resumen` (`citas_para_mes`/`citas_atendidas`) | Datos reales de `resumen` |

**Insight clave**: Agendamiento, Inasistencia, Efectividad Citas y parte de
STA se alimentan TODAS de la misma hoja `resumen` (22 columnas, un valor
por mes). Un solo archivo de `resumen` lleno desbloquea 4 pestañas de una
vez — es la base más rentable de pedir primero (ver recomendación).

### Hojas del formato de carga de ORLANT — qué alimenta cada una

| Hoja | Alimenta | ¿Tiene datos reales hoy? |
|---|---|---|
| `LLAMADAS` | Trafico de Llamadas | Sí (agosto 2026, 2 skills, 8.061/7.159/902) |
| `WHATSAPP` | Trafico de WhatsApp | Sí (agosto 2026, 5 colas, 7.305/7.109/196) |
| `Monitoreos` | Calidad (KPIs + pie de clasificación) | Sí, pero mezclada con datos de prueba (`Asesor Prueba 01-04`, `Evaluador QA Prueba` — hallazgo de la Fase 29, 2026-09-17, **no resuelto**, no confirmado si sigue así en producción hoy) |
| `resumen` | Flujo Mensual, Agendamiento, Inasistencia, Gestión STA (parcial), Efectividad Citas | **No** — confirmado vacío en producción (Fase 67: al descargar la plantilla real, la hoja trae "los 23 nombres de métrica sin valor") |
| `salida` | Salida | No (mismo hallazgo de Fase 67 — nunca se llenó) |
| `tipificacion` | Tipificacion | No |
| `sta_categorias` | Gestión STA | No |
| `Diccionario` | Nada — hoja de REFERENCIA únicamente (ítems/pesos de Calidad), nunca se parsea | N/A |
| `Resumen por Asesor` | Nada — hoja de referencia/documentación, plantilla vacía, nunca se parsea | N/A |

Dos columnas de `resumen` nunca se usan en ningún panel:
`nivel_atencion_wpp_3p` (se define en el esquema pero ningún gráfico la
lee) y `sta_agendadas` es opcional y solo aparece en un `combo` de STA. No
es urgente, pero vale la pena que Edwin sepa que si llena
`nivel_atencion_wpp_3p` hoy, ese dato no se muestra en ningún lado todavía.

## Tabla de estado por base/tema

| Base/tema | Estado | Dónde vive | Esfuerzo | Qué necesitamos de Edwin |
|---|---|---|---|---|
| Tráfico de Llamadas | **Lista con datos** | Pestaña "Trafico de Llamadas" · hoja `LLAMADAS` · tabla `calidad_nivel_servicio_diario` | — | Seguir cargando meses (ya tiene el flujo funcionando) |
| Tráfico de WhatsApp | **Lista con datos** | Pestaña "Trafico de WhatsApp" · hoja `WHATSAPP` · tabla `trafico_whatsapp` | — | Seguir cargando meses. AHT sigue sin dato (columna existe desde la Fase 68, ver Parte 3) |
| Calidad / Monitoreos | **Lista con datos** (con caveat) | Pestaña "Calidad" · hoja `Monitoreos` · tabla `monitoreos` | Pequeño (limpiar la mezcla con datos de prueba, si aplica) | Confirmar si los asesores/evaluadores de prueba (Fase 29) siguen mezclados en producción, o si ya se limpiaron |
| Tipificación (codificaciones) | **Construida, sin datos reales** | Pestaña oculta "Tipificacion" · hoja `tipificacion` | Pequeño (solo falta el archivo) | Archivo real de un mes + **glosario completo de categorías** (pendiente con InCo — solo 2 de las categorías están documentadas hoy) |
| Agendas | **Construida, sin datos reales** | Pestaña oculta "Agendamiento" (comparte hoja con Ordenamiento médico/Recuperación cancelados) · hoja `resumen` | Pequeño | Archivo `resumen` de un mes (ver base recomendada #1 abajo) |
| Inasistencia | **Construida, sin datos reales** | Pestaña oculta "Inasistencia" · hoja `resumen` | Pequeño | Mismo archivo `resumen` |
| Nivel de servicio | **Ya existe** en Trafico de Llamadas/WhatsApp (SL a 20s, Fase 68) | Pestañas "Trafico de Llamadas"/"Trafico de WhatsApp" | — | **Aclarar con Edwin qué es distinto** antes de construir nada nuevo — ver pregunta abajo |
| STA (Gestión STA) | **Construida, sin datos reales** | Pestaña oculta "Gestion STA" · hojas `sta_categorias` + parte de `resumen` | Mediano (combina 2 hojas, 3 dimensiones: servicio/estado/mes actual) | Archivo real de STA por servicio/estado/mes |
| Llamadas/WhatsApp de salida | **Construida, sin datos reales** | Pestaña oculta "Salida" · hoja `salida` (diaria) | Pequeño | Archivo real de salida (día a día o el mes completo) |
| Efectividad de ordenamiento médico | **Construida, sin datos reales** | Parte de "Agendamiento" · hoja `resumen` | Pequeño (mismo archivo que Agendas) | Mismo archivo `resumen` |
| Recuperación de cancelados | **Construida, sin datos reales** | Parte de "Agendamiento" · hoja `resumen` | Pequeño (mismo archivo que Agendas) | Mismo archivo `resumen` |
| Efectividad de citas | **Construida, sin datos reales** | Pestaña oculta "Efectividad Citas" · hoja `resumen` | Pequeño (mismo archivo que Agendas) | Mismo archivo `resumen` |
| Flujo Mensual (llamadas/whatsapp manual por mes) | **Construida, sin datos reales** — probablemente redundante | Pestaña oculta "Flujo Mensual" · hoja `resumen` | — (no recomendado reconstruir) | Nada — Trafico de Llamadas/WhatsApp ya cubre esto con datos automáticos y más detalle. Preguntar a Edwin si se puede retirar definitivamente en vez de solo ocultarla |

### Sobre "Nivel de servicio" — pregunta para Edwin, no duplicar trabajo

Trafico de Llamadas y Trafico de WhatsApp ya muestran Nivel de Servicio a
20 segundos (Fase 68, por período/mes, calculado desde `SERVICE_LEVEL_20SEC`
de Wolkvox). Si Edwin lo mencionó como una base aparte que falta, podría
referirse a algo distinto, por ejemplo:
- Nivel de servicio **por hora o franja horaria** (Wolkvox reporta por
  día/período, no por hora — sería un dato nuevo, no solo mostrar lo que
  ya existe).
- Un **reporte formal de Calidad** con una definición de SLA distinta a la
  que calcula Wolkvox (ej. una meta interna de InCo).
- El nivel de servicio de una **línea o cola específica** que hoy no está
  separada (aunque el desplegable de Skill/Cola ya permite filtrar por
  línea individual).

Antes de construir algo nuevo bajo el nombre "nivel de servicio", vale la
pena preguntarle a Edwin exactamente qué necesita que no esté ya en
Trafico de Llamadas/WhatsApp.

## Recomendación: orden para pedirle bases a Edwin

Priorizado por lo que sale más rápido con lo que YA existe (sin código
nuevo, solo falta el archivo real):

1. **`resumen` (un mes, ej. agosto 2026, igual que Trafico)** — desbloquea
   DE UNA VEZ Agendamiento (Ordenamiento médico + Recuperación de
   cancelados + Total agendas + Agendas por línea), Inasistencia, Gestión
   STA (parcial) y Efectividad Citas. Es la base con mejor relación
   esfuerzo/resultado: un solo archivo, cuatro pestañas.
2. **Tipificación** — igual de rápido en código, pero necesita además el
   glosario completo de categorías (pendiente con InCo) antes de poder
   mostrarlo bien etiquetado.
3. **Salida** — sencillo, una hoja más.
4. **`sta_categorias`** — completa Gestión STA (junto con el `resumen` del
   punto 1).
5. **Aclarar "Nivel de servicio"** con Edwin antes de que traiga nada — ver
   pregunta arriba.
6. Calidad — ya tiene datos; solo pedir confirmación sobre los
   asesores/evaluadores de prueba mezclados (Fase 29).

### Para la primera base recomendada (`resumen`) — qué pedirle a Edwin exactamente

**Actualizado en la Fase 71** (2026-09-24): de las 23 columnas originales de
`resumen`, **7 ya NO hay que pedírselas a Edwin** — son datos de tráfico
(Llamadas 3P, WhatsApp 3P, Llamadas Línea General, WhatsApp Línea General,
y los 3 niveles de atención correspondientes) que duplicaban exactamente lo
que ya carga Wolkvox por Trafico de Llamadas/WhatsApp. Desde esta fase se
calculan solos, todos los meses, a partir de esas dos cargas — la plantilla
descargable de ORLANT ya no las muestra, y si un archivo viejo todavía las
trae llenas, se ignoran con un aviso explícito en la vista previa ("se toma
automáticamente de Tráfico"), nunca pisan el dato real.

**Lista exacta de las 16 métricas que Edwin SÍ debe llenar en `resumen`**
(hoja vertical `Metrica`/`Valor`, un valor por mes — formato de la columna
`Valor`: número entero salvo que diga "%", en cuyo caso es 0–100, nunca
0–1):

| Métrica (columna en la hoja) | Qué significa | Formato | Para qué pestaña |
|---|---|---|---|
| Ordenes medicas gestionadas | Total de órdenes médicas 3P gestionadas en el mes | Entero | Agendamiento → Ordenamiento Médico |
| Ordenes medicas que agendaron | De esas, cuántas terminaron en una cita agendada | Entero | Agendamiento → Ordenamiento Médico (numerador de "% Efectividad") |
| Citas canceladas (recuperacion) | Citas canceladas que se intentaron recuperar en el mes | Entero | Agendamiento → Recuperación de Cancelados |
| Citas canceladas recuperadas/atendidas | De esas, cuántas se lograron reagendar/atender | Entero | Agendamiento → Recuperación de Cancelados (numerador de "% Efectividad") |
| Total agendas del mes | Total de agendas del mes (todas las líneas) | Entero | Agendamiento → Total Agendas |
| Agendas Linea General | Agendas de la línea general | Entero | Agendamiento → Agendas por Línea |
| Agendas Linea 3P | Agendas de la línea 3P | Entero | Agendamiento → Agendas por Línea |
| % Inasistencia Audifonos | % de inasistencia del servicio de audífonos | Porcentaje (0–100) | Inasistencia |
| % Inasistencia Audiologia | % de inasistencia de audiología | Porcentaje (0–100) | Inasistencia |
| % Inasistencia Examenes | % de inasistencia de exámenes | Porcentaje (0–100) | Inasistencia |
| % Inasistencia Total | % de inasistencia total del mes | Porcentaje (0–100) | Inasistencia |
| STA — Ordenes cargadas | Total de órdenes cargadas al STA en el mes | Entero | Gestión STA → STA por Mes |
| STA — Agendadas | De esas, cuántas se agendaron (**opcional**, puede quedar vacía) | Entero | Gestión STA → STA por Mes |
| STA — Facturado + Cumplida | De esas, cuántas quedaron facturadas y cumplidas | Entero | Gestión STA → STA por Mes (numerador de "% Efectividad") |
| Citas programadas para el mes | Total de citas programadas para el mes | Entero | Efectividad Citas |
| Citas atendidas | De esas, cuántas se atendieron de verdad | Entero | Efectividad Citas (numerador de "% Efectividad") |

Nota: Gestión STA también tiene 2 gráficas más ("Ordenes por Servicio" y
"Estado de Órdenes", ambas anuales) que vienen de la hoja `sta_categorias`
aparte, NO de `resumen` — si Edwin manda primero solo `resumen`, esas 2
gráficas de STA seguirán vacías hasta que llegue `sta_categorias` también
(base separada en la tabla de arriba).

Empezar por el mismo mes que ya tiene Trafico (agosto 2026) facilita
comparar/cruzar datos.

## Nota sobre esfuerzo "mediano"/"grande"

Ninguna base de esta lista requiere código nuevo de verdad — todas ya
tienen su panel, su hoja de plantilla y su parseo construidos desde hace
varias fases; "mediano" (solo STA) es por combinar 2 hojas con 3
dimensiones distintas, no por trabajo de desarrollo pendiente. No se
identificó ninguna base de esfuerzo "grande" ni "no existe" dentro de lo
que Edwin ya mencionó — si alguna de las ~15 bases que Edwin va a traer no
está en esta tabla, probablemente sea nueva de verdad y sí necesitaría
diseño desde cero.
