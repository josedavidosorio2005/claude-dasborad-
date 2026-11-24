# Equidad de profesionales (ORLANT): propuesta sin los archivos de Isa

> Plan de acción ORLANT del 20/11/2026, punto **A6**: «pasar el HTML que ya tiene Isa a una pestaña de
> SinCo con carga semanal del mismo Excel». Entrega pedida: **viernes 27/11/2026**.
> Este documento y la plantilla son una **propuesta con datos inventados**: se ajustan cuando llegue la
> matriz real de Isa. Nada de esto toca producción.

## 1. Qué mide (hipótesis, a confirmar con Isa)

«Equidad» = cómo reparte cada profesional su agenda entre los grupos de pacientes:

- **PARTICULAR**
- **POLIZA SURA**
- **OTRAS ENTIDADES**

Son los tres grupos de los archivos de Isa de octubre. La pregunta que responde el tablero es: **¿cada
profesional da a cada grupo la parte de la agenda que le corresponde, y la reparten parejo entre sí?**

## 2. Indicadores propuestos

Siempre se suman los conteos del periodo y se divide al final; nunca se promedian porcentajes (misma
regla que Total tráfico).

| Indicador | Fórmula | Nota |
|---|---|---|
| Cupos ofertados | suma de `CUPOS_OFERTADOS` | por profesional, grupo, sede, especialidad |
| Citas asignadas | suma de `CITAS_ASIGNADAS` | |
| Ocupación | citas asignadas ÷ cupos ofertados | |
| Participación del grupo | citas (o cupos) del grupo ÷ total del profesional | ¿sobre cupos o sobre citas? (pregunta 3) |
| Brecha vs. meta | participación − meta del grupo, en puntos | solo si hay meta (pregunta 4) |
| Reparto entre profesionales | citas del profesional ÷ promedio de su especialidad | resalta a quien queda por encima o por debajo de un umbral |
| Asistencia (opcional) | citas atendidas ÷ citas asignadas | solo si el Excel lo trae |

## 3. Estructura de la pestaña

Una pestaña nueva, **«Equidad de profesionales»**, con los filtros de siempre del tablero (MESES,
desde/hasta). Además trae sus propios filtros: **semana**, **sede**, **especialidad** y **grupo**.

1. **Tarjetas** (vista gerencial):
   - cupos ofertados;
   - citas asignadas;
   - ocupación;
   - participación de cada grupo, con la meta al lado si existe.
2. **Barras apiladas por profesional:** reparto de citas por grupo (PARTICULAR / POLIZA SURA / OTRAS
   ENTIDADES), al 100 %, ordenadas de mayor a menor brecha.
3. **Tabla por profesional:**
   - sede, especialidad, cupos, citas y ocupación;
   - % de cada grupo y la brecha;
   - semáforo: verde si está dentro de la meta, ámbar si se aleja hasta 5 puntos y rojo si se aleja más
     (los umbrales se confirman con Isa).
4. **Tendencia semanal:** participación de cada grupo por semana, para ver si se corrige.
5. **Exportar a Excel** y PDF con el mismo motor del tablero.

Diseño con los tokens de `docs/sistema-de-diseno.md` (tema claro y oscuro, AA). Se revisa a 375, 768 y
1440 px; en el celular, la tabla pasa a tarjetas.

## 4. Dónde va en el menú de ORLANT

- En el **tablero actual de ORLANT** (no en el nuevo, que sale el 9/12), como pestaña nueva **después
  de «Gestión de la base STA»**. Usa el mismo patrón de la Fase STA: una migración idempotente
  (`runOnceMigration`) agrega la pestaña al layout de ORLANT, oculta, y el tablero la destapa en memoria
  cuando hay datos cargados.
- El tablero de ORLANT está **congelado**. Agregar esta pestaña necesita la misma excepción que se dio
  para STA (solo una pestaña nueva; no cambia ninguna pestaña, cifra ni permiso existente).
- Icono en el menú lateral: `i-users` (regla `/equidad/` en `GD_MENU_ICONOS`).
- Cuando exista el tablero nuevo (Entrega 1), la misma pestaña se puede montar en **Back office**,
  reusando el panel, sin duplicar la lógica.

## 5. Permisos (quién lo ve y quién lo carga)

| Quién | Ve la pestaña | Carga el Excel | Ve el detalle por profesional |
|---|---|---|---|
| Administrador | Sí | Sí | Sí |
| Isa / supervisor de ORLANT con el módulo «Equidad» | Sí | Sí (Centro de cargas) | Sí |
| Gerencia | Sí | No | Sí |
| Cuenta cliente ORLANT | **Por decidir** (pregunta 7) | No | Por decidir |
| Asesor | No | No | No |

- Permiso de carga nuevo por módulo (`equidad`), como los demás módulos del Centro de cargas: quien no lo
  tiene no ve la carga ni la plantilla.
