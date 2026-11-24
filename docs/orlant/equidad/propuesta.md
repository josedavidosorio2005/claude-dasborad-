# Equidad de agendamiento (ORLANT): propuesta ajustada al formato de Isa

> Plan de acción ORLANT del 20/11/2026, punto **A6**: «pasar el HTML que ya tiene Isa a una pestaña de
> SinCo con carga semanal del mismo Excel». Entrega pedida: **viernes 27/11/2026**.
> Ajustada el 24/11 con los 3 Excel de octubre, los 3 Excel de noviembre y el HTML de noviembre de Isa. Se leyeron **en local y solo
> en su estructura**; ningún dato real está en este repo. Los ejemplos de aquí son **inventados**.

## 1. Qué mide (confirmado con el HTML de Isa)

«Equidad de agendamiento»: si las **citas de primera vez de otorrino** se reparten **parejo entre los
médicos**. El HTML no usa metas ni semáforo: compara a cada médico con el **promedio de citas por
médico**. Tiene 3 hojas, una por grupo:

- **Prepagadas** (el archivo «OTRAS ENTIDADES»);
- **Particulares**;
- **Póliza SURA**.

## 2. Formato real del Excel

Isa manda **3 archivos**, uno por grupo, siempre con hoja `Sheet` y **una fila por cita** (no una matriz
ya armada; no trae cupos, solo citas). Llegaron en **dos formatos**:

- **Completo (octubre): 17 columnas**, la exportación de citas tal cual (tabla de abajo).
- **Corto (noviembre): 6 columnas**: `CODIGO_SEDE`, `NOMBRE_EXAMEN`, `ESPNOM`, `MEDNOM`,
  `FECHA_CITA`, `NOMBRE_ENTIDAD`. Ya viene filtrado por Isa (una especialidad, consulta de primera
  vez) y **sin código de médico, usuario ni observaciones**. **Su HTML de noviembre se arma con este
  formato** (sede, médico, fecha y entidad; la entidad solo en Prepagadas y Póliza SURA).

El lector acepta **los dos** (se reconocen por los encabezados). Con el corto, el médico se agrupa por su
nombre (normalizado: mayúsculas, sin tildes ni espacios de más), porque no trae código.

- El archivo de Póliza SURA trae además una tabla dinámica (`Hoja1`, citas por médico), que el lector
  ignora.

| Columna | Qué es | Se guarda |
|---|---|---|
| `CODIGO_SEDE` | SEDE PRINCIPAL / SEDE POBLADO | Sí |
| `CODIGO_EXAMEN`, `NOMBRE_EXAMEN` | Examen (consulta de primera vez por especialista en otorrino) | Sí, para filtrar |
| `CITESP`, `ESPNOM` | Especialidad | Sí, para filtrar |
| `CITMED`, `MEDNOM` | Código y nombre del médico (siempre emparejados: 1 código = 1 nombre) | Sí (se agrupa por código) |
| `CITTIP`, `CITTIR` | Tipo de cita y tipo de tercero (`P` particular, `E` entidad) | `CITTIP` sí; `CITTIR` no |
| `CITUSU` | Usuario que agendó | No (el HTML no lo usa; ver pregunta B) |
| `FECHA_SOL`, `HORA_SOL` | Cuándo se pidió la cita | No (el HTML no lo usa) |
| `FECHA_CITA`, `HORA_CITA` | Día y hora de la cita | Sí (la fecha manda en filtros y gráficas) |
| `CODIGO_ENTIDAD`, `NOMBRE_ENTIDAD` | Entidad o prepagada | Sí en Prepagadas y Póliza SURA. **En Particulares no**: casi un valor distinto por fila; parece un dato del paciente (pregunta A) |
| `CITOBSOBS` | Observación en texto libre | **Nunca** (puede traer datos del paciente) |

