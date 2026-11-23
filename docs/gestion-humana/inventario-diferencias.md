# Inventario de sistemas: diferencias con el HTML de Edwin (23/11/2026)

Comparación del 23/11/2026, pantalla por pantalla, entre:

- el Inventario de `docs/gestion-humana/Plataforma_InConexion.html`, que no está en el repo (`.gitignore`);
- el «Inventario de sistemas» de SinCo.

Cómo se hizo:

- **Copia de Edwin:** su app se abrió en Brave desde una copia fuera del repo. La plantilla con datos reales (`SEED_RAW`) se reemplazó por datos INVENTADOS de la misma forma: mismos nombres de hoja y de columna.
- **SinCo:** se usó la base demo local con elementos inventados, que se borraron al final.
- **Alcance:** solo cuenta la estructura y lo visual. Ningún dato real de su HTML entró al repo, a las pruebas ni a las capturas.

| # | Pantalla | Edwin | SinCo hoy | Estado |
|---|---|---|---|---|
| 1 | **Panel general** | Lo que muestra:<br>• chips «Ver gráficas de» (Todos y cada tipo);<br>• botones Excel y Registrar ingreso;<br>• tarjetas con detalle: asignados, libres, reparación, malos, torres, portátiles, agentes y actas pendientes;<br>• dona por estado y dona por RAM;<br>• barras por tipo, sede y operación, separadas por estado;<br>• marcas más comunes, valor por elemento y renta mensual por proveedor;<br>• calidad de los datos;<br>• movimientos de los últimos 6 meses. | Conteos por estado, tarjetas de RAM, tabla por tipo y lista por sede. | **Hecho en GH5** (PR de esta fase). |
| 2 | **Aspecto general** | Tema oscuro fijo (azul noche). Tarjetas con título azul. Botones laterales «Menú», «Inicio» e «Inventario». Secciones del menú plegables. | Usa el tema de SinCo (claro u oscuro según la persona), con el menú dentro de la ventana. | **Decisión del usuario:** ¿Inventario siempre oscuro como Edwin, o respetar el tema de SinCo? El panel nuevo ya usa sus colores; en tema oscuro se ve como el de Edwin. |
| 3 | **Registrar ingreso** | Una tarjeta por tipo:<br>• «N registrados · M libres»;<br>• botones Registrar, Ver inventario y Editar formulario.<br>Además: una tarjeta «Nueva tecnología» (crear formulario), «Importar desde Excel» en la cabecera y «Últimos ingresos». | Un solo formulario con selector de tipo. La importación está en Ajustes. | Pendiente (GH5b). |
| 4 | **Libres / Asignados / En reparación / Malos** | Filtros: Buscar, Tipo, Sede y Operación, más una línea de resumen por tipo.<br>Columnas: Tipo (etiqueta de color), Código, Nombre, Equipo (marca y modelo), Procesador, RAM, Sede, Operación y Acciones («Estado»; en Asignados también «Recibir»).<br>Asignados muestra además Agente, Cédula y Asignado desde.<br>Excel, PDF y Registrar ingreso arriba. | Tiene más filtros: propietario, rendimiento, datos pendientes y seriales repetidos.<br>Columnas: Estado, Serial, Rendimiento y Agente.<br>Un solo botón «Ver». | Pendiente (GH5c): columnas, resumen y acciones directas. Se conservan los filtros extra. |
| 5 | **Inventario (resumen por tipo)** | Cabecera «Inventario · equipos, componentes y tecnologías», chips por tipo y «Exportar todo a Excel».<br>Una tarjeta por tipo con libres, en uso, reparación y malos, y «Ver detalle». | «Inventario completo» es una tabla con filtros. | Pendiente (GH5c). |
| 6 | **Agentes** | Salen de las **personas activas de Gestión Humana**: no se agregan a mano. Se busca por cédula o nombre y se filtra por operación. | Se agregan a mano (nombre, documento, sede, operación), con inactivos. | **Decisión del usuario:** depende de Talento humano. `GH_ROL_ACTIVO` sigue apagado y hoy solo el administrador ve esos datos. |
| 7 | **Actas** | Tarjetas: Por completar, Por firmar, Firmadas y Atrasadas.<br>Pestañas: Actas pendientes, Actas firmadas y Novedades de GH.<br>Botón «Generar acta manual». | Tarjetas: Por firmar, Atrasadas, Firmadas y Anuladas. Excel y PDF.<br>Las Novedades de GH tienen su propia entrada en el menú. | Pendiente (GH5d). |
| 8 | **Historial** | Tabla con Fecha, Usuario, Acción, Tipo, Código y Detalle; buscador; Excel. | Muy parecido. | Ajuste menor (GH5d). |
| 9 | **Ajustes y datos** | Tarjetas: Usuario, Copia de seguridad (.json), Excel (exportar o importar «Combinar»), Sedes, Operaciones, Estados (editables), Propietarios y «Zona de cuidado» (restaurar plantilla o borrar todo). | Importar por tipo, listas (sedes, operaciones, proveedores, motivos), formularios por tipo y textos del acta. | Se reordena en tarjetas (GH5d).<br>**No se traen** Usuario, Copia .json ni Zona de cuidado: en SinCo todo vive en el servidor, con respaldo diario y con quién hizo cada cosa.<br>Los estados siguen fijos (de ellos dependen las actas). |
| 10 | **Menú** | Sin «Inventario completo» ni «Novedades de GH» en el menú: el inventario se abre con el botón lateral y las novedades están en Actas. Contador en cada entrada. | Tiene «Inventario completo» y «Novedades de Gestión Humana» como entradas propias. | Pendiente, junto con 5 y 7. |

Las actas, los elementos, los agentes y el historial que ya están en el servidor no cambian: todo esto es de pantalla.
