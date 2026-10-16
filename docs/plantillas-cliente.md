# Plantillas de cliente — diagnóstico y propuesta (Fase 153)

**Estado: propuesta para revisar con Edwin.** Nada de esto está implementado. Se aplica solo después del "OK plantillas".

Pedido de Edwin (16/10/2026):
- Montar los clientes nuevos (Clínica Aurora y luego Hospital La María) desde una **plantilla basada en ORLANT**.
- Las partes comunes (Flujo de Llamadas, Flujo de WhatsApp…) deben ser iguales para todos.
- Todavía no se cargan resultados.

---

## 1. Diagnóstico (Paso 0, solo lectura)

### 1.1 Módulos de hoy

| Módulo (tipo de panel) | Lo usa | Tabla / carga | Plantilla Excel oficial | Dependencia del nombre de campaña en el código |
|---|---|---|---|---|
| Flujo de Llamadas (`trafico_combo`) | ORLANT, MOBILIZE | `calidad_nivel_servicio_diario` + `trafico_skill_mapeo` (skill → campaña/sede), carga "Tráfico de Llamadas" | `PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx` | Formato de 2 hojas solo para ORLANT (`CARGAS_CLIENTES_TRAFICO_UNIFICADO`). Sincroniza el "resumen" manual solo en ORLANT (`resumen-orlant-trafico.js`, `trafico-skills.js`) |
| Flujo de WhatsApp (`trafico_whatsapp_combo`) | ORLANT | `trafico_whatsapp`, carga "Tráfico de WhatsApp" | `PLANTILLA_TRAFICO_WHATSAPP_INCONEXION_VACIA.xlsx` | Misma sincronización del resumen solo ORLANT (`trafico-whatsapp.js`) |
| WhatsApp por rangos de tiempo (sub-vista de WhatsApp) | ORLANT | `whatsapp_tiempos` | No tiene (archivo de Wolkvox) | `WPP_TIEMPOS_CAMPANAS` y `CARGAS_CLIENTES_WHATSAPP_TIEMPOS` = solo ORLANT |
| Tipificación (`tipificacion_panel`, torta + tabla) | ORLANT, MOBILIZE (oculta) | `tipificaciones` | No tiene (CDR de Wolkvox) | MOBILIZE usa el CDR (`CARGAS_CLIENTES_TIPIFICACION_EXTRA`) |
| Calidad (`calidad_kpis`, `calidad_pie`, `calidad_bar_asesores`) | ORLANT, MOBILIZE | `monitoreos` + plantilla de evaluación por campaña | Carga masiva de Calidad | `CAMPANAS_CALIDAD` y `calidad-plantillas-seed.js` fijos por campaña |
| Agendas (`agendas_panel`: especialidad, mensual, línea) | ORLANT (oculta hasta tener datos) | `agendas` | No tiene (AGENDAS de Wolkvox) | Solo el parámetro `campana` del panel |
| Efectividad de Agendamiento (`efectividad_agendamiento_panel`) | ORLANT | `efectividad_agendamiento` | No tiene | Solo `campana` |
| Inasistencia (`inasistencia_panel`) | ORLANT | `inasistencias` | No tiene | Solo `campana` |
| Efectividad de Citas (`efectividad_citas_panel`) | ORLANT | `efectividad_citas` | No tiene | Solo `campana` |
| Llamadas y WhatsApp de salida (`salida_panel`) | ORLANT | `dashboard_cargas` (resumen mensual manual) | Hoja "resumen" | Solo `campana` |
| Llamadas Únicas y de Salida (`llamadas_unicas_panel`) | MOBILIZE | `llamadas_unicas`, `llamadas_salida` | `PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx` (Únicas); Salida sin plantilla | `CARGAS_CLIENTES_LLAMADAS_UNICAS`/`_SALIDA`; asesor visible al cliente solo en MOBILIZE (`LU_CAMPANAS_ASESOR_VISIBLE_CLIENTE` y `CAMPANAS_ASESOR_VISIBLE_CLIENTE` en el servidor) |
| Encuesta / One & Done (`encuesta_panel`) | MOBILIZE | `encuestas` | No tiene (HistIVR de Wolkvox) | `CARGAS_CLIENTES_ENCUESTA` |
| Pestañas manuales de ORLANT (Ordenamiento médico, Recuperación de cancelados, Flujo mensual 3P/General, STA) | ORLANT (ocultas) | `dashboard_cargas` por secciones (`dashboard-secciones.js`) | Hojas de la carga manual | Propias de ORLANT |

**Otras listas fijas que habría que generalizar:**

