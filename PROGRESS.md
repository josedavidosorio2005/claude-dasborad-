# PROGRESS — InConexion® Platform

Fuente de verdad del avance. Desde la Fase 112, este archivo es un
**resumen corto, que se actualiza en el sitio** (no aditivo) — el detalle
narrativo de cada fase, fase por fase, vive en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)
(aditivo, nunca se reescribe — ver `CLAUDE.md` → "Bitácora").

## Estado actual

- **Versión**: `1.72.7` (ver `server/package.json`, expuesta en
  `/api/health` y en el menú de usuario de cada página).
- **Marca**: logo/isotipo en `public/img/marca/` (originales de diseño
  fuera del repo, nunca commiteados), favicon en `public/favicon*`,
  tipografía Quicksand autoalojada en `public/fonts/`, tokens de color
  oficiales al inicio de `public/css/styles.css` (`--c-brand`,
  `--c-brand-blue`, `--c-brand-green`, `--c-brand-gray-*`) — Fase 132.
  El nombre se escribe siempre "InConexion®" (sin tilde, con ®) — Fase
  132 (cierre), 4 pruebas nuevas en
  `server/tests/fase132-07-marca-registrada.test.js` que fallan si
  vuelve a aparecer "InConexión" o el nombre sin ® en `index.html`.
  Logo de Mobilize (provisional, ver `docs/pendientes.md`) en el
  encabezado de su propio dashboard, nunca en los demás clientes —
  Fase 132 (Parte 8), `public/img/clientes/mobilize-logo.png` + `@2x`,
  prueba en `server/tests/fase132-08-logo-mobilize.test.js`. Verificado
  en producción real (login de administrador, Playwright visible):
  logo visible solo en MOBILIZE, 0 errores de consola.
- **Sistema de diseño / accesibilidad WCAG 2.1 AA** (Fase 133, ampliado
  en la Fase 136 con tokens/especificación de movimiento y componentes
  base): [`docs/sistema-de-diseno.md`](docs/sistema-de-diseno.md) —
  tokens de color/tipografía/foco/objetivos táctiles, regla del semáforo
  vs. paleta categórica, cómo agregar un color nuevo sin romper el
  contraste, duraciones/easings/interruptor `data-motion="off"` y los
  6 modales unificados.
- **Producción**: `https://sinco.inconexion.com.co` (único dominio
  desde la Fase 139, 13/10/2026).
- **Clientes**: **ORLANT** y **MOBILIZE** tienen datos reales.
  **Hospital La María** (Fase 160, un solo cliente, sin sedes por ahora)
  tiene el Flujo de agosto (Fase 163); **Clínica Aurora** (Fase 153) sigue
  sin datos. Los dos solo los ve el administrador; lo que falta está en
  [`docs/pendientes.md`](docs/pendientes.md) (sección 2). Los otros 12
  clientes de antes se borraron en la Fase 134 y no existen.
- **Meses con datos**: ORLANT tiene datos oficiales desde **agosto de
  2026** (más julio de Tipificación de WhatsApp, real); los meses de prueba
  se borraron en la Fase 126 (`POST /api/admin/borrado-rango`, dry-run +
  conteo exacto). Octubre llega por partes: ya están WhatsApp por rangos
  de ORLANT (1–22/10) y, de Mobilize, Tipificación, Llamadas de salida y el
  Resumen de calidad; faltan los CDR de octubre de ORLANT.
- **Pestañas**: ORLANT, 8 con datos reales (Tráfico de Llamadas, Tráfico de
  WhatsApp, Llamadas y WhatsApp de salida, Agendamiento, Inasistencia,
  Efectividad de Citas, Tipificación, Calidad) + 4 ocultas esperando
  archivo. MOBILIZE, 5 (Flujo de Llamadas, Llamadas Únicas y de Salida,
  Tipificación, Encuesta, Calidad con el Resumen por asesor). Qué base
  alimenta cada una:
  [`docs/inventario-bases-orlant.md`](docs/inventario-bases-orlant.md).
- **Reglas de conteo de la salida en Tipificación** (Fase 174, confirmadas
  por Edwin el 23/10):
  - Llamada de salida = TYPE_INTERACTION `outbound_ma` **o** `out_pre`
    (aunque `out_pre` traiga skill, p. ej. 4070 CANCELACIONES Y
    REPROGRAMACION en ORLANT: se guarda como salida, no como entrada). Un
    SKILL "-" es salida solo con esos dos tipos (Fase 177).
  - "No conectada" es por cliente (`parametros.salidaNoConectada` del
    registro de clientes): ORLANT = `NO_CONTESTAN` + `BUZON`
    (DESCRIPTION_COD_ACT, separadas en la tipificación); MOBILIZE =
    `Cliente_no_contesta`; sin parámetro, el de Mobilize.
  - En ORLANT la salida se cuenta **por registro** (cada fila del CDR). El
    teléfono único se usa solo en Llamadas Únicas de Mobilize.
  - En los meses con CDR, la pestaña "Llamadas y WhatsApp de salida" de
    ORLANT sale del CDR y se reparte en 3P/General por la línea de cada
    asesor en ese mes (Fase 170); sin línea asignada = "Sin asignar".
- **Infraestructura**: estado vigente (cuenta AWS, recursos, pipeline,
  respaldos) en [`docs/infraestructura.md`](docs/infraestructura.md).
- **Pendientes**: un solo lugar, [`docs/pendientes.md`](docs/pendientes.md),
  en 3 bloques (Fase 137): esperando una decisión tuya, esperando a Edwin,
  y técnico sin dueño.
- **Mapa de la documentación**: [`docs/README.md`](docs/README.md).

### Números de control

Últimos valores verificados en producción (por la API y en pantalla, con
sesión). El detalle de cada verificación está en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md),
en la fase indicada. La cuenta CLIENTES_DASH no se ha vuelto a verificar
desde la Fase 130 (ver `docs/pendientes.md`, sección 1).

