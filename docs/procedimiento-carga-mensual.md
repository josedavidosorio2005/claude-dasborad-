# Procedimiento de carga mensual (ORLANT)

> Guía corta para quien va a subir un mes nuevo de datos a producción
> (Edwin, Jairo o quien haga la carga). En español simple, sin nada
> técnico. El detalle de cada base (columnas, hoja, qué significa cada
> una) está en [`docs/guia-uso-orlant.md`](guia-uso-orlant.md) → sección 4
> — este documento es solo el PROCEDIMIENTO, paso a paso.

## 1. Antes de cargar: respaldo

Antes de cualquier carga real de un mes nuevo, confirma que el respaldo
automático de la base de datos está al día:

1. En GitHub, ve a la pestaña **Actions** del repositorio.
2. Abre el workflow **"Respaldo de produccion (estado / respaldar ahora /
   activar timer)"**.
3. Botón **"Run workflow"** → modo **`estado`** → Run.
4. Espera a que termine (un par de minutos) y revisa el resultado: debe
   decir que el último respaldo es de **menos de 24 horas** y que la
   subida a S3 salió **OK**.
5. Si el último respaldo es viejo o falló, corre el mismo workflow con
   modo **`respaldar-ahora`** antes de seguir — así, si algo sale mal con
   la carga, siempre hay una copia reciente de la que partir.

No hace falta hacer esto para una carga de prueba en ambiente local — solo
antes de una carga **real** en producción.

## 2. Qué archivo sube cada base, y en qué orden

No hay un orden obligatorio entre bases — cada una reemplaza solo sus
propias filas, nunca las de otra base. Aun así, conviene este orden
porque así el dashboard se ve completo de una vez en vez de ir mostrando
pestañas a medias:

| # | Base | Pestaña que alimenta |
|---|---|---|
| 1 | Tráfico de Llamadas | Tráfico de Llamadas |
| 2 | Tráfico de WhatsApp | Tráfico de WhatsApp |
| 3 | Tipificación (Llamadas y WhatsApp, son 2 hojas) | Tipificación |
| 4 | Agendas | Agendamiento |
| 5 | Efectividad de Agendamiento | Agendamiento → Ranking de asesores |
| 6 | Inasistencia | Inasistencia |
| 7 | Efectividad de Citas Atendidas | Efectividad de Citas |

Todas se suben desde la misma pantalla: **"Cargar Datos"** (menú
principal) → cliente **ORLANT** → descarga la **plantilla consolidada**
(un solo Excel con una hoja por base) si no la tienes ya, llena la hoja
que corresponda con el archivo que te llegó (sin cambiar los nombres de
columna) y vuelve a subir ese Excel. El detalle de columnas obligatorias
de cada una está en `docs/guia-uso-orlant.md` → sección 4.

## 3. Cómo leer el diálogo de confirmación

Antes de guardar nada, la plataforma siempre muestra cuántas filas se van
a ver afectadas — **léelo con calma antes de aceptar**:

- **"N existente(s) se reemplazan"**: filas que ya estaban guardadas, en
  el mismo rango de fechas/mes que trae tu archivo, y van a quedar con el
  valor nuevo.
- **"M se borran (no vienen en el archivo nuevo)"**: filas que estaban
  dentro de ese mismo rango pero que tu archivo nuevo NO trae — se
  eliminan (para que no quede un dato viejo mezclado con uno nuevo del
  mismo período).

Si el número de filas que esperabas no coincide con lo que dice el
diálogo (por ejemplo, subiste el archivo equivocado, o un mes que no
querías tocar), **cancela y revisa el archivo antes de confirmar** — en
ese punto todavía no se ha guardado nada.

## 4. Qué verificar después de cargar

Después de confirmar, compara los números que muestra el dashboard contra
los **números de control** vigentes — están siempre al día en
`PROGRESS.md` (raíz del repo) → sección "Números de control". Si acabas
de cargar un mes nuevo, esos números van a cambiar (es lo esperado); lo
que nunca debe pasar es que un mes **anterior** al que acabas de cargar
cambie de valor — si eso pasa, para y avisa, no sigas cargando.

También puedes correr, desde una sesión de Claude Code en este repo,
`scripts/produccion/revision-final.js` — abre un navegador, pide que
inicies sesión a mano, y confirma solo-lectura que las 7 pestañas cargan
sin errores, Exportar funciona y los números de control coinciden.

## 5. Si algo salió mal: cómo volver atrás

- **Si te diste cuenta ANTES de confirmar el diálogo de la sección 3**:
  cancela, no pasó nada.
- **Si ya confirmaste y el archivo tenía datos equivocados**: vuelve a
  subir el archivo correcto para el mismo período — una carga nueva
  siempre reemplaza por completo el rango/mes que trae, así que el dato
  equivocado queda sobrescrito por el correcto.
- **Si el problema es más serio** (subiste el archivo de otra base por
  error y el sistema no lo rechazó, o no estás seguro de qué quedó mal):
  usa el respaldo de la sección 1 para restaurar la base al estado de
  antes de la carga — eso requiere acceso al servidor (AWS), así que
  avisa primero por el canal del equipo antes de hacerlo; no se restaura
  un respaldo sin avisar, porque también revierte cualquier otro cambio
  que se haya hecho desde entonces (otro usuario, otro monitoreo de
  Calidad, etc.).

## 6. Si la misma persona aparece con dos nombres distintos

Si en Agendas, Tipificación o Efectividad de Agendamiento la misma
persona llega con dos nombres distintos entre archivos (por ejemplo, un
cambio de apellido o una errata de tipeo en Wolkvox), pídele a un
administrador que registre esa equivalencia una sola vez (pantalla de
administración → Alias de asesor). Desde ese momento, la plataforma
guarda siempre el nombre correcto en las 3 bases — no hace falta corregir
cada archivo a mano antes de subirlo.

## 7. Qué protege la plataforma automáticamente (no hace falta que lo
   verifiques a mano)

- Un archivo con una **fecha futura** se rechaza fila por fila (nunca se
  guarda una fecha que todavía no pasó).
- Subir el archivo de una base en la carga de **otra** base (por ejemplo,
  WhatsApp en la carga de Llamadas) se rechaza — la plataforma reconoce
  la forma de cada archivo y no deja mezclarlos.
- Una carga nunca toca otra **campaña/cliente** distinto al que elegiste,
  aunque tenga datos en las mismas fechas.
- Si algo falla a mitad de una carga (un corte de red, un error del
  servidor), no queda nada a medias — o se guarda todo el archivo, o no
  se guarda nada.
- Volver a subir exactamente el mismo archivo no duplica nada.

(Las 7 bases tienen pruebas automáticas permanentes que confirman todo
esto cada vez que se cambia el código — `server/tests/fase119-cargas-
multi-mes.test.js`.)