| Archivo | Qué tiene fijo |
|---|---|
| `public/js/constants.js` | `CLIENTES_LIST`, `CAMPANAS_CALIDAD`, `CAMPANAS_CON_PLANTILLA`, `BUILT_CLIENT_DASHBOARDS` |
| `server/db.js` | `CLIENTES_LIST` y `CAMPANAS_CALIDAD` (siembran las claves `cliente_X`/`campana_X` de los permisos) |
| `dashboard-generic.js` | Los logos por cliente y el color de "Última actualización" de Mobilize |
| `validation.js` | Restringe el borrado por rango a ORLANT |

### 1.2 Clasificación

- **Comunes** (sirven a cualquier cliente sin cambios):
  - Flujo de Llamadas.
  - Flujo de WhatsApp.
  - Tipificación.
  - Calidad, que necesita su plantilla de evaluación.
- **Configurables** (sirven con parámetros):
  - Agendas, Efectividad de Agendamiento, Inasistencia y Efectividad de Citas (clientes de salud).
  - Llamadas y WhatsApp de salida.
  - Llamadas Únicas y de Salida (parámetro: si el cliente ve el asesor).
  - WhatsApp por rangos.
  - Encuesta / One & Done (parámetro: base del FCR).
  - Sedes, como filtro de vista con `trafico_skill_mapeo.sede`.
- **Específicos:**
  - Las pestañas manuales de ORLANT.
  - La sincronización del "resumen" de ORLANT con Tráfico (líneas 3P/General).
  - El borrado por rango, que hoy solo existe para ORLANT.

### 1.3 Historia

- **`server/dashboard-plantillas-cliente.js`** (M3 / Fase A2, borrado en la Fase 134) tenía 3 plantillas genéricas: `plantillaVentas`, `plantillaCobranza` y `plantillaAtencion`. Estaban armadas sobre la carga **manual** por secciones (`dashboard_cargas`) más las pestañas de Calidad y Tráfico. Las usaban 8 clientes sin datos reales.
  - **Qué sirve:** la idea de "pestaña reutilizable" (`tabCalidad(campana)`, `tabTrafico(campana)`).
  - **Qué no sirve:** sus KPIs y paneles salían de hojas manuales que nadie llenaba. Los módulos reales de hoy salen de las exportaciones de Wolkvox.
- **Clínica Aurora** (seed viejo) tenía estas pestañas:
  - Llamadas Entrada, WhatsApp Entrada, Agendas (con % de inasistencia), Tipificación (5 tortas: llamada y WhatsApp de entrada y salida, y encuestas), Salida, Manager, Sábados, Calidad y Tráfico.
  - Todo salía de carga manual, salvo Calidad y Tráfico.
- **Hospital La María** (seed viejo) era **un solo cliente con filtro de sede**: vista `sede` con "Sede Castilla" y "Sede 33". En Tráfico, cada skill se asignaba a la campaña "HOSPITAL LA MARIA" más su sede (`trafico_skill_mapeo.sede`).
  - Pestañas: Llamadas y WhatsApp, Agendamiento, Tipificación, Demanda Insatisfecha (IVR sin agenda, por especialidad), Entidades y Tráfico.
  - **Qué sirve:** el modelo de sede, que sigue soportado en Tráfico (`_traficoRenderContenido(campana, sede, …)`), y la lista de pestañas como punto de partida para preguntarle a Edwin.
  - **Qué no sirve:** sus fuentes manuales.

### 1.4 El constructor de Dashboards hoy

Permite (solo para el admin completo):
- **Crear** el dashboard de un cliente desde cero (`POST /api/dashboards/config`), pero solo para un nombre que ya está en `CLIENTES_LIST`.
- **Editarlo** (`PUT`) y **borrarlo** (`DELETE`).
- Usar paneles genéricos sobre la carga manual: `line`, `bar`, `area`, `pie`, `tabla`, `calidad_kpis`, `calidad_pie`.

No permite:
- Agregar los módulos autónomos (Flujo de Llamadas, WhatsApp, Agendas, Tipificación, Encuesta…).
- Copiar un cliente existente.
- Partir de una plantilla.
- Activar o desactivar módulos.
- Crear la campaña, sus permisos ni su plantilla de Calidad.

### 1.5 Dar de alta un cliente nuevo hoy (y dónde se rompe)