| Indicador | Valor | Fase |
|---|---|---|
| Tipificación de Llamadas (ORLANT) | Ago 14.940 · Sep 19.721 (recargado del CDR, mismas filas) | 116 / 174 |
| Llamadas de salida en Tipificación (ORLANT, sep) | 10.791 = 5.687 conectadas + 5.104 no conectadas | 174 / 177 |
| Tipificación de WhatsApp (ORLANT) | Jul 71 · Ago 12.061 · Sep 13.118 (3.997 de salida) | 122 / 168 |
| Tráfico de Llamadas (ORLANT) | Ago 8.908/7.961/947 · Sep 9.043/8.883/160 | 115 |
| Tráfico de WhatsApp (ORLANT) | Ago 7.390/7.370/20, SL20 36,05 % · Sep 7.968/7.953/15, SL20 39,88 % | 116 |
| WhatsApp por rangos (ORLANT, oct, 1–22/10) | 5.196 conversaciones; 0 a 3 min 57,6 % | 165 / 166 |
| Agendas (ORLANT) | 24.186 (Ago 11.040 / Sep 13.146), 20 asesores | 126 |
| Inasistencia (ORLANT) | Ago 11.189/786/48, 7,45 % · Sep 12.194/749/61 · período 7,03 % | 130 |
| Calidad (ORLANT) | Sep: 95 monitoreos, 19 asesores, promedio 94,79 % | 130 |
| Efectividad de agendamiento (ORLANT) | Ago 41,17 % (11.040 / 26.814) · Sep 40,00 % (13.146 / 32.868) | 122 |
| Efectividad de Citas (ORLANT) | Ago 11.189/7.896 · Sep 12.194/8.968 · período 72,12 % | 126 |
| Llamadas y WhatsApp de salida (ORLANT) | Ago (archivo): llamadas 6.560, WhatsApp 3.382 · Sep (CDR): llamadas 10.791, WhatsApp 3.997 | 127 / 177 |
| Tipificación de Mobilize (llamadas) | Ago 80 · Sep 167 (salida 64 = 49 + 15) · Oct 127 | 173 |
| Llamadas de salida de Mobilize | Oct 85 = 45 conectadas + 40 no conectadas | 171 |
| Llamadas Únicas de Mobilize | Sep 139 = 88 contestadas + 51 abandonadas | 139 |
| Resumen de calidad de Mobilize | Oct: 3 asesores, 34 monitoreos, 97,35 % | 174 / 177 |

## Índice de fases

Título de cada fase (detalle completo en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md),
mismo orden):