- Lo que no se guarda se descarta en memoria, antes de escribir en la base.
- Dos archivos de ejemplo con el **mismo formato y valores inventados**, 3 hojas cada uno (una por
  grupo): `docs/orlant/equidad/EJEMPLO_EQUIDAD_FORMATO_REAL_INVENTADO.xlsx` (completo, 17 columnas) y
  `docs/orlant/equidad/EJEMPLO_EQUIDAD_FORMATO_CORTO_INVENTADO.xlsx` (corto, 6 columnas). Se generan
  con `node scripts/orlant/equidad-ejemplo-inventado.js`.

## 3. Cálculos (los mismos del HTML)

Se calculan por grupo, sobre las citas que cumplen los filtros: sede, médico y fecha de cita desde/hasta.

| Indicador | Cálculo |
|---|---|
| Citas agendadas | número de citas |
| Médicos con citas | médicos distintos |
| Promedio por médico | citas ÷ médicos (redondeado) |
| Sede Principal / Sede Poblado | citas de cada sede y su % |
| Médico con mayor participación | el de más citas y su % del total (frase de resumen arriba) |
| Citas por médico | por sede (apilado) y total, con su % del total |
| Citas por entidad | solo Prepagadas: citas y % de cada entidad |
| Citas por fecha de cita | número de citas por día |

**Propuesta para SinCo (no está en el HTML):** una columna «vs. promedio» en la tabla de detalle, con la
diferencia de cada médico frente al promedio. Va en color neutro, porque no hay meta; se pinta con
semáforo solo si Isa define un margen (pregunta 5).

## 4. Pantalla

Una pestaña **«Equidad de agendamiento»** con 3 sub-pestañas (Prepagadas, Particulares y Póliza SURA),
igual que el HTML.

1. **Frase de resumen:** «Citas del … al … El médico … concentra el …% de las citas, frente a un promedio
   de … citas por médico».
2. **Filtros:** sede, médico, fecha de cita desde/hasta y «Limpiar filtros».
3. **Tarjetas:** citas agendadas, médicos con citas, promedio por médico, Sede Principal y Sede Poblado.
4. **Citas por médico:** barras apiladas por sede, con una línea punteada en el promedio.
5. **Distribución por sede**, **citas por entidad** (solo Prepagadas) y **citas por fecha de cita**.
6. **Detalle por médico:** Principal, Poblado, Total, Participación % y, como propuesta, «vs. promedio».
7. Exportar a Excel y PDF con el motor del tablero.

Colores de la plataforma, no los azules del HTML: paleta categórica de `docs/sistema-de-diseno.md` para
las sedes y las entidades, sin colores de semáforo, en tema claro y oscuro y con contraste AA. Se revisa a
375, 768 y 1440 px; en el celular, la tabla pasa a tarjetas. Maqueta con datos inventados:
`docs/orlant/equidad/maqueta.html`.

## 5. Dónde va en el menú de ORLANT

- En el **tablero actual de ORLANT**, **después de «Gestión de la base STA»**. Usa el patrón de la Fase
  STA: una migración idempotente (`runOnceMigration`) agrega la pestaña oculta, y el tablero la destapa
  en memoria cuando hay citas cargadas.
- El tablero de ORLANT está **congelado**: hace falta la misma excepción que se dio para STA (solo una
  pestaña nueva; no cambia ninguna pestaña, cifra ni permiso existente).
- Icono en el menú lateral: `i-users` (regla `/equidad/` en `GD_MENU_ICONOS`).
- En el tablero nuevo (Entrega 1, 9/12), la misma pestaña puede ir en **Back office**, reusando el panel.

## 6. Permisos

| Quién | Ve la pestaña | Carga los Excel |
|---|---|---|
| Administrador | Sí | Sí |
| Isa / supervisor de ORLANT con el módulo «Equidad» | Sí | Sí (Centro de cargas) |
| Gerencia | Sí | No |
| Cuenta cliente ORLANT | **Por decidir** (pregunta 7) | No |
| Asesor | No | No |

- Habrá un permiso de carga nuevo por módulo (`equidad`).
- Al principio la pestaña queda **oculta, solo para el administrador**, y se destapa con el OK del
  usuario y de Edwin.

