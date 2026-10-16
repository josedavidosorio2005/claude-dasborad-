# Centro de cargas — maqueta y propuesta (Fase 153, P2)

**Estado:** maqueta en la base de prueba, en la rama `fase153-p2-centro-cargas-maqueta` (sin merge). Espera el **"OK centro de cargas"** del usuario, que la revisa con Edwin.

## Lo que pidió Edwin (16/10/2026)

Cargar Datos, como está hoy, "es muy a la antigua, muy enredado": todas las plantillas mezcladas y el registro de cargas con fechas revueltas. Quiere:
- elegir el **cliente** y el **módulo**;
- ver los **meses** del año, y en cada uno si ya hay base, cuántos registros, cuándo y quién la cargó;
- en cada mes, **Reemplazar**, **Eliminar** y **Descargar**;
- avisos claros y amigables;
- "llevar un control muy detallado de todo".

Esto reemplaza al B10 ("Cargar Datos por pasos") de la Fase 152.

## La maqueta

Capturas a 375 y 1440 px, en claro y en oscuro, fuera del repo: `datos-inconexion/diagnostico-ui/fase153/centro-cargas/`.

1. **Entrada:** el menú "Cargar Datos" abre el Centro de cargas. "Pantalla anterior" lleva a la pantalla de siempre, que se queda hasta que el Centro cubra todos los módulos.
2. **Tarjetas de módulos** del cliente:
   - salen del registro de clientes y del catálogo del Paso 3, en el orden del catálogo;
   - cada tarjeta dice cuántos meses del año tienen datos, cuándo fue la última carga y un estado: **"Al día"**, **"Falta septiembre"** (si el mes anterior está vacío) o **"Sin datos todavía"**;
   - los módulos con dos archivos (Llamadas Únicas y de Salida; Tipificación de llamadas y de WhatsApp) lo dicen en la tarjeta.
3. **Meses del año** (con selector de año). Cada mes muestra:
   - su estado: Cargado, Sin datos, En curso o Próximo;
   - los registros, con fecha, hora y quién cargó, y el nombre del archivo.

   Si hay meses vacíos entre meses cargados, sale un aviso arriba ("Faltan meses entre los cargados: …").
4. **Acciones por mes:**
   - **Subir** (si está vacío) o **Reemplazar**;
   - **Descargar lo cargado**;
   - **Eliminar**.

   Arriba, **Descargar plantilla** baja la plantilla oficial del módulo (P1). Calidad remite a su propia descarga, porque depende de los ítems de cada campaña.
5. **Diálogos amigables:**
   - "Vas a reemplazar la base de Agosto 2026 de Flujo de Llamadas (26 registros) por la del archivo nuevo. La base anterior se guarda 30 días: si algo sale mal, la recuperas con Deshacer."
   - "Se eliminan 26 registros de Flujo de Llamadas de Agosto 2026 (ORLANT). Los demás meses no se tocan."
6. **Atajo desde el tablero:**
   - un botón "Actualizar datos" junto a Exportar abre el Centro en ese cliente y en el módulo de la pestaña activa;
   - una pestaña manual de ORLANT abre las tarjetas del cliente;
   - el botón solo lo ve quien puede cargar; el usuario cliente nunca lo ve (verificado con CLIENTES_DASH).

**Qué es real en la maqueta y qué no:**
- Los conteos por mes son reales (`GET /api/centro-cargas/:cliente`, solo lectura) y la descarga de plantillas funciona.
- Subir, Reemplazar, Eliminar y Descargar lo cargado **solo muestran el diálogo**: no guardan ni borran nada, y el diálogo lo dice.

## Lo que hace falta después del OK (propuesta)

### Subir y Reemplazar: sin cambiar cómo se leen ni se guardan los datos

- Usa el **mismo lector** de cada módulo y la **misma vista previa de impacto** de hoy (conteos antes de guardar, filas de otro mes, fechas futuras). Es la pantalla actual, pero con el plan de **un solo módulo**: ese módulo, ese archivo.
- Al elegir un mes, el Centro **se queda solo con las filas de ese mes** y avisa cuántas de otros meses se ignoraron ("El archivo trae 30 filas de julio; solo se cargan las de agosto"). Así el reemplazo nunca toca otro mes.
- Para subir varios meses a la vez sigue disponible la pantalla anterior; más adelante, una opción "todo el archivo" con su propia confirmación.
- **Excepción, ORLANT:** después de cargar o restaurar Flujo de Llamadas o de WhatsApp se vuelve a calcular su "resumen", como hoy (`resumen-orlant-trafico.js`).

### Eliminar y Reemplazar guardan la versión anterior 30 días ("Deshacer")

