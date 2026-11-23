# Plan — «Plataforma de Gestión humana y Sistemas» de Edwin dentro de SinCo

Pedido de Edwin (reunión del 23/11/2026). Este documento es **solo el plan**: todavía no hay código.

## Qué pidió Edwin

- Montar en SinCo su «Plataforma de Gestión humana y Sistemas», un HTML de una sola página.
- Usar el inicio y el menú de SinCo, no el login ni el «inicio» del HTML.
- Que entre **sin los datos de prueba** que trae.
- Respetar su visual tal cual.
- Más adelante, que otras pantallas de SinCo tomen ese estilo.

## El HTML de Edwin

- **Dónde está:** el archivo original vive **fuera del repo**, porque trae datos reales (ver §3).
  - Hoy está en la carpeta de descargas del equipo del usuario.
  - Se podría guardar en `docs/gestion-humana/Plataforma_InConexion.html`, pero esa ruta está en `.gitignore` para que nunca se suba por error (el repo es público).
- **No se edita nunca.** Los cambios se hacen con un script generador, igual que Televentas (`scripts/sura/generar-televentas.js`) y STA. El script:
  - lee el HTML,
  - toma solo lo que hace falta,
  - cambia el guardado del navegador por la API,
  - falla si el HTML cambió y un reemplazo ya no encuentra su texto.
- **Cómo está armado:** pesa unos 2 MB y tiene 3 partes:
  1. **Inicio** («¿A dónde quiere ir?»): un saludo, el estado de la red y 2 tarjetas con conteos. No tiene login. **No se usa**: lo reemplazan el inicio y el menú de SinCo.
  2. **App «Gestión Humana»** (`app-gh`, unos 500 KB): incluye SheetJS (Excel) y la aplicación de Edwin.
  3. **App «Inventario de Activos Tecnológicos»** (`app-inv`, unos 1,4 MB): incluye SheetJS, jsPDF, la aplicación de Edwin y **una plantilla con datos reales** (`SEED_RAW`).

## 1. Módulos, pantallas y qué guarda hoy

### Talento humano (Gestión humana)

| Pantalla | Qué hace |
|---|---|
| Panel | Planta activa y su evolución en 12 meses. Distribución por sede, tipo de contrato, género, rango de edad, centro de trabajo y cargo. Seguridad social y nómina mensual por cargo. «Indicadores de impacto»: cabeza de hogar, primer empleo formal, régimen de salud de origen, número de hijos. «Pendientes por diligenciar». |
| Empleados | Lista con filtros, ficha, nuevo empleado y edición. Cambio de cargo u operación, con historial. Importar desde Excel y exportar. |
| Incapacidades y ausentismos | Novedades: incapacidad, licencia, permiso y ausencia. Muestra quién está ausente hoy. Soportes adjuntos y anulación con motivo. |
| Costos de ausentismo | Eventos por causa y subtipo o diagnóstico. Costo para la empresa frente a EPS/ARL, por mes y por área, y el top 10. Usa parámetros: días base y % que asume la empresa. |
| Alertas | Fin del periodo de prueba, datos incompletos, etc. |
| Vacaciones | Periodos y saldo, programación, quiénes están fuera y próximas salidas, y quiénes no tienen fecha programada. |
| Cumpleaños | Lista del mes. |
| Retirados | Retiro con motivo, si se puede volver a contratar y soportes. También reintegro. |
| Administrativo | Listas (cargos, operaciones, sedes…) y parámetros. |
| Copias de seguridad | Descarga y restauración en JSON. |

- **Lo que guarda en el navegador (`localStorage`):**
  - `inconexion_gh_empleados_v1`: empleados, con historial de cargos y de retiros.
  - Las mismas claves con sufijo:
    - `_vac`: vacaciones.
    - `_nov`: novedades.
    - `_impdemo`, `_init*` y `_lastcopy`: marcas internas.
  - 3 claves más: ausentismo, su configuración y la configuración general.
- **Archivos adjuntos (soportes):** van a IndexedDB (`inconexion_gh_archivos`).
- **Datos que maneja:** nombre, tipo y número de documento, fecha de nacimiento, género, celular, correo, sede, cargo, operación, tipo de contrato, salario, EPS, ARL, pensión, caja, hijos e indicadores sociales.
  - También incapacidades con diagnóstico, que es un **dato sensible** según la Ley 1581 de 2012.
- **Datos de prueba:** trae un generador de prueba: los botones «Cargar datos de prueba» y «Quitar datos de prueba». **No trae empleados reales**; arranca vacío.

### Inventario de activos tecnológicos (Sistemas)

- **Elementos:** torres, monitores, teclados, mouse, diademas, portátiles y equipos de mesa.
- **Cada elemento tiene:**
  - ficha y estado (con «a reparación» y «reparado»),
  - asignación a un agente con nombre y cédula, y su devolución,
  - actas de entrega y de devolución en PDF, para firmar y subir firmadas.