1. Agregar el nombre a `CLIENTES_LIST` en `constants.js` **y** en `db.js` (código, deploy). Si falta en uno de los dos, los permisos y el selector de clientes quedan desalineados.
2. Agregarlo a `CAMPANAS_CALIDAD` y darle una plantilla de evaluación en `calidad-plantillas-seed.js` (código).
3. Escribir su dashboard a mano en `dashboard-config-seed.js` más una migración. El constructor no sirve, porque no ofrece los módulos reales.
4. Agregarlo a las listas de `cargas.js` de cada módulo especial que use (código).
5. Mapear sus skills de Wolkvox a la campaña en la pantalla de Tráfico.
6. Crear usuarios y darles `cliente_X` / `campana_X` (pantalla Usuarios). Las casillas salen de `CLIENTES_LIST`, por eso el paso 1 es obligatorio.
7. Logo opcional (código).

**Dónde se rompe:**
- Son 4 o 5 archivos de código por cliente, sin una prueba que verifique que todos quedaron alineados.
- Los módulos especiales quedan apagados en silencio si se olvida una lista.
- Ojo con la migración `fase134_borrar_clientes_v1`: borra justamente "CLINICA AURORA" y "HOSPITAL LA MARIA". Es `runOnceMigration` y en producción ya corrió, así que **no** se vuelve a ejecutar. En una base nueva corre una vez al arrancar, antes que cualquier migración posterior en el archivo. Una creación de Aurora/HLM debe ir **después** de ella (o hacerse desde la pantalla) y con prueba.

---

## 2. Propuesta (Paso 1)

### 2.1 Catálogo de módulos

| Id | Nombre | Qué muestra | Carga que necesita | Plantilla Excel oficial |
|---|---|---|---|---|
| `flujo_llamadas` | Flujo de Llamadas | Total, contestadas, abandonadas, nivel de atención, nivel de servicio; sub-pestañas de abandono, AHT, ASA/ATA y nivel de servicio | Tráfico de Llamadas (Wolkvox) | Tráfico de llamadas (existe) |
| `flujo_whatsapp` | Flujo de WhatsApp | Lo mismo para WhatsApp | Tráfico de WhatsApp | Tráfico de WhatsApp (existe) |
| `whatsapp_tiempos` | WhatsApp por rangos de tiempo | % contestado por rangos de minutos | Tiempos de respuesta de WhatsApp | **Falta** |
| `tipificacion` | Tipificación | Torta + tabla por canal | CDR / tipificación de Wolkvox | **Falta** (hoy, formato nativo de Wolkvox) |
| `calidad` | Calidad | Monitoreos, puntaje, clasificación, promedio por asesor | Monitoreos (formulario o carga masiva) + plantilla de evaluación | Carga masiva de Calidad (confirmar que se descarga) |
| `agendas` | Agendas | Por especialidad, por mes y por línea | AGENDAS de Wolkvox | **Falta** |
| `efectividad_agendamiento` | Efectividad de Agendamiento | Ranking de asesores | Efectividad por asesor | **Falta** |
| `inasistencia` | Inasistencia | Por mes y por especialidad | Inasistencia | **Falta** |
| `efectividad_citas` | Efectividad de Citas | Agendas vs. atendidas | Efectividad de citas | **Falta** |
| `llamadas_unicas` | Llamadas Únicas y de Salida | Únicas por día; salida conectadas/no conectadas | Únicas + Salida | Únicas (existe, con el nombre de Mobilize: renombrar) y Salida (**falta**) |
| `encuesta` | Encuesta / One & Done | Preguntas, comentarios, FCR | HistIVR de Wolkvox | **Falta** |

### 2.2 Plantilla base "Contact center"

- **Siempre** (comunes): `flujo_llamadas`, `flujo_whatsapp`, `tipificacion` y `calidad`.
- **Opcionales** por cliente (casillas al crearlo): `whatsapp_tiempos`, `llamadas_unicas`, `encuesta` y el grupo **Salud** (`agendas`, `efectividad_agendamiento`, `inasistencia`, `efectividad_citas`).
- **Parámetros por cliente:**
  - sedes (como HLM);
  - si el cliente ve el asesor (Únicas y Salida);
  - base del FCR;
  - metas, que empiezan vacías: sin meta no hay semáforo, y se cargan en Umbrales;
  - logo.
- **Todas las pestañas empiezan ocultas** y aparecen al cargar datos, que es el comportamiento que ya existe.

### 2.3 Cómo se crea un cliente

En la pantalla Dashboards, un botón **"Nuevo cliente desde plantilla"** (solo el admin completo) pide:
- el nombre exacto de la campaña;
- los módulos opcionales;
- las sedes (opcional);
- si el cliente ve el asesor.

La acción crea, en una sola transacción y registrada en el Historial:
1. El cliente en un **registro de clientes en la base**, que reemplaza a las listas fijas.
2. Su dashboard a partir de la plantilla.
3. Su plantilla de Calidad (genérica, editable).

