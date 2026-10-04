# PROGRESS — InConexión Platform

Fuente de verdad del avance. Desde la Fase 112, este archivo es un
**resumen corto, que se actualiza en el sitio** (no aditivo) — el detalle
narrativo de cada fase, fase por fase, vive en
[`docs/historico/progress-fases.md`](docs/historico/progress-fases.md)
(aditivo, nunca se reescribe — ver `CLAUDE.md` → "Bitácora").

## Estado actual

- **Versión**: `1.10.1` (ver `server/package.json`, expuesta en
  `/api/health` y en el menú de usuario de cada página).
- **Producción**: `https://informa.inconexion.com.co` (único dominio
  desde la Fase 93, 29/09/2026).
- **Foco actual**: solo **ORLANT** tiene datos reales en producción.
  Clínica Aurora y Hospital La María siguen en cero.
- **Pestañas y bases de ORLANT**: 7 pestañas con datos reales (Tráfico de
  Llamadas, Tráfico de WhatsApp, Tipificación, Agendas, Inasistencia,
  Efectividad de Agendamiento, Efectividad de Citas) + Calidad transversal
  — detalle completo (hoja, columnas, de dónde sale, qué pestaña
  alimenta) en [`docs/inventario-bases-orlant.md`](docs/inventario-bases-orlant.md).
  Pestañas ocultas esperando datos de Edwin: ver
  [`docs/pendientes.md`](docs/pendientes.md).
- **Infraestructura**: estado vigente (cuenta AWS, recursos, pipeline) en
  [`docs/infraestructura.md`](docs/infraestructura.md).
- **Pendientes**: un solo lugar, [`docs/pendientes.md`](docs/pendientes.md)
  (de Edwin, de AWS, decisiones del usuario, mejoras propuestas).

### Números de control (ORLANT, última verificación Fase 115, 2026-10-04)

Reconfirmados en vivo contra producción en la Fase 112
(`scripts/produccion/revision-final.js`, con sesión real del usuario):
0 discrepancias, 0 errores de consola, las 7 pestañas sin canvas sin
dibujar (Calidad mostró su aviso normal de "sin datos" para el mes
global sin monitoreos — comportamiento esperado, no un fallo). Se vuelven
a confirmar en cada revisión final y pueden moverse mes a mes con cargas
nuevas de Edwin:

| Indicador | Valor |
|---|---|
| Tipificación | 14.940 |
| Tráfico de Llamadas (Fase 115: Ago-26+Sep-26, 3 líneas — 3P/GENERAL/REGIMEN ESPECIALES) | 17.954 / 16.844 / 1.110 |
| Tráfico de WhatsApp | 7.305 / 7.109 / 196, SL20 34,67 % |
| Agendas | 7.426 (General 4.643 / 3P 2.783) |
| Inasistencia | Ago-26 7,45 %, período 6,87 % |
| Efectividad de agendamiento | Sep-26 44,81 % (18.566 / 8.319) |
| Efectividad de Citas | Ene 93,67 %, Feb 84,32 %, Mar 85,54 %, período 86,01 % |

## Índice — fases 0 a 113

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
- Fase 29 — Auditoría general de la plataforma ("Radiografía InConexión") + 4 mejoras técnicas (2026-09-17)
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