- Fase 0 — Auditoría de punto de partida
- Fase 1 — Backend Calidad y Metas
- Fase 2 — Sistema de dashboards configurables, nivel profesional
- Fase 3 — Dashboards de cliente restantes
- Fase 4 — Inventario y Gerencia
- Fase 5 — Seguridad y estabilidad
- Fase 6 — Infraestructura y despliegue en AWS
- Fase 7 — Verificación final integral
- Fase 8 — Reporte final
- Fase 8.1 — Auditoría post-cierre: XSS almacenado (2026-09-10)
- Fase 9 — Despliegue real en AWS (2026-09-10)
- Fase 10 — Feedback de Edwin (rama `feature/feedback-edwin-2026-09-10`)
- Fase 11 — Cierre: Gestión Humana + pasada de calidad + merge a producción (2026-09-10)
- Fase 12 — Apps de escritorio y Android (rama `feature/apps-desktop-android`, 2026-09-10)
- Fase 13 — Cierre total: producción sirviendo la versión nueva (2026-09-10)
- Fase 14 — Layout responsivo en celular: navbar + sidebar (rama `fix/responsive-navbar-sidebar-movil-2026-09-11`, 2026-09-11)
- Fase 15 — Logo del navbar ilegible por contraste (rama `fix/logo-navbar-contraste-2026-09-11`, 2026-09-11)
- Fase 16 — Datos de demostración para todos los dashboards + PRs #9/#10 (2026-09-14)
- Fase 17 — Cierre de dos cabos sueltos de la Fase 16: credenciales de demo y aviso de datos ficticios (2026-09-14)
- Fase 18 — Trafico de llamadas: carga real de Volvox, mapeo de skills y grafica con filtros (2026-09-14)
- Fase 19 — Semáforo de color configurable + carga masiva de Cartera (2026-09-15)
- Fase 20 — Cierre del módulo "Flujo de Llamadas" contra el pedido de Edwin (2026-09-15)
- Fase 21 — Ajustes finos de "Flujo de Llamadas" tras la llamada real con Edwin (2026-09-15)
- Fase 22 — Plantilla oficial de Tráfico publicada como descarga (2026-09-15)
- Fase 23 — QA de la plantilla oficial de Tráfico en producción (PRs #27-30, 2026-09-15)
- Fase 24 — Plantilla consolidada de carga (PRs #31-37, 2026-09-15)
- Fase 25 — Diagnóstico de solo lectura para producción (PRs #38-39, 2026-09-15)
- Fase 26 — Fix: la cascada de borrado de dashboards ya no borra los Excel cargados (PRs #40-43, 2026-09-16)
- Fase 27 — Botón "Previsualizar" + filtros y colores estables en gráficas (PRs #44-46, 2026-09-16)
- Fase 28 — Auditoría de solo lectura de las 3 campañas prioritarias (PR #47, 2026-09-16)
- Fase 29 — Auditoría general de la plataforma ("Radiografía InConexion®") + 4 mejoras técnicas (2026-09-17)
- Fase 30 — Cierre del resto de la lista de auditoría (deps mayores) + fix de `main` roto + auditoría del flujo de carga (PRs #55-57, 2026-09-17)
- Fase 31 — Fix: una hoja renombrada en la plantilla consolidada ya no se pierde en silencio (2026-09-17)
- Fase 32 — Pantalla de mapeo manual de skill de Wolkvox → campaña (2026-09-17)
- Fase 33 — Dashboard de ORLANT con las 16 gráficas del PDF de InCo (PRs #64-65, 2026-09-18)
- Fase 34 — Fix: Tipificación duplicaba categorías en el pie + datos de prueba dejados visibles a propósito (PR #70, 2026-09-18)
- Fase 35 — Tema oscuro/claro para toda la plataforma (PR #72, 2026-09-18)
- Fase 36 — Trafico real de ORLANT (agosto 2026) + retiro de los datos de prueba de la Fase 34 (2026-09-18)
- Fase 37 — Cronograma y Metas de Monitoreo reorganizado en sub-pestañas (PR #76, 2026-09-18)
- Fase 38 — Gráficas de ASA/ATA, Wait Time y Niveles de Servicio 10s/30s en Tráfico (PR #78, 2026-09-18)
- Fase 39 — Llamadas 3P/General y Nivel de Atención de ORLANT se calculan solos desde Tráfico (PR #80, 2026-09-18)
- Fase 40 — "Una gráfica por pestaña": Tráfico/Wolkvox y el dashboard normal de ORLANT reorganizados en sub-pestañas (2026-09-21)
- Fase 40b — Menú de ORLANT reducido a "Calidad" y "Tráfico de Llamadas" — TEMPORAL (2026-09-21)
- Fase 41 — Escaneo completo: tema oscuro/claro, bugs cosméticos conocidos y QA funcional general (2026-09-21)
- Fase 42 — Extiende el escaneo de tema/QA a las 8 campañas restantes + cierra los colores tenues pendientes (2026-09-21)
- Fase 42-bis — Limpieza de la rama sin usar de la Fase 36 (2026-09-21)
- Fase 45 — Ajustes de Tráfico de Llamadas + valores numéricos visibles en las gráficas (2026-09-21)
- Fase 46 — Menú lateral desplegable (2026-09-21)
- Fase 47 — Auditoría de cumplimiento vs. la reunión con Edwin (21/09) (2026-09-21)
- Fase 48 — Revisión de seguridad y de bugs de las Fases 45-47, integradas (2026-09-21)
- Fase 49 — Verificación física completa, por rol de usuario, con navegador real (2026-09-21)
- Fase 50 — Módulo de Tráfico de WhatsApp: plantilla real, carga, dashboard (2026-09-21)
- Fase 51 — Verificación final del módulo de Trafico de WhatsApp: código + base de datos + navegador (2026-09-22)
- Fase 52 — Fix real: la carga de WhatsApp por el modal "Cargar Datos de Dashboards" no reconocía el archivo (2026-09-22)
- Fase 53 — Subida manual guiada del archivo real de WhatsApp por la web (2026-09-22)
- Fase 54 — KPIs de WhatsApp desconectados en la franja global de ORLANT (2026-09-22)
- Fase 55 — Verificación final consolidada del módulo de Tráfico de WhatsApp (2026-09-22)
- Fase 56 — Carga real de Trafico de WhatsApp en producción (en curso, 2026-09-22)
- Fase 57 — Color por cola en las gráficas de Tráfico de WhatsApp (2026-09-22)
- Fase 58 — Unificación de ramas a main + auditoría completa de código, base de datos y verificación web (2026-09-22)
- Fase 59 — Confirmación de la Fase 58 + arreglo de los 2 hallazgos pendientes (2026-09-22)
- Fase 60 — Filtro "Skill" de Trafico de Llamadas: de listbox multi-select a desplegable (2026-09-22)
- Fase 61 — Investigación: qué de lo hecho para ORLANT se puede extender al resto de clientes (2026-09-23)
- Fase 63 — Unificación del tipo de pestañas/gráficas de ORLANT (Calidad, Tráfico de Llamadas, Tráfico de WhatsApp) en el resto de plantillas (2026-09-23)
- Fase 64 — Unificación de ramas, confirmación de producción, y auditoría completa (código + BD + navegador) (2026-09-23)
- Fase 65 — Resuelve los 3 hallazgos de la Fase 64 (dropdown Skill + AHT Promedio real) + revisión independiente con subagentes (2026-09-23)
- Fase 66 — Plantilla unificada de Tráfico para ORLANT (Llamadas + WhatsApp en un solo archivo) (2026-09-23)
- Fase 67 — Por qué producción seguía sirviendo la plantilla vieja de ORLANT, y prueba real de punta a punta en producción (2026-09-23)
- Fase 68 — Ajustes pedidos por Edwin en la revisión del 23/09 (vista mensual, quitar franja de KPIs de ORLANT, solo SL20, quitar Wait Time, y Tráfico de WhatsApp igual a Tráfico de Llamadas) (2026-09-24)
- Fase 70 — Inventario de ORLANT, causa del 403, y retiro de las apps móvil/escritorio (2026-09-24)
- Fase 71 — Prepara la hoja "resumen" de ORLANT antes de la base de Edwin + revisión de Calidad (2026-09-24)
- Fase 72 — Auditoría de seguridad y fallos (2026-09-24)
- Fase 73 — Limpieza de ramas (2026-09-24, sin PR de código)
- Fase 75 — Arregla lo que encontró la Fase 74 + pendientes chicos sin bloqueo (2026-09-25)
- Fase 76 — Cierra los 4 detalles que dejó la Fase 75 (2026-09-25, automática)
- Fase 78 — Agendas de ORLANT: citas asignadas por especialidad (2026-09-25, automática)
- Fase 77 — Reunión con Edwin (25/09): fixes de Tráfico + Tipificación de ORLANT (2026-09-25, automática)
- Fase 79 — La carga de Agendas/Tipificación falló en producción: causa real, arreglo y carga de los datos reales (2026-09-28, automática)
- Fase 80 — Carga real de Agendas/Tipificación en producción + cierre de pendientes (2026-09-28, automática)
- Fase 81 — Auditoría de seguridad y QA de toda la plataforma: inyección SQL + permisos + no-regresión (2026-09-28, automática)
- Fase 82 — Cierra el hueco de POST /dashboard/cargas que la Fase 81 dejó pendiente de decisión (2026-09-28, automática)
- Fase 83 — Cada usuario ve SOLO los módulos/pestañas/botones a los que tiene permiso (esconder, no mostrar en gris) (2026-09-28, automática)
- Fase 84 — Plantilla de Excel de ORLANT al día: una hoja por cada tipo de dato que ya se puede cargar (2026-09-28, automática)
- Fase 85 — "Exportar" del dashboard genérico no exportaba nada en ninguna pestaña (2026-09-28, automática)
- Fase 86 — 3 ajustes de la Fase 85: nada de commits directos a `main`, frenar fechas futuras al cargar, y que el selector "MES" mueva todas las pestañas (2026-09-28, automática)
- Fase 87 — Notas del jefe (nivel de servicio en Resumen, WhatsApp a 5 min, tipografía unificada) + 2 revisiones pendientes de la Fase 86 (2026-09-29, automática)
- Fase 88 — barrido de bugs después de las Fases 75-87, más revisión de exposición pública del repo (2026-09-29, automática)
- Fase 90 — WhatsApp con los DOS niveles de servicio (20 s y 5 min) + arreglar el selector de MES y las fechas (2026-09-30, automática)
- Fase 91 — encontrar por qué en producción el selector de MES solo mostraba Ago-26 (2026-09-30, automática)
- Fase 92 — poner a funcionar el dominio nuevo `https://informa.inconexion.com.co` (2026-09-29, automática)
- Fase 93 — quitar duckdns por completo: todo desde informa.inconexion.com.co (2026-09-29, automática)
- Fase 94 — Agendamiento como lo pidió Edwin + orden de pestañas + aviso de WhatsApp más claro + análisis de brecha de Calidad (2026-09-29, automática)
- Fase 95 — Calidad: lo que Edwin ya decidió (fecha/evaluador automáticos, codificación en lista, alerta al asesor) + versión 1.0 con CHANGELOG + limpieza del repo público (2026-09-30, automática)
- Fase 96 — activar la seguridad de GitHub que estaba apagada + CI sin Node 18/20 y con límite de tiempo (2026-09-30, automática)
- Fase 98 — Inasistencia de ORLANT: base real, pestaña con filtro por mes y por especialidad, y carga en producción (2026-09-30, URGENTE, automática)
- Fase 97 (continuación) — PAUSADA la parte de AWS; hecho lo que no depende de credenciales (2026-09-30)
- Fase 97 (continuación 2) — revisión del log de `verificar-logs-produccion` y corrección de los 2 workflows (2026-09-30)
- Fase 97 (continuación 3) — borradas las 40 corridas viejas de GitHub Actions con datos de producción (2026-09-30, autorizado explícitamente)
- Fase 99 — las opciones de los desplegables se veían en blanco (texto blanco sobre fondo blanco) (2026-09-30)
- Fase 100 — revisión final de ORLANT antes de entregar: 2 arreglos reales encontrados en producción (2026-09-30)
- Fase 101 — Inasistencia: la vista principal pasa a ser "Por mes" (total de todas las especialidades juntas) (2026-09-30)
- Fase 100 (continuación) — Tema B: guía de uso (2026-09-30)
- Fase 100 (continuación) — Tema C: monitor automático de producción (2026-09-30)
- Fase 100 (cierre) — lo que ve un usuario sin admin, confirmación de la plantilla, y verificación en vivo del monitor (2026-09-30)
- Fase 102 — escaneo completo de seguridad y bugs (2026-10-01)
- Fase 103 — dashboards de cliente a pantalla completa (2026-10-01)
- Fase 104 — ranking de agendamiento por asesor (2026-10-01)
- Fase 105 — #gd-modal no cubría el viewport exacto (2026-10-01)
- Fase 106 — Inasistencia solo en porcentaje, por mes (2026-10-01)
- Fase 108 — Inasistencia con la base nueva: por mes, filtros de sede/especialidad/entidad, resumen de todos los meses, barra por especialidad (2026-10-01)
- Fase 109 — Auditoría de las 3 escaladas de la Fase 102, Inasistencia en línea y acciones de workflows fijadas a SHA (2026-10-01)
- Fase 110 (URGENTE) — usuarios de ejemplo con contraseña pública seguían activos en producción (2026-10-02)
- Fase 111 — 2 bases nuevas de ORLANT: el ranking pasa a ser EFECTIVIDAD de agendamiento + Efectividad de citas atendidas (2026-10-02)
- Fase 112 — revisión general de toda la plataforma + reorganización completa del repo (2026-10-02)
- Fase 113 — registro de inicios de sesión + "Cambiar mi contraseña" + revisión diaria de la salud del servidor (2026-10-02)
- Fase 114 (URGENTE) — respaldos automáticos vueltos a activar (nunca se habían instalado en la instancia nueva) + alerta alta de Dependabot (SheetJS) resuelta (2026-10-02)
- Fase 115 — Tráfico de Llamadas de agosto y septiembre 2026, con la línea REGIMEN ESPECIALES (faltaba desde la Fase 67): lector al día (hoja "Hoja1", WAIT_TIME/AHT con fecha boxeada) y carga real en producción (2026-10-04)
- Fase 116 — Tráfico de WhatsApp (formato diario real de Wolkvox) y Tipificación (export completo HistCDR) de agosto y septiembre 2026, sin duplicados; fix real de un residuo huérfano por un defecto del reemplazo por rango de la Fase 115 (2026-10-04)
- Fase 117 — Revisión final integral (seguridad + bugs) antes de entregar ORLANT: 2 arreglos reales (orden del Historial, inyección de fórmulas en la plantilla de Calidad), resto de la plataforma verificado sin hallazgos nuevos (2026-10-05)
- Fase 118 — Cierra con evidencia lo que la Fase 117 dejó sin demostrar: matriz de acceso de las 113 rutas EJECUTADA (51 pruebas, reconfirma las 3 escaladas críticas de la Fase 102), privacidad del HistCDR completo EJECUTADA con valores centinela, verificación en producción con sesión real, 1 test flaky corregido; barrido visual/código muerto/XSS dinámico/zonas horarias quedan pendientes (2026-10-05)
- Fase 119 — Deja ORLANT lista para entregarla al cliente: recorrido en producción con la cuenta REAL del cliente (CLIENTES_DASH) confirmado por JWT, cargar un mes nuevo nunca daña los ya cargados (26 pruebas EJECUTADAS, las 7 bases), matriz de acceso de las 7 familias de carga masiva EJECUTADA (1 hallazgo real de bajo riesgo documentado: Tráfico de Llamadas sin campaignAccess por diseño), zonas horarias EJECUTADAS con procesos reales TZ=UTC/TZ=America-Bogota, guía de uso + checklist de aceptación + procedimiento de carga mensual al día; barrido visual/código muerto/XSS dinámico/fallas de UI siguen pendientes (2026-10-05)
- Fase 120 — Verificación dato por dato de los 3 archivos reales que envió InCo (Llamadas 150 filas, WhatsApp 258 filas, Tipificación 34.661) contra producción, recorriendo TODAS las sub-pestañas (no solo la que abre por defecto, el hueco real que dejaba pasar un AHT de WhatsApp en blanco sin que nadie lo notara); se quitó el AHT de WhatsApp (Wolkvox nunca lo entrega) con migración idempotente + reactivación sin tocar código; 2do hallazgo real: el ATA de Llamadas Y de WhatsApp se promediaba ponderado por el total en vez de por los abandonos reales (corregido, con el efecto numérico documentado); la revisión automática de cada PR ahora también confirma que un aviso de "sin datos" quede visible de verdad, no solo que el canvas esté escondido (2026-10-05)
- Fase 122 — Carga real de ORLANT de agosto-septiembre/2026 (Tipificación de WhatsApp, Agendas, Efectividad de Agendamiento) + pedidos de la reunión con Edwin (alias de nombre de asesor, nombre completo del mes); 3 hallazgos reales encontrados y corregidos al cargar los archivos reales (límite de tamaño de Agendas, el navegador sin responder con archivos grandes de 1 sola hoja, y un defecto que bloqueaba SIEMPRE el reconocimiento de Tipificación de WhatsApp) (2026-10-06)
- Fase 123 — Re-carga de TIPIFICACIONES.xlsx para consolidar el alias "_falla" (pendiente de la Fase 122) + identificación de otros 4 archivos reales de Descargas que ya coincidían con lo cargado (se dejaron sin tocar, decisión del usuario) (2026-10-06)
- Fase 124 — Revisión de errores y bugs probando la página real en producción (lo que la Fase 122 dejó sin cubrir: tema oscuro, 1920×1080, móvil, efecto real del alias, mes parcial de julio) + 1 vulnerabilidad crítica de npm audit corregida + 1 función muerta borrada + reorganización completa de la documentación (`docs/pendientes.md` en 5 secciones, `docs/README.md`, `docs/plantillas-inventario.md` nuevos) (2026-10-06)
- Fase 125 — Cierre de lo que la Fase 124 dejó sin hacer: corrección del margen de tamaño de carga (era por archivo, no acumulado) + aviso de carga demasiado grande antes de enviar + guía de uso y checklist de Edwin al día + XSS/exports/eje secundario del combo probados de verdad con Playwright contra la página real, no solo lectura de código (2026-10-06)
- Fase 126 — Pedido de Edwin: borrado de todos los meses de prueba de producción (Inasistencia Ene-Jul/2026, Efectividad de Citas Ene-Mar/2026, Agendas Abril/2025), con un endpoint nuevo de solo administrador (dry-run + conteo exacto obligatorio) construido para la ocasión; retiro del aviso de Nivel de Servicio a 5 minutos de WhatsApp y redacción simplificada del aviso de mes incompleto en Inasistencia; propuesta (sin programar) de un indicador de llamadas de salida (2026-10-06)
- Fase 127 — Indicador de Llamadas y WhatsApp de SALIDA (archivo mensual de Edwin): nueva pestaña "Salida" (tabla propia `salida_mensual`, confirmación explícita del año del mes antes de guardar, nunca en silencio); hallazgo real con Playwright contra un archivo sintético de la forma exacta del real (encabezado en la fila 3, 2 filas vacías antes) -- un archivo válido no se reconocía porque el buscador de encabezados por rango acotado solo miraba el primer renglón del rango usado de la hoja, corregido y cubierto con pruebas; carga real en producción sujeta a parada obligatoria y al "OK cargar" explícito del usuario (2026-10-06)
- Fase 128 — 4 pedidos de la reunión de validación con Edwin del 2026-10-06: Parte 1, pestaña "Salida" renombrada a "Llamadas y WhatsApp de salida" y reubicada junto a Tráfico de WhatsApp (migración idempotente nueva, reposición incondicional por el mismo criterio que `orden_pestanas_v2` -- hallazgo real: gatearla al label viejo habría dejado mal ubicada cualquier instalación nueva); Parte 2, corrección por construcción del hallazgo de privacidad de `revision-final.js` (`veredictoSubvista` ya nunca devuelve texto crudo del DOM, solo conteos/veredicto de lista fija -- cierra la clase completa del problema, no solo el caso de "Ranking de asesores"), con prueba automática nueva que confirma con un nombre ficticio que no se filtra; mismo criterio aplicado al resto de `scripts/produccion/`; Parte 3, nueva base `monitoreos` en el borrado por rango (mismo endpoint auditado de la Fase 126) para retirar los 37 monitoreos de prueba de Calidad confirmados por Edwin, con respaldo manual confirmado antes del cambio; Parte 4, housekeeping (30 ramas locales ya mergeadas, lockfile al día, `.gitignore` de la configuración local de Codex); verificación real en producción EJECUTADA (2026-10-07): `revision-final.js` corrido con sesión real del usuario (0 nombres, 0 discrepancias, Salida confirmada), y los 37 monitoreos de prueba de Calidad borrados de verdad tras el "sí" explícito del usuario sobre el conteo exacto (37, 2026-09) — Calidad de ORLANT queda en 0, "Sin datos" visible, 0 errores (2026-10-06/07)
- Fase 129 — Recarga de Inasistencia de ORLANT: incidente real de escritura accidental en producción (dry-run con `page.exposeFunction` -- corregido por construcción con `dry-run-seguro.js`), auditoría completa de privacidad del incidente (nunca llegó al repo/PR/CI), y hallazgo real nuevo (v1.15.1): una celda de fecha con formato Excel llegaba como objeto `Date` por un efecto secundario de `cellNF:true`, bloqueando en silencio cualquier re-carga del archivo completo -- corregido; Inasistencia restaurada al umbral de privacidad original (Ago-26 352 filas/54 entidades/11.189/786/7,45 %, ene-jul vueltos a borrar, septiembre intacto) (2026-10-07)
- Fase 130 — Calidad real de septiembre/2026 (95 monitoreos) + pedidos de la reunión con Edwin del 2026-10-07 (Inasistencia acepta "FECHA CITA"/normaliza SEDE 34, quita el aviso "incompleto", nueva gráfica de nombre+% promedio por asesor en Calidad) + 2 hallazgos reales corrigiendo la carga masiva de Calidad (filas de plantilla sin diligenciar, observaciones hasta 500 caracteres) + Parte 7: el limitador de tasa de la API ya no bloquea a toda una oficina por el error de una sola persona (ahora cuenta por usuario autenticado, no por IP); verificación final completa en producción (ADMIN y CLIENTES_DASH) EJECUTADA, con 2 traspiés reales documentados (límite de tasa agotado por corridas repetidas, autocompletado del navegador) antes de confirmarla en verde (2026-10-07)
- Fase 131 — Cliente Mobilize: pestañas "Flujo de Llamadas" y "Tipificación" reusando el motor de ORLANT, "Última actualización" visible en cada dashboard (naranja Mobilize/verde de marca el resto), carga real de septiembre/2026 verificada en producción (2026-10-08)
- Fase 132 — Marca InConexion®: logo real, favicon, teal oficial de marca (`#004150`) y tipografía Quicksand autoalojada; cambio puramente visual, 2 hallazgos de contraste pre-existentes documentados sin corregir (fuera de alcance, pertenecen a la Fase 121) (2026-10-08)
- Fase 134 — Solo ORLANT y MOBILIZE quedan en producción: borrado de los otros 12 clientes (0 filas de datos reales, solo plantilla vacía), migración idempotente `fase134_borrar_clientes_v1`; **incidente de proceso real** (cierre retroactivo en la Fase 137): el PR se mergeó y desplegó sin el dry-run ni el "OK borrar" planeados — verificación posterior reportó 0 pérdida de datos; regla nueva en `CLAUDE.md` a partir de esto (2026-10-08)
- Fase 135 — Auditoría completa de UI/UX y movimiento (solo auditoría, sin tocar producto ni producción): decisión de librería de movimiento con números reales (`motion` vendorizado, 22 KB gzip), inventario de consistencia contado con `grep`, 13 hallazgos con evidencia (bug de responsive en pestañas de ORLANT a 412px, CLS 0.81 al abrir un dashboard, Chart.js sin config de animación propia, 5 sistemas de modal sin transición compartida), línea base de rendimiento medida y plan de 8 PRs para la Fase 136 (2026-10-08)
- Fase 136 — Mejoras visuales y movimiento: ejecuta el plan de 8 PRs de la auditoría de la Fase 135 (F01 pestañas móviles, F02 CLS, tokens, base de movimiento sin vendorizar `motion` -- 49 KB gzip real, más del doble de lo estimado --, componentes base, F03 transición de pestañas + Chart.js, F09 microinteracciones, F08+F11 toast de login + pantalla completa, y F04 modales unificados con Escape, el PR de mayor riesgo, aprobado con "OK modales" tras 2 condiciones de progressive enhancement/reabrir-durante-salida); PR 9 (scroll) descartado sin candidato real; verificación de cierre en producción confirmó MOBILIZE/tema oscuro/modales/F01 en vivo, con 1 hallazgo sin resolver (inestabilidad real, no reproducible en local, al cambiar de pestaña en ORLANT -- documentado, no es regresión de esta fase) (2026-10-09)
- Fase 141 — Reunión con Edwin del 13/10: "Flujo de Llamadas"/"Flujo de WhatsApp" y Tipificación lado a lado (Parte A); corrección de Llamadas Únicas de septiembre (Parte B); mitad "Llamadas de salida" en la pestaña Llamadas Únicas de Mobilize (Parte C) (2026-10-13)
- Fase 142 — Carga real de Llamadas de salida de Mobilize (septiembre), rechazo de "NO CONTESTADAS" en Llamadas Únicas, y Nivel de Servicio de WhatsApp de ORLANT por rangos de minutos (2026-10-14)
- Fase 144 — Bloque A de UI/accesibilidad publicado: A1–A3 uno por uno (v1.34.1–1.34.3) y A4–A8 + A3b juntos en v1.34.4 por el 429 del registro de imágenes (2026-10-14)
- Fase 145 — Ajustes de Mobilize para la entrega: "ASA y ATA" + "AHT", "Llamadas Únicas y de Salida", sin aviso amarillo falso, % legibles en las tortas; verificado en producción (v1.35.0, 2026-10-14)
- Fase 146 — Auditoría de seguridad y bugs (0 críticos, 0 altos) + README y documentación al día (v1.36.1, 2026-10-14)
- Fase 147 — Reunión con Edwin del 14/10: meses con nombre, "Última actualización" en naranja, Calidad al final en Mobilize, Asesor para el cliente de Mobilize y filtro Tipo en salida (Parte A, v1.38.0); pestaña "Encuesta" de Mobilize con carga desde Cargar Datos (Parte B, v1.39.0; carga real hecha el 15/10: 45 encuestas de septiembre); tarjeta "Solución en primer contacto (FCR)" en Flujo de Llamadas (Parte C, v1.40.0); sub-pestaña "One & Done" (Parte D, v1.41.0) (2026-10-15)
- Fase 148 — Auditoría de solo lectura de `120ba7d..main` (#430–#433, #403): 0 críticos, 0 altos, 1 medio y 3 bajos, sin PR (2026-10-15)
- Fase 149 — Arreglos de la auditoría 148 (nombres de asesor en Llamadas Únicas por regla del servidor, límite de 8 MB para la Encuesta, Excel de la Encuesta sin exportación insegura), revisión del #434, barra de pestañas fija bajo el encabezado del tablero (v1.41.1, 2026-10-15)
- Fase 150 — Pendientes de la 149: "Última actualización" cuenta también Encuesta, Llamadas Únicas, Salida y WhatsApp por rangos; One & Done con meses en letras, error de red visible y su propio título al exportar; límite de 8 MB en Llamadas Únicas y WhatsApp por rangos; Excel de WhatsApp por rangos sin exportación insegura (v1.41.2, 2026-10-15)
- Fase 151 — Auditoría de seguridad completa (informe privado, fuera del repo) y arreglos: gestión de usuarios con límites sobre la cuenta destino y los permisos de gestión, lista de usuarios acotada por rol, cierre de sesión que invalida la sesión, cambio obligatorio de contraseñas asignadas, deploy solo desde main de este repo, Tráfico con control de campaña, protección de la rama main, verificación de restauración del respaldo local y ajustes menores; dato de contacto de los monitoreos de Calidad solo para roles internos (v1.41.3 → v1.42.3, 2026-10-16)
- Fase 152 — Mejora gráfica: tarjetas KPI ejecutivas y mes en curso parcial (B8+B3), colores de marca y líneas de meta en las gráficas (B1), "Ver datos" y fracción "3 de 45" en los tooltips (B9), móvil y tableta con filtros plegables, limpieza de estilos y coma decimal (B4), iconos SVG de Lucide (F10) (v1.43.0 → v1.47.1, 2026-10-16)
- Fase 153 (pasos 1–3, en curso) — Plantillas de cliente: registro de clientes en la base, listas por módulo desde el registro, catálogo de módulos y generador de layout con prueba de "foto" de ORLANT y MOBILIZE; propuesta en `docs/plantillas-cliente.md` (de #450, ya en main); pasos 4–6 esperan a Edwin (v1.47.2 → v1.47.4, 2026-10-16)
- Fase 156 — Bugs de la prueba de la carga de agosto de Mobilize: WAIT_TIME/AHT en los tres formatos (B2) y aviso de reemplazo del Flujo que cuenta solo los días del archivo (B1); B3 cerrado sin cambio (decisión de la Fase 116) y B4 era del script de prueba (v1.57.4 → v1.57.5, 2026-10-20)
- Fase 158 — Rendimiento: caché en memoria de las opciones de filtro de los dashboards (rutas `/opciones`), que se vacía con cualquier escritura en la base; mismos números (foto sin diferencias) (v1.59.1, 2026-10-21)
- Fase 159 — Flujo de Llamadas acepta el reporte nativo de la cola de Wolkvox (`HistQueue`), plantilla con sus 13 encabezados y pantalla de subida con cliente y mes fijos desde el Centro (v1.57.6 → v1.57.8, 2026-10-20)
- Fase 161 — Rendimiento antes de la carga con Edwin: la caché de opciones se vacía solo cuando cambian datos (triggers + `datos_version`), índices para las consultas de datos más lentas y caché de respuestas de datos por usuario; foto por rol sin diferencias (v1.59.2 → v1.59.4, 2026-10-21)
- Fase 160 — Tareas de Edwin para la primera carga: ASA y ATA en dos gráficas, ejemplos de la plantilla de WhatsApp, Aurora y HLM con Tráfico de WhatsApp en 2 hojas, Hospital La María creado (sin datos, solo admin), deploy que se salta si su commit ya no es la cabeza de main (v1.58.0 → v1.59.0, 2026-10-21)
- Fase 162 — Tope total de memoria (64 MB, `CACHE_DATOS_MAX_MB`) en la caché de respuestas de datos, que saca las entradas más viejas; `CLAUDE.md` corregido: Clínica Aurora y Hospital La María sí existen (v1.59.5, 2026-10-21)
- Fase 163 — Pedidos de Edwin del 21/10: la skill es por cliente y el Centro de cargas define el cliente; Llamadas de Salida con su plantilla (TIPO); Llamadas Únicas sin asesor = abandonada; nivel de servicio = promedio simple de SERVICE_LEVEL_20SEC; cada gráfica en su cuadro y un color por sección. Cargado por la interfaz: Flujo de agosto de HLM y Salida de agosto de Mobilize (v1.60.0 → v1.64.0, 2026-10-22)
- Fase 164 (lote 1) — Auditoría de diseño (solo lectura, base sintética) y primer lote: "Cerrar" visible en el teléfono y logo sin aplastar, torta de Tipificación sin colores repetidos y con coma decimal, Calidad por asesor con todos los nombres y un solo color; límite del job `pantallas` de CI de 5 a 15 minutos; revisado en producción a 375 px (v1.64.1 → v1.64.3, 2026-10-22)
- Fase 164 (lote 2) — Tablas con scroll enfocables con el teclado, títulos de gráfica como h3, áreas táctiles de 44 px en el teléfono, barras por especialidad en un solo color y tortas sin colores repetidos, porcentajes de las tortas sin montarse, emojis por iconos Lucide (los del inicio en blanco); actualización de seguridad de una dependencia; límite del job `pantallas` de CI de 15 a 20 minutos (v1.64.4 → v1.64.10, 2026-10-22/23)
- Fase 165 — WhatsApp por rangos de tiempo: lee el export de Wolkvox tal cual (ANSWER_TIME como texto, con apóstrofo o hh:mm:ss), avisos agrupados, cortes <180/<300/<480/<600, tablas por cola y por mes; títulos de salida más grandes; job `pantallas` en la imagen de Playwright por digest (#519); carga real de octubre de ORLANT: 5.196 conversaciones del 1 al 22/10 (v1.65.0, 2026-10-23)
- Fase 166 — Nivel de Servicio de WhatsApp visible aunque falte el Flujo del mes; incidente sin pérdida: octubre de ORLANT eliminado con "Eliminar" desde la cuenta compartida @admin y restaurado con Deshacer (5.196) (v1.65.1, 2026-10-23)
- Fase 167 — Filtro MESES: varios meses sueltos lado a lado en las gráficas y tablas por mes (las tarjetas siguen el MES); Escape ya no cierra el tablero; verificado en producción con septiembre y octubre (v1.66.0, 2026-10-23)
- Fase 168 — Tipificación con los 2 CDR de Wolkvox: HistChat de WhatsApp por SKILL_ID con mapa de skills por cliente (editable por un admin, semilla ORLANT; 0 = salida; desconocidos se ignoran con un aviso), "-" de llamadas = Llamadas de salida, ORLANT con Llamadas y WhatsApp lado a lado sin tabla de detalle; probado en local con los CDR reales de septiembre; recarga en producción de los 2 CDR de septiembre: WhatsApp 13.048 → 13.118 (3.997 de salida), llamadas 19.721 → 19.721 con 10.399 de salida (antes 0) (v1.67.0, 2026-10-23)
- Fase 169 — "Llamadas de salida" sale una sola vez en el filtro de skill de Tipificación de llamadas (LINEA DE SALIDA de meses anteriores + LLAMADAS DE SALIDA), sin tocar datos (v1.67.1, 2026-10-23)
- Fase 170 — Llamadas y WhatsApp de salida de ORLANT calculados con los CDR en los meses que los tienen, repartidos en 3P/General por la línea de cada asesor por mes (editor solo administrador; sin línea = "Sin asignar"); el resto de meses sigue con el archivo mensual (v1.68.0, 2026-10-23)
- Fase 171 — Pedidos de Edwin para Mobilize: "-" de salida = Llamadas de salida en Tipificación; llamadas de salida sin quitar repetidos ni filas sin agente (octubre: 85 = 45 + 40), sin el aviso de mes incompleto; Encuesta sigue el MES; cerrar sesión deja el tablero sin filtros; conectadas/no conectadas en azul/magenta; recarga en producción de la salida de octubre de Mobilize: 54 → 85 (45 conectadas, 40 no conectadas) (v1.69.0, 2026-10-23)
- Fase 172 — Calidad de Mobilize: carga "Calidad: resumen por asesor" con la plantilla de Edwin (valores calculados de fórmulas, aviso único si hay celdas en error, mes elegido al subir, clasificación y alerta recalculadas), panel al inicio de Calidad con promedio ponderado, monitoreos y fallos, tablas por asesor y por mes con semáforo, exportable; plantilla oficial con instrucciones (v1.70.0, 2026-10-23)
- Fase 173 — Tipificación de septiembre de Mobilize revisada en producción (sí está: 167 llamadas, cargada el 23/10 hacia las 2:13 p. m., después de agosto y octubre); el Centro de cargas mostraba la hora de carga 5 h tarde en producción (servidor en UTC), corregido (v1.70.1, 2026-10-23)
- Fase 174 — ORLANT: out_pre cuenta como llamada de salida (no como entrada de CANCELACIONES), "no conectada" por cliente (ORLANT NO_CONTESTAN + BUZON, Mobilize Cliente_no_contesta), salida por registro escrita como regla, plantillas de CDR con las 20/32 columnas de Wolkvox; septiembre local: 10.791 de salida, 5.104 no conectadas (v1.71.0, 2026-10-24)
- Fase 175 — Tablero en el celular: encabezado compacto hasta 768 px (354 → 151 px a 375 px), filtros plegados en el botón "Filtros: <mes>", Actualizar/Exportar solo con icono; escritorio idéntico píxel a píxel; sin desbordes en ORLANT y Mobilize a 375/768 px, claro y oscuro (v1.72.0, 2026-10-24)
- Fase 176 — Tablero en el celular (ajuste): a 375 px "Última actualización" en corto ("Act. 24/10 08:30") y el subtítulo sin " — CLIENTE", cada uno en una línea; encabezado de 166–180 a ~151 px en ORLANT y Mobilize; escritorio y tablet idénticos píxel a píxel (v1.72.1, 2026-10-24)
- Fase 177 — Arreglos de la auditoría de bugs y seguridad de v1.72.1: "-" del CDR es salida solo con `outbound_ma`/`out_pre` (septiembre de ORLANT sin cambios, 10.791), meses 01–12, puntaje en fracción del Resumen de calidad, caches de Tipificación y Salida tras cargar; el resto, a `docs/pendientes.md` (v1.72.2, 2026-10-24)
- Fase 178 — Arreglos preventivos: Deshacer / Eliminar del Centro de cargas (y la carga) vuelven a armar el tablero abierto con el mismo MES, MESES y pestaña; los meses que solo tienen Resumen de calidad, Encuesta, WhatsApp por rangos o Llamadas de salida entran en el MES y en MESES; `GET /umbrales` filtrado por los clientes de cada usuario; segundo límite de login solo por usuario (30 fallidos por hora) con "LOGIN_BLOQUEADO" en el Historial; pruebas de casos de borde de las Fases 165–177; revisión preventiva (respaldo, certificado, disco, Node; logs sin permiso de lectura) y guía de uso al día con las Fases 165–178 (v1.72.3, 2026-10-26)
- Fase 179 — Resumen de calidad: las filas TOTAL / PROMEDIO (y variantes) al final de la plantilla se omiten con aviso en vez de contarse como asesor (v1.72.4, 2026-10-26)
- Fase 180 — El admin maestro queda fuera del tope de 30 logins fallidos por hora (no se puede bloquear a propósito); sigue con el límite por IP + usuario (v1.72.5, 2026-10-26)
- Fase 181 — Mantenimiento: express 5.3.0 y @aws-sdk 3.1156 (sin tocar better-sqlite3 ni dotenv; playwright espera OK porque toca CI); pendientes nuevos: paso a Node 24 antes del 30/04/2027 y prueba mensual de restauración del respaldo (v1.72.6, 2026-10-26)
- Fase 182 — Mantenimiento: playwright 1.64.1 con la imagen del job `pantallas` de CI fijada al digest de v1.64.1-noble (con OK del usuario), express-rate-limit 8.7.1 y supertest 7.3.1 (v1.72.7, 2026-10-26)