## 7. Carga

- **Centro de cargas → ORLANT → «Equidad de agendamiento»**, con **3 cargas**, una por grupo:
  Prepagadas, Particulares y Póliza SURA.
  - El archivo no trae una columna de grupo, y el grupo no se puede deducir con seguridad.
  - Quien carga elige el grupo, igual que hoy Isa tiene 3 archivos.
- El archivo se reconoce **por sus encabezados** (los 17 del completo o los 6 del corto), nunca por su
  nombre ni por el de la hoja.
- Propuesta: cada carga **reemplaza los meses (por fecha de cita) que trae el archivo, de ese grupo**. Es
  todo o nada, con respaldo y «Deshacer» de 30 días, como el resto del Centro de cargas. Así, subir cada
  semana el mes en curso, cada vez más completo, no duplica nada (pregunta 6).
- Avisos de la carga, que no bloquean:
  - filas con otro examen u otra especialidad;
  - citas repetidas del mismo médico a la misma fecha y hora (en octubre hubo entre 10 y 15 por archivo;
    con el formato corto se revisan igual, con la hora de `FECHA_CITA`);
  - filas sin médico o sin fecha de cita.

## 8. Las 11 preguntas: qué quedó respondido con los archivos

| # | Pregunta | Estado |
|---|---|---|
| 1 | ¿Nos pasa el HTML y su Excel? | **Respondida**: los 3 Excel de octubre y el HTML de noviembre |
| 2 | ¿3 archivos o uno? | **Respondida**: 3 archivos con el mismo formato y sin columna de grupo → 3 cargas |
| 3 | ¿Sobre cupos o sobre citas? | **Respondida**: sobre citas (el archivo no trae cupos) |
| 4 | ¿Hay meta por grupo? | **Respondida**: el HTML no usa metas; compara con el promedio por médico |
| 5 | ¿Desde cuántos puntos es desequilibrio? | **Sigue para Isa**: el HTML solo marca la línea del promedio. ¿Quiere un margen (por ejemplo ±20 % del promedio) con color? |
| 6 | ¿Por día, semana o mes? ¿Reemplaza o suma? | **En parte**: el Excel es de un mes completo y el HTML del mes en curso. **Confirmar** que cada semana sube el mes a la fecha y que debe reemplazar ese mes |
| 7 | ¿La ve el cliente ORLANT? ¿Con el nombre del médico? | **Sigue para Isa (y Edwin)** |
| 8 | ¿Quién la carga y qué día? | **Sigue para Isa** |
| 9 | ¿Qué debe quedar igual que en su HTML? | **Respondida**: los indicadores, gráficas y filtros de §3 y §4 (los colores pasan a los de la plataforma) |
| 10 | ¿Los nombres vienen siempre igual? | **Respondida**: en octubre cada código de médico tiene un solo nombre. Con el formato corto (sin código) se agrupa por nombre normalizado |
| 11 | ¿Desde qué mes el histórico? | **Sigue para Isa**: ¿se carga octubre como arranque? |

**Preguntas nuevas para Isa** (salieron al ver los archivos):

- **A.** En Particulares, `CODIGO_ENTIDAD`/`NOMBRE_ENTIDAD` cambia en casi cada fila. ¿Es un dato del
  paciente? Si es así, no se guarda (propuesta).
- **B.** ¿Quiere ver también la equidad por **usuario que agenda** (`CITUSU`) o solo por médico?
- **C.** Las citas repetidas del mismo médico a la misma fecha y hora, ¿son reales (sobrecupo) y cuentan
  todas, o se cuentan una vez?
- **D.** Unas pocas filas tienen otra especialidad (maxilofacial) u otro examen. ¿Se dejan fuera (el HTML
  dice «consulta de primera vez · especialistas en otorrino») o cuentan?
- **E.** ¿Cada semana sube el formato **corto** de 6 columnas (el de noviembre, el que usa su HTML) o el
  **completo** de 17? SinCo acepta los dos; el corto es mejor porque no trae observaciones ni usuario.
