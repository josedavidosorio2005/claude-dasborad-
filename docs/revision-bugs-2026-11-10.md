# Revisión de bugs — 10/11/2026 (Fases 311–314, PRs #739–#742)

Revisión de código + producción **en solo lectura** (v1.156.0), sin cargar, borrar ni cambiar
datos. Sin datos reales en este documento (solo cifras agregadas). El arreglo de los hallazgos 1, 2
y 3 está en el PR de la Fase 315 (v1.156.1), **sin mergear**: lo decide el usuario.

## Hallazgos

| # | Hallazgo | Severidad | Dónde | Arreglo propuesto |
|---|---|---|---|---|
| 1 | La cuenta cliente de Aurora recibe por la API el **nombre de los agentes** de las tortas de líneas internas (el HistChat trae nombres de personas). Aurora oculta los asesores al cliente (Fase 287) y Tipificación lo cumple; las rutas nuevas no. | **Alta** | `GET /calidad/aurora-li-cdr/datos` y `/aurora-li-whatsapp/datos` (`server/routes/aurora-bases.js`) | **En el PR (Fase 315):** con `ocultaAsesores` el cliente recibe las filas sin agente, sumadas por mes/skill/tipo/tipificación (mismos conteos) y la torta no muestra el filtro de agente. Prueba `fase315-li-privacidad-cliente`. |
| 2 | Datos viejos tras una carga de otra sesión: al abrir o actualizar el tablero se vacía la caché de Agendas pero no la de Gestión líneas internas ni la de Inasistencia/Encuestas. Si el supervisor sube septiembre con el tablero ya abierto, MESES muestra septiembre y esas gráficas siguen sin él hasta recargar la página (F5). Los filtros de las tortas también quedaban puestos al reabrir. | Media | `_gdBootstrap` (`public/js/dashboard-generic.js`); `_abCache`, `_liCache`, `_liEstado` | **En el PR:** vaciar `_abCache` y `_liCache` en `_gdBootstrap` (como `_auCache`) y limpiar `_liEstado` al abrir de nuevo. Toca también la frescura de Inasistencia/Encuestas (solo cuándo se piden los datos, no las cifras). |
| 3 | Un **HistCDR subido en la casilla de WhatsApp** se aceptaba como WhatsApp (comparten AGENT_NAME, DATE, DESCRIPTION_COD_ACT y SKILL_ID). Las demás combinaciones equivocadas ya se rechazaban. | Media | `_liTipifParse` (`public/js/lineas-internas-logic.js`) | **En el PR:** rechazar con mensaje claro si trae columnas que delatan la otra base (TYPE_INTERACTION/TELEPHONE/SKILL_NAME en WhatsApp; CHANNEL/DATE_CLOSE en CDR). Con las bases reales siguen pasando 752 / 1.787. |
| 4 | Celular (375): las 4 tarjetas del flujo salen una por fila. Causa: `.aurora-kpis` es una grilla `repeat(auto-fill, minmax(160px, 1fr))`; a 375 el panel mide ~280 px y solo cabe 1 columna. La regla de la Fase 311 usaba `flex` y no aplica a una grilla. | Baja | `public/css/styles.css` (`.aurora-kpis`, `.li-kpis`) | No aplicado. Propuesta: `@media (max-width:600px){#gd-panels .aurora-kpis.li-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}` (igual que `.ls-kpis`) y quitar la regla de flex. |
| 5 | Flujo sin datos para los meses elegidos con «Todas»: el aviso dice «Sin datos de esta área…». | Baja | `_liRenderFlujo` (`public/js/lineas-internas.js`) | Texto según el botón: «Sin datos de líneas internas para los meses elegidos» con «Todas». |
| 6 | Un archivo con filas de dos meses reemplaza los dos meses, aunque se haya pulsado «Subir» en uno solo (el diálogo sí lista cada mes antes de confirmar). Igual que Inasistencia/Encuestas. | Baja | `abGuardarCarga` / `server/aurora-bases.js` | Avisar (o rechazar) si el archivo trae meses distintos al del botón. |
| 7 | No hay enlace directo ni botón Atrás para la vista (ni para ninguna pestaña): la plataforma no guarda la pestaña en la URL; Atrás sale del tablero. Al reabrir, arranca en la primera pestaña y el botón no queda marcado. | Baja (informativo) | `public/js/dashboard-generic.js` | Si se quiere: guardar la pestaña en la URL (`?tab=`) para todas las pestañas a la vez, en otra fase. |

## Revisado sin problemas

- **Botón «Gestión líneas internas»** (producción): solo aparece en Clínica Aurora (no en ORLANT,
  Mobilize, HLM ni SURA); abre la vista, queda marcado y se desmarca al volver a una pestaña; al
  cerrar y reabrir el tablero vuelve a la primera pestaña sin estado raro; no tapa nada ni da scroll
  horizontal (375/768/1440, claro y oscuro, Fase 314). La cuenta cliente de Aurora **sí lo ve**
  (misma visibilidad que la pestaña de antes).
- **Nivel de atención**: total 0 → «—» (sin NaN ni división por cero, `traficoPctAtencionAbandono`
  devuelve null); área sin datos → «sin datos», sin romper; «Todas» suma las áreas (octubre
  181/230 = 78,7 %). **Excel** exportado desde producción: Enfermería 10,53, Farmacia 94,29,
  Patología 84,21, Programación 95,45, Reportes Médicos 70,83 (coinciden con la pantalla). El PDF
  usa la misma tabla (no se descargó).
- **Tortas**: filtros combinados (skill + tipo salida) → «Sin llamadas de salida con estos
  filtros.», sin error, y la torta de WhatsApp no cambia (cada torta tiene su estado); ningún skill
  con código suelto en los filtros.
- **Cargas**: subir otra vez el mismo mes reemplaza (no duplica, con Deshacer); archivo vacío o
  base equivocada → error claro (salvo el #3); ASESOR y CLIENTE → 403; SUPERVISOR solo en sus
  campañas (otra campaña → 403) — pruebas `fase311` y `fase315`.
- **Regresión**: la Tipificación de Aurora tiene los mismos conteos por skill (4166 = Área
  Programación, 4169 = Área Patología; prueba `fase275`). Recorridas en producción todas las
  pestañas de ORLANT (9), Mobilize (6), Aurora (9), HLM (3) y SURA Televentas: **0 errores de
  consola y 0 peticiones fallidas**.
- Durante la revisión, producción ya mostraba septiembre cargado por el supervisor (las tortas
  suman más meses); no se tocó nada.