- **Equipos administrables:** «armar equipo».
- **Panel:** elementos por categoría, últimos ingresos, libres y rendimiento bajo.
- **Integración «Novedades desde Gestión Humana»:** lee los retirados de Talento humano y muestra los equipos que hay que recoger.
- **Otras funciones:** formularios editables, Excel y PDF, copia de seguridad y «Restaurar datos de la plantilla».
- **Lo que guarda en el navegador:**
  - `localStorage`: `inventario_activos_inconexion_v1`.
  - Archivos en IndexedDB: `inventario_inconexion_archivos`.

### Tablas y rutas que harían falta en el servidor (solo Talento humano; ver §2 para Inventario)

Hay dos caminos.

**Recomendado (fase GH2): un documento por clave.**
- Es el camino más corto y **respeta su app tal cual**.
- El generador reemplaza `localStorage` por un adaptador que lee y escribe en la API las mismas claves.
- La lógica, las pantallas y los cálculos de Edwin no se tocan.

| Tabla | Para qué |
|---|---|
| `gh_estado (clave, valor JSON, version, actualizadoPor, actualizadoAt)` | Una fila por clave de las de arriba. La `version` evita que una pestaña vieja pise lo nuevo: se rechaza con 409 y se avisa. |
| `gh_bitacora (id, clave, usuario, fecha, resumen)` | Quién guardó y cuándo. **Nunca** guarda el contenido. |
| `gh_archivos (id, empleadoId, nombre, tipo, tamano, s3Key, subidoPor, fecha)` | Soportes en **S3 privado**, como las actas del inventario (Fase 371). |

| Ruta | Para qué |
|---|---|
| `GET /api/gh/estado` | Todas las claves, al abrir. |
| `PUT /api/gh/estado/:clave` | Guarda una clave, con `version`. Solo la lista cerrada de claves. Tope de tamaño. |
| `POST /api/gh/archivos` | Sube un soporte. Solo imagen o PDF, con tope de MB. |
| `GET /api/gh/archivos/:id` | Descarga un soporte, con URL firmada corta. |
| `DELETE /api/gh/archivos/:id` | Borra un soporte. |

**Después (opcional): tablas normales.**
- Solo si hace falta cruzar estos datos con el resto de SinCo, por ejemplo para alimentar el tablero de Gerencia.
- Tablas: `gh_empleados`, `gh_historial_cargos`, `gh_retiros`, `gh_vacaciones`, `gh_novedades`, `gh_ausentismo` y `gh_config`.
- Exige reescribir el guardado de su app, así que no se recomienda para empezar.

**La tabla de la Fase 10:** SinCo ya tiene `gestion_humana_personal`, que alimenta el tablero de Gerencia (rotación y costo por campaña).
- **No se mezcla** con lo nuevo al principio.
- Si Edwin quiere que la rotación salga de Talento humano, se decide aparte.

## 2. Inventario: el de Edwin frente al «Inventario de sistemas» de SinCo

- El «Inventario de sistemas» de SinCo (Fases 369–381, E1–E4 e I1–I6) **ya se construyó a partir de este mismo diseño de Edwin**. I1 se tituló literalmente «menú del diseño de Edwin».
- Lo que SinCo ya tiene:
  - tipos, estados con historial, agentes y asignación por elemento,
  - actas automáticas en PDF y firmadas en S3 privado,
  - formularios editables, equipos administrables,
  - Excel/PDF e importación,
  - roles ADMIN y SISTEMAS,
  - y todo guardado en el servidor.
- La versión del HTML guarda en el navegador de quien la usa: si se borra el navegador, se pierde, y nadie más la ve.

**Opciones:**

| Opción | Ventaja | Problema |
|---|---|---|
| Reemplazar el de SinCo por el de Edwin | Visual idéntico | Se pierden 10 fases ya en producción (servidor, actas en S3, roles). Habría que repetirlas sobre otro código. |
| Dejar los dos | Nada | Dos inventarios con datos distintos: nadie sabe cuál es el bueno. |
| **Combinar (recomendado)** | Un solo inventario con datos en el servidor | Hay que portar lo que falte. |

**Recomendación: combinar.**
- La tarjeta «Inventario de activos tecnológicos» del menú abre **el Inventario de sistemas de SinCo**.
- Del HTML se trae solo lo que SinCo no tenga:
  1. **«Novedades desde Gestión Humana»:** cuando Talento humano registra un retiro, Inventario muestra los equipos asignados a esa persona para recogerlos. Es la pieza que une los dos módulos (fase GH4).
  2. Las diferencias de visual que Edwin señale, revisadas pantalla por pantalla.
- La plantilla `SEED_RAW` **no se importa**.

## 3. ¿El HTML trae datos reales?

Se revisó sin copiar ni mostrar ningún valor; solo se contó.