- **F.** En el corto de Póliza SURA vienen **2 exámenes** distintos. ¿Cuentan los dos?

## 9. Fases (cuando Isa responda las preguntas abiertas)

| Paso | Qué | Horas |
|---|---|---|
| EQ1 | Lector del formato real, tabla `equidad_citas` y las 3 cargas en el Centro de cargas (permiso `equidad`), con pruebas sobre el ejemplo inventado | 2 |
| EQ2 | Pestaña oculta en ORLANT (migración), con las 3 sub-pestañas, tarjetas, gráficas y tabla, y pruebas | 2,5 |
| EQ3 | Revisión con Isa en local (375/768/1440 px, claro y oscuro), ajustes y PR | 0,5 |
| Total | | 5 (lo del plan) |

Riesgo para el 27/11: las preguntas 6, 7, A y E deben estar resueltas a más tardar el miércoles 25/11.

## 10. Adelanto de EQ1 sin esperar a Isa (24/11/2026)

El 24/11 el usuario pidió adelantar lo que no depende de las respuestas de Isa. Cada respuesta pendiente quedó como **una sola opción** de configuración: cuando Isa responda, se cambia un valor y nada más.

**Qué quedó hecho:** `server/equidad-agendamiento.js`.

| Pieza | Qué hace |
|---|---|
| Lector | Lee los dos formatos y los reconoce por los encabezados. |
| Cálculos | Los de §3. |
| Guardado | Tabla `equidad_citas`, todo o nada. |

**Qué falta:** ruta, pantalla, pestaña y el Centro de cargas, con respaldo y «Deshacer». Es EQ1 con la ruta y EQ2, y depende de las preguntas 7 y 8.

| Pregunta | Opción (`OPCIONES_POR_DEFECTO`) | Por defecto (como el HTML de Isa) |
|---|---|---|
| 5 | `margenDesequilibrioPct` | `null`: solo la línea del promedio. Con un número, cada médico queda «sobre», «bajo» o «dentro» |
| 6 | `modoCarga` | `'reemplazar_meses'`: cada carga reemplaza los meses que trae, de ese grupo. La otra opción es `'sumar'` |
| 7 | `visibleParaCliente` | `false` (se usará en EQ2) |
| 11 | `mesInicial` | `null`: cualquier mes |
| A | `guardarEntidadParticulares` | `false` |
| B | `guardarUsuario` | `false`: `CITUSU` no se guarda |
| C | `repetidas` | `'todas'` cuentan. La otra opción es `'una'` |
| D, F | `especialidadesPermitidas`, `examenesPermitidos` | `null`: todas cuentan, con un aviso. Con una lista, lo demás queda fuera |
| E | `formatosAceptados` | `'ambos'` |

**Prueba con los 6 Excel reales de Isa** (en local, solo conteos, nada en el repo):

- Los 6 se leen bien.
- Octubre (completo): 305 citas en Prepagadas, 256 en Particulares y 403 en Póliza SURA.
- Noviembre (corto): 216, 139 y 213. Suman **568**, igual que el HTML de Isa.
- La observación nunca sale del lector.
- Avisos: en octubre, entre 10 y 15 citas repetidas por archivo y 2 de otra especialidad; en el archivo de Póliza SURA, 1 de otro examen.

**Hallazgo para Isa (pregunta C):**

- En los dos formatos, `FECHA_CITA` trae **solo la fecha**, sin hora.
- El formato corto no tiene `HORA_CITA`, así que con él **no se pueden detectar las citas repetidas**.
- El lector lo detecta (una única hora en todo el archivo), no la usa y avisa (`sinHoraEnCorto`).
- Si Isa quiere contar las repetidas una sola vez, tendría que subir el formato completo o agregar `HORA_CITA` al corto.

Pruebas: `server/tests/faseEQ1-equidad-lector.test.js` (6), con los ejemplos inventados.