- Al principio la pestaña queda **oculta, solo para el administrador** (como Aurora y HLM). Se destapa
  para los demás con el OK del usuario y de Edwin.

## 6. Carga semanal

- **Centro de cargas → ORLANT → «Equidad de profesionales»**, con la plantilla de §7.
- Propuesta: cada carga **reemplaza las semanas (por FECHA) que trae el archivo**, todo o nada, con
  respaldo y «Deshacer» de 30 días (como el resto del Centro de cargas), y las demás semanas no se tocan.
  Así, volver a subir una semana corregida no duplica.
- El lector reconoce el archivo por sus encabezados, nunca por el nombre del archivo ni de la hoja.
- Si Isa sigue trabajando con **3 archivos** (uno por grupo), el lector puede aceptar los 3 y poner el
  grupo según el archivo. Esto se decide al ver su matriz (pregunta 2).
- Sin datos de pacientes: solo conteos por profesional, día y entidad.

## 7. Plantilla propuesta

`docs/orlant/equidad/PLANTILLA_EQUIDAD_PROFESIONALES_PROPUESTA.xlsx` (datos **inventados**: «Profesional
A…F», «Sede 1/2», «Entidad X/Y»). Se regenera con `node scripts/orlant/equidad-plantilla-propuesta.js`.
No está en el catálogo de Cargar Datos todavía: entra ahí cuando el formato quede cerrado con Isa.

| Columna | Qué va | Ejemplo |
|---|---|---|
| `FECHA` | Día de la agenda (AAAA-MM-DD) | 2026-11-16 |
| `SEDE` | Sede del profesional | Sede 1 |
| `ESPECIALIDAD` | Especialidad en esa agenda | Otorrinolaringología |
| `PROFESIONAL` | Nombre o código del profesional | Profesional A |
| `GRUPO_ENTIDAD` | PARTICULAR, POLIZA SURA u OTRAS ENTIDADES | POLIZA SURA |
| `ENTIDAD` | Entidad o plan exacto (vacío en PARTICULAR) | Entidad X |
| `CUPOS_OFERTADOS` | Cupos abiertos para ese grupo/entidad | 12 |
| `CITAS_ASIGNADAS` | Citas asignadas en esos cupos | 10 |
| `CITAS_ATENDIDAS` | Citas atendidas (opcional) | 9 |

## 8. Preguntas para Isa

1. ¿Nos pasas el **HTML de Equidad** y **una o dos semanas de tu Excel**? Se usan solo en local y fuera
   del repo, como las demás bases reales.
2. ¿Sigues con **3 archivos** (Particulares, Póliza SURA, Otras entidades) o puedes llenar **uno solo**
   con la columna de grupo?
3. ¿La equidad se mide sobre los **cupos ofertados** o sobre las **citas asignadas**? ¿Tu Excel trae los
   dos?
4. ¿Hay una **meta** por grupo (por ejemplo «X % de la agenda para Póliza SURA»)? ¿Es igual para todos o
   cambia por especialidad, sede o profesional?
5. ¿Qué cuenta como «desequilibrio»? ¿Desde cuántos puntos de diferencia se marca en ámbar y en rojo?
6. ¿El Excel es **por día**, **por semana** o **por mes**? Si es semanal, ¿la semana va de lunes a
   domingo? Si subes la misma semana corregida, ¿debe **reemplazar** la anterior (propuesta) o
   **sumarse**?
7. ¿**Quién la ve**? ¿Solo el equipo interno (tú, Edwin, gerencia) o también la **cuenta cliente de
   ORLANT**? Si la ve el cliente, ¿con el nombre del profesional o con un código?
8. ¿**Quién la carga** cada semana, y qué día?
9. ¿Qué hace hoy tu HTML que deba quedar **igual**: gráficas, cálculos, colores, el orden?
10. ¿Los nombres de los profesionales y de las entidades vienen siempre escritos igual? ¿Hay una lista
    maestra con la que podamos comparar?
11. ¿Qué periodo histórico quieres ver al arrancar? ¿Desde octubre?

## 9. Fases (cuando lleguen los archivos)

| Paso | Qué | Horas |
|---|---|---|
| EQ1 | Lector del Excel real + tabla + carga en el Centro de cargas (permiso `equidad`), con pruebas | 2 |
| EQ2 | Pestaña oculta en ORLANT (migración), tarjetas, barras, tabla y tendencia, con pruebas | 2,5 |
| EQ3 | Revisión con Isa en local (375/768/1440, claro y oscuro), ajustes, PR | 0,5 |
| Total | | 5 (lo del plan) |

Riesgo para el 27/11: si los archivos llegan después del miércoles 25/11, no alcanza la revisión con Isa
antes del viernes.