No crea usuarios ni da permisos: eso lo hace el usuario desde Usuarios. Tampoco carga datos. Así no hace falta tocar el seed ni hacer deploy para dar de alta un cliente.

Para Aurora y HLM en producción se usa esa acción, o una migración idempotente nueva, **solo** con "OK crear Aurora" / "OK crear HLM".

### 2.4 Plantillas Excel

Una por módulo, con las mismas columnas para todos los clientes, descargables desde Cargar Datos.

- **Faltan:** WhatsApp por rangos, Tipificación, Agendas, Efectividad de Agendamiento, Inasistencia, Efectividad de Citas, Llamadas de Salida y Encuesta.
- **Renombrar:** la de Llamadas Únicas, para que no diga "MOBILIZE".

Donde el archivo nativo de Wolkvox ya funciona, la "plantilla" puede ser ese mismo formato con columnas documentadas. Eso se decide con Edwin.

### 2.5 Orden de generalización (PRs pequeños, sin cambio visible primero)

1. **Registro de clientes en la base.** Una tabla con nombre, módulos activos, parámetros y logo, sembrada con ORLANT y MOBILIZE tal como están hoy.
   - `GET /api/dashboard/clientes` la expone.
   - `constants.js` y `db.js` leen de ahí en vez de las listas fijas.
   - Prueba: las listas que salen son **idénticas** a las de hoy.
2. **Listas por módulo de `cargas.js`, visibilidad del asesor, WhatsApp por rangos y logos:** que salgan del registro (módulos y parámetros del cliente).
   - Prueba: ORLANT y MOBILIZE ven exactamente las mismas cargas y pantallas.
3. **Catálogo y plantilla en el servidor** (`plantillas-cliente.js`): genera el layout de un cliente desde sus módulos.
   - Prueba de "foto": el layout generado para ORLANT y MOBILIZE (con sus módulos y sus pestañas específicas) es **igual** al que existe hoy.
   - Si no lo es, sus layouts actuales se quedan como están y la plantilla solo se usa para clientes nuevos.
4. **"Nuevo cliente desde plantilla"** en la pantalla Dashboards (servidor más interfaz, con Historial y permisos de admin completo).
5. **Plantillas Excel que faltan.**
6. **Crear Aurora y después HLM**, cada uno con su OK.

Los casos específicos de ORLANT (sincronización del resumen, borrado por rango) **no** se generalizan: quedan como "específicos de ORLANT", con su nombre.

### 2.6 Riesgos

- **ORLANT y MOBILIZE no deben cambiar en nada visible ni en sus números.** Cada PR lleva una prueba de igualdad (layout, listas, cargas visibles) y una revisión en el navegador con la base demo.
- **Migración de la Fase 134:** no debe borrar ni crear de forma distinta. Hace falta una prueba que arranque una base nueva, cree Aurora desde la plantilla y confirme que sigue ahí después de todas las migraciones.
- **Permisos:** un cliente nuevo no debe quedar visible para nadie (salvo el admin completo) hasta que se den permisos a mano.
  - Hoy eso ya pasa: los usuarios existentes no tienen la clave `cliente_X` / `campana_X` del cliente nuevo, y una clave que falta cuenta como "sin acceso".
  - La migración que rellenaba claves en `true` (`scoped_permissions_v1`) corrió una sola vez y no se repite.
  - Hay que mantenerlo con una prueba.
- **Mapeo de skills:** si un skill de Wolkvox se mapea al cliente equivocado, sus datos se ven en otro dashboard. La pantalla de mapeo debe mostrar el cliente y la sede con claridad.

### 2.7 Preguntas para Edwin

1. **Aurora:** ¿qué módulos lleva? ¿Flujo de Llamadas y WhatsApp, Tipificación, Calidad, y el grupo Salud (Agendas, Inasistencia, Efectividad)? ¿Llamadas Únicas o Encuesta?
2. **Hospital La María:** ¿qué módulos lleva? ¿Sigue siendo **un solo cliente con filtro de sede** (Sede 33 y Castilla), como antes, o dos clientes separados?
3. **Nombres exactos** de las campañas como deben verse y guardarse. Antes eran "CLINICA AURORA" y "HOSPITAL LA MARIA".
4. **Reportes propios de cada uno:** los de antes (Manager, Sábados, Demanda Insatisfecha, Entidades) ¿siguen haciendo falta? ¿De qué archivo de Wolkvox salen?
5. **Plantillas Excel:** ¿usamos los archivos nativos de Wolkvox como formato oficial, o una plantilla propia por módulo?
6. **Metas iniciales** de cada uno, para la pantalla Umbrales.