- **Tabla nueva `cargas_versiones`:**
  - qué es: `id`, `modulo`, `carga`, `tabla`, `campana`, `mes`, `desde`, `hasta`;
  - por qué se guardó: `motivo` (reemplazo o eliminación);
  - las filas guardadas: `registros` y `filas` (JSON comprimido con gzip, con exactamente las columnas que ya están en la base; nunca teléfonos, porque la base no los tiene);
  - de qué carga venían: `archivoNombre` y `cargadoPorNombre` (de la versión guardada);
  - quién la guardó y hasta cuándo: `guardadoPor`, `guardadoEn`, `expiraEn` (+30 días);
  - si se restauró: `restauradoEn` y `restauradoPor`.
- **Al reemplazar:** cada lector del servidor ya borra un rango (por mes o por fechas) dentro de una transacción. Se agrega, **en esa misma transacción y antes del DELETE**, una llamada a `respaldarAntesDeBorrar(db, { tabla, where, params, meta })` con exactamente el mismo `where`. Si el respaldo falla, no se borra nada.
  - Sirve también para la pantalla anterior: desde ese PR, toda carga que reemplaza deja su versión.
- **Al eliminar:** `DELETE /api/centro-cargas/:cliente/:carga/:mes` hace, en una transacción, respaldo, borrado del mes e Historial: "Eliminó la base de Agosto 2026 de Flujo de Llamadas (ORLANT): 26 registros".
- **Deshacer:** `POST /api/centro-cargas/versiones/:id/deshacer`, en una transacción:
  1. guarda primero lo que hay ahora en ese rango, para que deshacer también se pueda deshacer;
  2. lo borra;
  3. vuelve a insertar las filas de la versión;
  4. la marca como restaurada y lo deja en el Historial.

  Se ofrece en el aviso que sale justo después de eliminar o reemplazar, y en una lista "Versiones guardadas" del módulo.
- **Limpieza:**
  - al arrancar y cada 24 horas se borran las versiones vencidas, y queda el conteo en el log;
  - tope de 5 versiones por carga y mes, para cuidar el disco, que ya vigila `salud-servidor.yml`.
  - Las versiones viven en la misma base, así que también quedan en el respaldo diario.
- **Tamaño estimado:** el mes más grande hoy (Tipificación, 15.000–30.000 filas) pesa 1 a 3 MB comprimido.
- **Quién puede:** quien puede cargar ese módulo de ese cliente. Deshacer es igual de destructivo, así que lleva la misma confirmación.

### Descargar lo cargado

`GET /api/centro-cargas/:cliente/:carga/:mes/datos` devuelve las filas tal como están en la base: solo columnas guardadas, sin datos personales. El navegador arma el Excel con `xlsxFilasSeguras`, como las demás exportaciones.

### Permisos — `cargar_<modulo>` APROBADO (16/10/2026): apagado por defecto para todos; se implementa dentro de los PRs del Centro de cargas, después del "OK centro de cargas"

- **Hoy:**
  - cargar exige `cargarDatos`, un solo permiso para todos los módulos;
  - la maqueta exige además acceso al cliente (`campaignAccess`), como pediste;
  - REPORTES y ADMIN cargan.
- **Propuesta:** para que alguien de CALIDAD cargue solo algunos módulos, agregar claves por módulo, `cargar_<modulo>` (por ejemplo `cargar_calidad` o `cargar_tipificacion`):
  - `cargarDatos = true` permite todos los módulos, como hoy, y nadie pierde nada;
  - sin `cargarDatos`, solo los módulos con su `cargar_<modulo>` en `true`, y siempre con acceso al cliente;
  - las casillas aparecen en Usuarios → permisos de CALIDAD, todas apagadas por defecto: ningún usuario existente gana nada;
  - la matriz de acceso (`fase118-matriz-acceso.test.js`) se amplía con cada ruta nueva y cada rol.

### Más adelante: carga por API

El Centro no depende de que el archivo sea un Excel: cada carga es "módulo + filas + lector". Una carga que llegue de Wolkvox por API podrá pasar por el mismo lector, el mismo respaldo y el mismo Historial. No se construye nada de API ahora.

## Orden de PRs después del OK

1. **Centro de cargas en solo lectura:**
   - tarjetas, meses, descargar plantilla y descargar lo cargado;
   - atajo desde el tablero;
   - matriz de acceso ampliada;
   - la pantalla anterior sigue siendo la que sube.
2. **Versiones (`cargas_versiones`):** respaldo antes de borrar en cada lector, Deshacer y limpieza. Pruebas que fallen antes: reemplazar y deshacer deja exactamente las filas de antes.
3. **Eliminar un mes**, con confirmación, Historial y Deshacer.
4. **Subir y Reemplazar desde el mes**, con el lector y la vista previa de siempre y las filas filtradas a ese mes. Un módulo por PR si hace falta, empezando por los de Mobilize.
5. **Permisos por módulo para CALIDAD**, solo con tu OK.
6. **Retirar la pantalla anterior** cuando el Centro cubra todos los módulos, también con tu OK.