- **Talento humano:** no trae datos de personas. Arranca vacío y solo tiene el generador de prueba.
  - Los números y nombres que aparecen son de las librerías: fuentes y constantes de Excel.
- **Inventario: sí trae datos reales.** La plantilla `SEED_RAW` tiene 9 hojas y unas 119 filas:
  - 116 con serial de equipo,
  - códigos de inventario,
  - y una columna de identificación de la persona o equipo con unos 38 valores con forma de nombre y 6 con forma de cédula.

**Consecuencias:**
- El HTML **no se sube al repo**. La ruta `docs/gestion-humana/Plataforma_InConexion.html` quedó en `.gitignore`.
- El generador **nunca copia `SEED_RAW`**, igual que Televentas con sus `SEED*`.
- Si algún día hay que cargar ese inventario, lo carga Sistemas por la interfaz de SinCo (importar Excel), con autorización, nunca por el repo.

## 4. Los 2 `fetch()` del HTML

**Ninguno llama a internet.** Los dos reciben una URL `data:` (un archivo convertido a texto base64) y la vuelven a convertir en archivo (`Blob`) para guardarla en IndexedDB:

1. **Talento humano, al restaurar una copia de seguridad:** `fetch(f.data)` para cada soporte que venía dentro del JSON.
2. **Inventario, `dataToBlob`:** `fetch(d)` para pasar un PDF o imagen de base64 a archivo.

Sobre las direcciones que aparecen en el HTML:
- Son comentarios de licencia y constantes de las librerías (SheetJS y jsPDF).
- Hay una URL de cdnjs dentro de jsPDF que solo se usaría con una opción de vista previa que la app no usa.
- El generador no copia SheetJS (SinCo ya lo trae, igual que Televentas). jsPDF se revisa en GH1 para reutilizar el de SinCo si existe.

## 5. Permisos

| Módulo | Quién lo ve |
|---|---|
| Talento humano | Rol **GESTION_HUMANA** (la persona de Gestión humana que indicó Edwin) y **ADMIN** |
| Inventario de activos tecnológicos | Rol **SISTEMAS** (las 2 personas de Sistemas que indicó Edwin) y **ADMIN** (sin cambios frente a hoy) |

- Nadie más ve Talento humano, tampoco Gerencia ni Aux. administrativo, salvo que Edwin lo pida por escrito. Hay salarios, cédulas y diagnósticos.
- Los permisos los revisa **el servidor** en cada ruta (`/api/gh/*`). Ocultar la tarjeta no basta.
- Los soportes se sirven solo con URL firmada corta y solo a esos roles.
- En GH1 se verifica qué ve hoy el rol GESTION_HUMANA (el tablero de la Fase 10) para no quitarle nada.
- Las cuentas reales de esas personas se crean o ajustan con el usuario, en producción, por la interfaz. Nunca por migración.

## 6. Fases y estimación

| Fase | Qué | Estimación |
|---|---|---|
| **GH0** (este PR) | Plan y `.gitignore` | Hecho |
| **GH1** | Generador `scripts/gestion-humana/generar-talento-humano.js` (ver detalle abajo). | 1–1,5 días |
| **GH2** | Guardado en el servidor: `gh_estado` con `version`, bitácora y rutas con permisos. Pruebas de acceso por rol y de conflicto (409). Revisión local a 375/768/1440. | 1,5 días |
| **GH3** | Soportes en S3 privado, reutilizando lo de las actas (Fase 371). Antes de crear algo en AWS, se guía al usuario paso a paso. | 1 día |
| **GH4** | Inventario: «Novedades desde Gestión Humana» en el Inventario de SinCo (retirados con equipos asignados), solo lectura entre módulos. | 0,5–1 día |
| **GH5** | Diferencias de visual del Inventario que Edwin señale, sobre el de SinCo. | Depende de la lista; 1–2 días |
| **GH6** | «Que otras pantallas tomen ese estilo»: propuesta de tokens (colores, tipografía, tarjetas) en `docs/sistema-de-diseno.md` y una pantalla piloto, con el OK de Edwin antes de extenderlo. | 1–2 días |

**Detalle de GH1:**
- Toma solo la app de Talento humano, sin SheetJS (usa el de SinCo).
- Quita el generador de prueba y sus botones.
- La monta dentro de SinCo con su menú y su barra, en Shadow DOM como Televentas, para que su visual no choque con el de SinCo.
- Agrega la tarjeta en el menú único.
- Incluye una prueba guardiana.
- En esta fase todavía guarda en el navegador y solo la ve ADMIN.

**Total aproximado: 6–9 días** de trabajo, en PRs separados, cada uno con CI verde.

**Para empezar GH1 hace falta:**
- que el usuario deje el HTML en `docs/gestion-humana/` (ignorado por git) o diga la ruta;
- el OK a este plan.

Ninguna fase escribe en producción sin autorización.
