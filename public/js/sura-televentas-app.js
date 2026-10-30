// sura-televentas-app.js — Fase 215: logica del tablero "Televentas" de SURA.
// Es el HTML de una sola pagina que hizo Edwin (lectura de los 3 Excel por
// mes con SheetJS, calculos y graficas), sin cambiar sus formulas: lo genera
// el script de la Fase 215 desde el HTML original, con estos cambios y nada
// mas:
//   - sin SheetJS embebido (usa js/vendor/xlsx-0.20.3.full.min.js de la
//     plataforma) y SIN las constantes SEED* (datos reales precargados);
//   - corre dentro de un Shadow DOM (ROOT): sus ids y estilos no chocan con
//     los de la plataforma;
//   - lo que guardaba IndexedDB (DB, save(), Excel original) va a la API
//     (objeto API, sura-televentas.js) y el arranque lee del servidor;
//   - los alias de asesores salen del servidor (nunca nombres en el codigo).
// Quien abre el tablero y que pestanas ve: sura-televentas.js.
/* eslint-disable */
var STV_MARKUP = "<div class=\"wrap\">\n<header>\n    <button id=\"mtog\" type=\"button\" title=\"Ocultar menú\">«</button><div class=\"tabs\"><button class=\"tab on\" type=\"button\" data-p=\"p1\"><svg class=\"icono\" aria-hidden=\"true\" focusable=\"false\"><use href=\"img/iconos/lucide.svg#i-upload\"></use></svg>Cargar información</button><button class=\"tab\" type=\"button\" data-p=\"p9\"><svg class=\"icono\" aria-hidden=\"true\" focusable=\"false\"><use href=\"img/iconos/lucide.svg#i-target\"></use></svg>Cumplimiento</button><button class=\"tab\" type=\"button\" data-p=\"p2\"><svg class=\"icono\" aria-hidden=\"true\" focusable=\"false\"><use href=\"img/iconos/lucide.svg#i-users\"></use></svg>Agentes</button><button class=\"tab\" type=\"button\" data-p=\"p5\"><svg class=\"icono\" aria-hidden=\"true\" focusable=\"false\"><use href=\"img/iconos/lucide.svg#i-phone\"></use></svg>Tipificaciones</button><button class=\"tab\" type=\"button\" data-p=\"p7\"><svg class=\"icono\" aria-hidden=\"true\" focusable=\"false\"><use href=\"img/iconos/lucide.svg#i-chart-column\"></use></svg>Detalle ventas</button><button class=\"tab\" type=\"button\" data-p=\"p3\"><svg class=\"icono\" aria-hidden=\"true\" focusable=\"false\"><use href=\"img/iconos/lucide.svg#i-trending-up\"></use></svg>Estrategias</button><button class=\"tab\" type=\"button\" data-p=\"p10\"><svg class=\"icono\" aria-hidden=\"true\" focusable=\"false\"><use href=\"img/iconos/lucide.svg#i-file-spreadsheet\"></use></svg>Bases</button></div>\n</header>\n<div class=\"card\" id=\"gfbar\" hidden><h2>Filtros generales · aplican a todas las pestañas</h2>\n<div class=\"fg fx\" style=\"--fc:#2aa6c9\"><b>🏷️ Campaña (columna D)</b><select id=\"cf\" hidden aria-label=\"Campaña\"></select><div class=\"seg\" id=\"cfb\"></div></div>\n<div class=\"fg fx\" style=\"--fc:#a05cd6\"><b>🗓️ Mes</b><div class=\"chips\" id=\"mf\"></div></div>\n<div class=\"fg fx\" style=\"--fc:#e5833b\"><b>✅ Resultado de validación (columna AI)</b><div class=\"chips\" id=\"vf\"></div></div>\n<div class=\"msg\" id=\"legw\" hidden></div></div>\n<span id=\"dhhome\" hidden></span><div class=\"card fx fxc\" id=\"dhbar\" style=\"--fc:#12a37f\" hidden><h2>📅 Comparar a la misma fecha (días hábiles) · aplica a esta pestaña</h2>\n  <div class=\"row\"><button class=\"btn pri\" id=\"dhtog\" style=\"width:auto;margin:0\"></button>\n  <label>Días hábiles a comparar<select id=\"dh\"></select></label></div>\n  <div id=\"dhinfo\" style=\"margin-top:10px\"></div></div>\n\n<section id=\"p1\">\n  <div class=\"subtabs\"><button class=\"stab on\" data-s=\"sb1\">📂 Bases del mes</button><button class=\"stab\" data-s=\"sb2\">🎯 Metas del mes</button><button class=\"stab\" data-s=\"sb3\">📖 Códigos</button></div>\n  <div id=\"sb1\">\n  <div class=\"card ini\">\n    <h2>🟣 1 · Base inicial del mes (2026)</h2>\n    <div class=\"msg\" style=\"margin:-6px 0 12px\">La base que llega al inicio de cada mes: identificación, tipo de documento, sexo, edad, ingresos, estado civil, ocupación, ciudad, departamento, rango de saldo promedio y categoría percentil. Se cruza por cédula con la base de ventas del mismo mes y se analiza en «Bases › Base inicial».</div>\n    <div class=\"months\" id=\"imonths\"></div>\n    <input type=\"file\" id=\"ifile\" accept=\".xlsx,.xlsm,.xls,.csv\" hidden>\n    <div class=\"msg\" id=\"imsg\">Haz clic en un mes y selecciona el Excel de la base inicial.</div>\n  </div>\n  <div class=\"card\">\n    <h2>🔵 2 · Base de ventas por mes (2026)</h2>\n    <div class=\"months\" id=\"months\"></div>\n    <input type=\"file\" id=\"file\" accept=\".xlsx,.xlsm,.xls\" hidden>\n    <div class=\"msg\" id=\"msg\">Haz clic en un mes y selecciona el Excel. Para actualizar, usa «Reemplazar» o «Eliminar».</div>\n  </div>\n  <div class=\"card est\">\n    <h2>🟢 3 · Bases de estrategias por mes (2026)</h2>\n    <div class=\"msg\" style=\"margin:-6px 0 12px\">Columnas: identificación (cédula), estrategia (campaña), Estrategia # 1 a 10 y Lote # 1 a 10. Se cruza por cédula con la base de ventas del mismo mes y alimenta la pestaña «Estrategias».</div>\n    <div class=\"months\" id=\"emonths\"></div>\n    <input type=\"file\" id=\"efile\" accept=\".xlsx,.xlsm,.xls,.csv\" hidden>\n    <div class=\"msg\" id=\"emsg\">Haz clic en un mes y selecciona el Excel de estrategias.</div>\n  </div>\n  </div>\n  <div id=\"sb3\" hidden>\n    <div class=\"card\"><h2>📖 Significado de los códigos</h2>\n      <div class=\"msg\" style=\"margin:-6px 0 12px\">Cuando una base traiga estas columnas, la plataforma muestra el significado en vez del código (por ejemplo, ocupación <b>S</b> = Sin ocupación). Puedes cambiar un significado, agregar códigos o quitar los que no sirvan; se guarda solo. Se ven en «Bases › Registros de la base» con los botones de «Ver por».</div>\n      <div class=\"grid3\" id=\"dicbox\"></div>\n      <div class=\"sbox\" style=\"--mc:#e255a1;margin-top:16px\"><h4>📞 Tipificaciones (resultado de la llamada)</h4>\n        <div class=\"msg\" style=\"margin:0 0 6px\">Columna «resultado» de la base de ventas. Indicador: <b>RPC</b> = contacto con la persona correcta · <b>WPC</b> = contacto con persona equivocada · <b>NC</b> = no contacto. Haz clic en una casilla para cambiarla; se guarda sola.</div>\n        <div class=\"tbl\" id=\"tipbox\"></div></div>\n      <div class=\"row\" style=\"margin-top:12px\"><button class=\"btn\" id=\"dicreset\" type=\"button\" style=\"width:auto\">↺ Volver a los códigos originales</button></div>\n      <div class=\"msg\" id=\"dicmsg\"></div></div>\n  </div>\n  <div id=\"sb2\" hidden>\n    <div class=\"card meta\">\n      <h2>🎯 Metas por mes (2026)</h2>\n      <div class=\"msg\" style=\"margin:-6px 0 12px\">Escribe la meta de producción ($) y de ventas (pólizas) de cada mes y campaña. Se guarda sola al salir de cada casilla. La pestaña «Cumplimiento» compara estas metas con lo logrado.</div>\n      <div class=\"tbl\" id=\"mtab\"></div>\n      <div class=\"msg\" id=\"mmsg\"></div>\n    </div>\n    <div class=\"card meta\">\n      <h2>👤 Meta individual por mes</h2>\n      <div class=\"msg\" style=\"margin:-6px 0 12px\">La meta de <b>cada asesor</b> en el mes: meta individual (ventas en pólizas) y meta de producción ($), para cada estrategia. Se guarda sola al salir de cada casilla.</div>\n      <div class=\"tbl\" id=\"matab\"></div>\n      <div class=\"msg\" id=\"mamsg\"></div>\n    </div>\n  </div>\n</section>\n\n<section id=\"p2\" hidden>\n  <div hidden><input type=\"date\" id=\"fd\" aria-label=\"Desde\"><input type=\"date\" id=\"fh\" aria-label=\"Hasta\"><select id=\"fp\" aria-label=\"Producto\"></select><button id=\"clr\"></button></div>\n  <div class=\"kpis\">\n    <div class=\"k\"><span>Ventas (pólizas)</span><div id=\"k1\">0</div></div>\n    <div class=\"k\"><span>Producción (anualizada)</span><div id=\"k2\">$0</div></div>\n    <div class=\"k\"><span id=\"k3l\">Agentes con ventas</span><div id=\"k3\">0</div></div>\n    <div class=\"k\"><span>Producción prom. por póliza</span><div id=\"k4\">$0</div></div>\n  </div>\n  <div class=\"card\"><div style=\"display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap\"><div style=\"display:flex;align-items:center;gap:10px;flex-wrap:wrap\"><h2 id=\"c1t\" style=\"margin:0\">Ventas por agente (cantidad de pólizas)</h2><button class=\"btn\" id=\"c1ag\" type=\"button\" title=\"Quitar o agregar asesores de la gráfica de cada campaña\" style=\"border-color:#e0559a;color:#e0559a;font-weight:600\">👥 Asesores<span id=\"c1agn\"></span></button></div>\n    <div class=\"seg\" id=\"c1m\"><button class=\"btn on\" data-m=\"v\">Ventas</button><button class=\"btn\" data-m=\"p\">Producción</button><button class=\"btn\" data-m=\"c\">🎯 Cumplimiento</button></div></div><div id=\"c1agm\" class=\"msg\" style=\"margin:6px 0 0\" hidden></div><div id=\"c1\" style=\"margin-top:8px\"></div></div>\n  <h2 class=\"sech\" style=\"margin:22px 0 10px;font-size:18px\">👥 Asesores por mes</h2>\n  <div id=\"dhslot\"></div>\n  <div class=\"card\"><div class=\"row fx\" style=\"--fc:#1f6feb\">\n    <label>Ordenar por<select id=\"aord\"><option value=\"t\">Mejores del mes actual</option><option value=\"n\">Nombre</option></select></label>\n    <label>Buscar asesor<input id=\"aq\" placeholder=\"Nombre…\"></label>\n    <label>Medida<input type=\"hidden\" id=\"amed\" value=\"v\"><span class=\"seg\" id=\"amedb\"><button class=\"btn on\" data-m=\"v\">Ventas</button><button class=\"btn\" data-m=\"p\">Producción</button></span></label>\n  </div><div class=\"msg\">Una gráfica por asesor (columna Q) con sus ventas de cada mes. Los colores y el orden van según quién va mejor en el <b>mes actual</b> (el último mes seleccionado). Quien tiene 0 pólizas en el mes actual pasa a <b>Retirados</b> (gris, al final) y vuelve a las listas de arriba apenas registre una póliza. Usa el filtro de días hábiles de arriba para comparar meses con los mismos días.</div></div>\n  <div id=\"agrid\"></div>\n</section>\n\n<section id=\"p3\" hidden>\n  <div class=\"card\"><div class=\"msg\" style=\"margin:0\">Cruce por cédula entre la base de estrategias (sección verde de «Cargar información») y la base de ventas del mismo mes. Efectividad = ventas ÷ registros. <b>Si un cliente se montó en varias estrategias, la venta cuenta solo para la última en la que estuvo</b> (la de número más alto: si estuvo en la #1 y en la #4, la venta es de la #4); en las anteriores cuenta como registro sin venta.</div><div class=\"msg\" id=\"sinfo\"></div></div>\n  <div class=\"card\"><h2>Efectividad por estrategia</h2>\n    <div class=\"row\" style=\"margin-bottom:10px\"><label>Ver<select id=\"sfil\"></select></label></div>\n    <div class=\"msg\" style=\"margin:0 0 8px\"><span class=\"sem g\"></span> Mejor efectividad &nbsp; <span class=\"sem y\"></span> Media &nbsp; <span class=\"sem r\"></span> Más baja &nbsp;·&nbsp; se compara dentro de cada número de estrategia (#1, #2, #3…)</div>\n    <div class=\"tbl\" id=\"stab\"></div></div>\n  <div class=\"card\"><h2>Detalle por lotes</h2>\n    <div class=\"row\" style=\"margin-bottom:10px\"><label>Estrategia<select id=\"ses\"></select></label></div>\n    <div class=\"msg\" style=\"margin:0 0 8px\"><span class=\"sem g\"></span> Mejor lote &nbsp; <span class=\"sem y\"></span> Medio &nbsp; <span class=\"sem r\"></span> Más bajo &nbsp;·&nbsp; haz clic en una estrategia o lote para ver su resumen</div>\n    <div class=\"tbl\" id=\"slt\"></div></div>\n</section>\n<div id=\"mtip\" class=\"mtip\" hidden></div><div id=\"mdl\" class=\"mdl\" hidden><div class=\"mbox\"><button class=\"mx\" id=\"mdlx\" aria-label=\"Cerrar\" style=\"width:auto;padding:0 12px;border-color:var(--dng);color:var(--dng);font-weight:600\">✕ Cerrar</button><div id=\"mbody\"></div></div></div>\n\n<section id=\"p4\" hidden></section>\n\n<section id=\"p5\" hidden>\n  <div class=\"card\"><h2>📞 Contactabilidad por mes</h2><div class=\"msg\" style=\"margin:-4px 0 8px\">Registros con <b>contacto = 1</b> ÷ total de registros de la base del mes. Respeta la campaña y los meses de arriba.</div><div id=\"ctchart\"></div></div>\n  <div class=\"card\"><div class=\"row\">\n    <label>Agente<select id=\"ra\"></select></label>\n  </div>\n  <div class=\"msg\">Cantidad de registros por resultado (columna X) de cada asesor (columna Q). Los filtros generales de arriba aplican; validación solo afecta la fila «venta».</div></div>\n  <div class=\"kpis\" id=\"rind\"></div>\n  <div class=\"card\"><div style=\"display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px\"><h2 style=\"margin:0\">Resultados por cantidad</h2><button class=\"btn pri\" id=\"apbtn\" type=\"button\" style=\"width:auto;margin:0\">👥 Aptos y efectividad por asesor</button></div><div id=\"rc\"></div></div>\n  <div id=\"rt\" hidden></div>\n</section>\n\n<section id=\"p7\" hidden>\n  <div class=\"kpis\" id=\"gk\"></div>\n  <div class=\"card\"><h2>Productos vendidos por campaña</h2><div class=\"msg\" style=\"margin:-6px 0 10px\">Qué producto (columna AM) se vendió en cada campaña (columna D). Respeta los filtros generales de arriba y la comparación por días hábiles.</div><div class=\"grid2\" id=\"gprod\"></div></div>\n  <div class=\"card\"><h2>🟣 Ventas por departamento, ciudad y datos de la base inicial</h2><div class=\"msg\" style=\"margin:-6px 0 4px\">Departamento y ciudad salen de la base de ventas de cada mes; sexo, estado civil, ocupación, ingresos, saldo y percentil salen de la base inicial (cruce por cédula; solo los meses que la tengan). <b>Efectividad = ventas ÷ registros</b>. Pasa el mouse por una fila para ver sus asesores. Respeta los filtros generales y la comparación por días hábiles; el semáforo solo marca grupos con 200 registros o más.</div><div id=\"dvini\" style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,500px),1fr));gap:0 14px;align-items:start\"></div></div>\n  <div class=\"msg\" id=\"gw\" style=\"margin:-6px 0 12px;color:var(--dng);font-weight:600\" hidden></div>\n  <div class=\"grid2\">\n    <div hidden><div id=\"gd\"></div><div id=\"gc\"></div></div>\n  </div>\n  <div hidden><div id=\"ge1\"></div><div id=\"ge2\"></div><div id=\"get\"></div></div>\n  <div class=\"card\" hidden><div style=\"display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:8px\"><h2 id=\"grt\" style=\"margin:0\">Ranking de ventas · Ciudades</h2>\n    <div class=\"row fx\" style=\"--fc:#1f6feb;margin:0;padding:6px 10px;align-items:flex-end\">\n      <label>Ver<span class=\"seg\" id=\"grdim\"><button class=\"btn on\" type=\"button\" data-d=\"c\">🏙️ Ciudades</button><button class=\"btn\" type=\"button\" data-d=\"d\">🗺️ Departamentos</button><button class=\"btn\" type=\"button\" data-d=\"e\">👤 Edades</button></span></label>\n      <label>Medida<span class=\"seg\" id=\"grmb\"><button class=\"btn on\" type=\"button\" data-m=\"v\">Ventas</button><button class=\"btn\" type=\"button\" data-m=\"p\">Producción</button></span></label>\n      <label>Mostrar<select id=\"grk\"><option value=\"10\">Top 10</option><option value=\"15\" selected>Top 15</option><option value=\"20\">Top 20</option></select></label>\n      <input type=\"hidden\" id=\"grm\" value=\"v\"></div></div>\n    <div class=\"msg\" style=\"margin:0 0 4px\">Pasa el mouse por un punto para ver sus ventas y su producción completa.</div>\n    <div id=\"grc\"></div><div id=\"grd\" hidden></div><div id=\"gre\" hidden></div>\n  </div>\n  <div class=\"card\"><h2>Flujo por mes</h2>\n    <div class=\"row\" style=\"margin-bottom:10px\"><label>Ver por<select id=\"gdim2\"><option value=\"d\">Departamento</option><option value=\"c\">Ciudad</option><option value=\"e\">Rango de edad</option></select></label><label>Mostrar<select id=\"gtop\"><option value=\"5\">Top 5</option><option value=\"8\">Top 8</option><option value=\"10\">Top 10</option></select></label><label>Medida<select id=\"gmed\"><option value=\"v\">Ventas (pólizas)</option><option value=\"p\">Producción</option></select></label></div>\n    <div id=\"gfl\"></div><div class=\"tbl\" id=\"gft\" style=\"margin-top:12px\"></div></div>\n</section>\n<section id=\"p10\" hidden>\n  <div class=\"subtabs\"><button class=\"stab on\" data-s=\"bs1\">🗂️ Registros de la base</button><button class=\"stab\" data-s=\"bs3\">🟣 Base inicial</button><button class=\"stab\" data-s=\"bs2\">🧠 Análisis inteligente</button></div>\n  <div id=\"bs3\" hidden>\n    <div class=\"card\"><div style=\"display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap\"><h2 style=\"margin:0\">🟣 Ventas según los datos de la base inicial</h2></div>\n      <div class=\"msg\" style=\"margin:6px 0 10px\">Cruza por cédula la base inicial con las ventas del mismo mes. <b>Efectividad = ventas ÷ registros</b>. Respeta la campaña, los meses y el resultado de validación de arriba.</div>\n      <div class=\"row fx\" style=\"--fc:#8b5cf6;margin:0 0 12px;padding:6px 10px;display:inline-flex\"><div><div style=\"font-size:12px;color:color-mix(in srgb,#8b5cf6 75%,var(--tx));margin-bottom:4px\">Ver por</div><span class=\"seg\" id=\"inidim\"></span></div></div>\n      <div class=\"msg\" id=\"iniinfo\" style=\"margin:0 0 8px\"></div>\n      <div class=\"tbl\" id=\"init\"></div></div>\n  </div>\n  <div id=\"bs2\" hidden>\n    <div class=\"card\"><div style=\"display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap\"><h2 style=\"margin:0\">🧠 Plan inteligente para trabajar la base</h2>\n      <div class=\"row fx\" style=\"--fc:#a05cd6;margin:0;padding:6px 10px\"><label>Base a trabajar<select id=\"iam\"></select></label></div></div>\n      <div class=\"msg\" id=\"iainfo\" style=\"margin:10px 0 0\"></div></div>\n    <div class=\"kpis\" id=\"iak\"></div>\n    <div class=\"card\"><h2>📋 Cómo trabajar esta base</h2><div id=\"iarec\"></div></div>\n    <div class=\"card\"><h2>🏆 Lotes recomendados (en este orden)</h2>\n      <div class=\"msg\" style=\"margin:-4px 0 10px\">Cada registro de la base recibe una <b>probabilidad de venta</b> según cuánto se ha vendido históricamente en su ciudad (apoyada en su departamento cuando la ciudad tiene pocos datos). Se ordenan de mayor a menor y se parten en 3 lotes del mismo tamaño.</div>\n      <div id=\"ialotes\"></div></div>\n    <div class=\"card\"><h2>👥 Asesores para cada lote</h2>\n      <div class=\"msg\" style=\"margin:-4px 0 10px\">Según su efectividad en el histórico (ventas ÷ registros que gestionaron): los mejores al Lote A, los del medio al B y el resto al C. No se incluyen los retirados.</div>\n      <div id=\"iaase\"></div></div>\n    <div class=\"card\" id=\"iabt\"><h2>✅ Comprobación con lo que ya pasó</h2><div id=\"iabtb\"></div></div>\n    <div class=\"card\"><h2>🎯 Estrategias que mejor han funcionado</h2><div id=\"iaest\"></div></div>\n  </div>\n  <div id=\"bs1\">\n  <div class=\"card\"><h2>Registros por departamento, ciudad y edad</h2>\n    <div class=\"geof\" id=\"geof7\">\n      <div class=\"tagbox\"><b>Ciudades</b><div class=\"tags\" id=\"rgc\"><input id=\"ric\" aria-label=\"Agregar ciudades\" list=\"rdlc\" placeholder=\"Escribe o pega y presiona Enter\" autocomplete=\"off\"></div><datalist id=\"rdlc\"></datalist></div>\n      <div class=\"tagbox\"><b>Departamentos</b><div class=\"tags\" id=\"rgd\"><input id=\"rid\" aria-label=\"Agregar departamentos\" list=\"rdld\" placeholder=\"Escribe o pega y presiona Enter\" autocomplete=\"off\"></div><datalist id=\"rdld\"></datalist></div>\n    </div>\n    <div class=\"msg\" id=\"rgmsg\"></div>\n    <div class=\"msg\">Cantidad de registros (filas de la base de cada mes) por departamento (columna K), ciudad (columna J) o rango de edad (columna M). Respeta la campaña y los meses de arriba.</div>\n    <div class=\"msg\" id=\"rgw\" style=\"color:var(--dng);font-weight:600\" hidden></div>\n    <div class=\"sbox\" style=\"--mc:#2aa6c9\"><h4>📈 Cantidad de base por mes</h4><div id=\"rgl\"></div></div>\n    <div class=\"row fx\" style=\"--fc:#1f6feb;margin:12px 0 10px;padding:6px 10px;display:inline-flex\"><label>Ver por<span class=\"seg\" id=\"rgdim\"><button class=\"btn on\" type=\"button\" data-d=\"d\">🗺️ Departamentos</button><button class=\"btn\" type=\"button\" data-d=\"c\">🏙️ Ciudades</button><button class=\"btn\" type=\"button\" data-d=\"e\">👤 Rangos de edad</button></span></label></div>\n    <div class=\"tbl\" id=\"rgt\" style=\"max-height:620px;overflow:auto\"></div><div id=\"rgtd\" hidden></div><div id=\"rgtc\" hidden></div></div>\n  </div>\n</section>\n<section id=\"p9\" hidden>\n  <div class=\"card\"><div class=\"row\">\n    <label>Ver<select id=\"cmed\"><option value=\"p\">Producción ($)</option><option value=\"v\">Ventas (pólizas)</option></select></label>\n  </div><div class=\"msg\">Aplican los filtros generales: <b>campaña</b> (con «Todas» se suman las metas de Odontológico y Salud para ti), <b>mes</b> y <b>resultado de validación</b> (para ver solo lo expedido, deja marcado únicamente «venta_expedida»). Meta = la de «Cargar información › Metas del mes» · Cumplimiento = logrado ÷ meta.</div><div class=\"msg\" id=\"cfil\"></div></div>\n  <div class=\"kpis\" id=\"ck\"></div>\n  <div class=\"card\"><h2 id=\"ctit\">Meta vs. producción por mes</h2><div id=\"cchart\"></div></div>\n  <div id=\"ctab\" hidden></div>\n  <h2 style=\"margin:22px 0 10px;font-size:18px\">📅 Agendas</h2>\n  <div class=\"card\">\n  <div class=\"geof geof3\" id=\"geof4\" style=\"margin-top:0\">\n    <div class=\"tagbox\"><b>Ciudades</b><div class=\"tags\" id=\"tgc\"><input id=\"tic\" aria-label=\"Agregar ciudades\" list=\"dlc\" placeholder=\"Escribe o pega y presiona Enter\" autocomplete=\"off\"></div><datalist id=\"dlc\"></datalist></div>\n    <div class=\"tagbox\"><b>Departamentos</b><div class=\"tags\" id=\"tgd\"><input id=\"tid\" aria-label=\"Agregar departamentos\" list=\"dld\" placeholder=\"Escribe o pega y presiona Enter\" autocomplete=\"off\"></div><datalist id=\"dld\"></datalist></div>\n    <div class=\"tagbox\"><b>Productos</b><div class=\"tags\" id=\"tgp\"><input id=\"tip\" aria-label=\"Agregar productos\" list=\"dlp\" placeholder=\"Escribe o pega y presiona Enter\" autocomplete=\"off\"></div><datalist id=\"dlp\"></datalist></div>\n  </div>\n  <div class=\"msg\" id=\"geomsg\"></div>\n  <div class=\"msg\">Ventas (pólizas, columna AH) o producción (columna AG) de cada asesor (columna Q) por mes de la base.</div></div>\n  <div class=\"card\"><div style=\"display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:10px\"><div><div class=\"seg vbt\" id=\"g4v\" style=\"margin-bottom:10px\"><button class=\"btn\" data-v=\"map\" type=\"button\" title=\"Ciudades y departamentos\" aria-label=\"Ciudades y departamentos\">🗺️</button><button class=\"btn\" data-v=\"edad\" type=\"button\" title=\"Edades\" aria-label=\"Edades\">👤</button></div><h2 id=\"g4t\" style=\"margin:0\">Agendas (ventas) por mes</h2></div>\n    <div class=\"row fx\" style=\"--fc:#1f6feb;margin:0;padding:6px 10px\"><label>Agente<select id=\"ga\"></select></label>\n    <label>Ver en<select id=\"gm\"><option value=\"v\">Número de ventas (pólizas)</option><option value=\"p\">Producción ($)</option></select></label>\n    <label>Días hábiles<button class=\"btn\" id=\"dhbtn4\" type=\"button\" style=\"margin:0;width:auto;white-space:nowrap\">📅 Mes completo ▾</button></label></div></div>\n    <div id=\"dhpop4\" hidden style=\"margin:0 0 12px\"><div style=\"display:flex;justify-content:flex-end\"><button class=\"btn\" id=\"dhclose4\" type=\"button\" style=\"width:auto;margin:0 0 6px;padding:6px 14px;border-color:var(--dng);color:var(--dng);font-weight:600\">✕ Cerrar</button></div></div><div id=\"g4x\" hidden style=\"margin:0 0 14px\"></div><div id=\"g4s\"></div><div id=\"gl\"></div></div>\n  <div id=\"gt\" hidden></div>\n</section>\n<section id=\"p6\" hidden>\n  <div class=\"card\"><div class=\"msg\">Ventas = pólizas (AH) y producción = AG, por mes de la base. Usa los filtros generales de arriba.</div></div>\n  <div class=\"grid2\">\n    <div class=\"card\"><h2>Ventas por mes</h2><div id=\"v1\"></div></div>\n    <div class=\"card\"><h2>Producción por mes</h2><div id=\"v2\"></div></div>\n  </div>\n  <div class=\"card\"><h2>Resumen de campañas</h2><div class=\"tbl\" id=\"vt\"></div></div>\n</section>\n</div>";

function stvCrearApp(ROOT, API, ABIERTO){
const BLOQUEO = {}; // el overlay de la plataforma ya bloquea el scroll del fondo
let PERM = null;
const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const YEAR=2026;
let DB={}; // {"2026-09":{file,at,rows:[[agente,fecha,cant,prod,producto]]}}
let pending=null;
const $=id=>ROOT.getElementById(id);
const fmt=n=>new Intl.NumberFormat("es-CO").format(Math.round(n));
const money=n=>"$"+fmt(n);
const pretty=s=>String(s||"Sin agente").replace(/_/g," ").toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());

/* ---------- almacenamiento (IndexedDB con respaldo en memoria) ---------- */
/* Fase 215: lo que guardaba IndexedDB vive en el servidor (API, ver sura-televentas.js).
   Cada cambio se guarda con su propia llamada (API.guardar / API.eliminar / API.config). */

/* ---------- lectura del Excel ---------- */
function toISO(v){
  if(v==null||v==="")return null;
  if(typeof v==="number"){return new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10)}
  if(v instanceof Date){return v.toISOString().slice(0,10)}
  const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[0];
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return null;
}
const norm=s=>String(s==null?"":s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g,"_");
const EDADES=["18-25","26-35","36-45","46-55","56-65","66 o más"],SINE="Sin dato";
const AB=e=>e==null||isNaN(e)||e<10?SINE:e<=25?EDADES[0]:e<=35?EDADES[1]:e<=45?EDADES[2]:e<=55?EDADES[3]:e<=65?EDADES[4]:EDADES[5];
const KNOWNC=new Set(["odontologico","salud_para_ti"]),CALIAS={cn:"odontologico"}; // bases «cn» (jul-ago) = campaña Odontológico
const campProd=p=>{p=norm(p);return !p?null:p.includes("odonto")?"odontologico":p.includes("salud")?"salud_para_ti":"(otro producto)"};
const STDCOLS=new Set(["detalle_no_venta","producto","registro","gestionado","contacto","rpc","apto","cerrado","venta","venta_expedida","agente_validacion","id_agente_validacion","resultado_validacion","cantidad_poliza"]);
function parseBook(buf){
  const wb=XLSX.read(buf,{type:"array"});
  const name=wb.SheetNames.find(n=>n.toLowerCase()==="data")||wb.SheetNames[wb.SheetNames.length-1];
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null});
  const H=(rows[0]||[]).map(norm),col=(n,def)=>{const i=H.indexOf(n);return i>=0?i:def};
  // columnas por nombre (si no existe el nombre, se usa la letra de siempre)
  const cD=col("estrategia",3),cJ=col("ciudad",9),cK=col("departamento",10),cM=col("edad",12),cQ=col("agente",16),cV=col("fecha_venta",21),cX=col("resultado",23),
        cAH=col("cantidad_poliza",33),cCT=H.indexOf("contacto"),cAI=col("resultado_validacion",34),cAM=col("producto",38),cID=col("identificacion",7);
  let cAG=H.indexOf("total_valor_poliza_anualizado"),x12=false;
  if(cAG<0){const m=H.indexOf("total_valor_poliza_mes")>=0?H.indexOf("total_valor_poliza_mes"):H.indexOf("total_valor_poliza");if(m>=0){cAG=m;x12=true}else cAG=32}
  const sc=[];(rows[0]||[]).forEach((x,i)=>{if(i>=42&&x&&!STDCOLS.has(norm(x)))sc.push([i,String(x)])}); // campos de estrategia (AQ en adelante)
  const DCOL={};for(const k in DIC0){const i=H.findIndex(h=>DIC0[k].cols.includes(h));if(i>=0)DCOL[k]=i}
  const out=[],strat={},ag={},geo={},cd={},ct={},PDM={},pr={ids:[],d:[],c:[],e:[],a:[],k:[],r:[],D:[],C:[],A:[],K:[],R:[]},pD=new Map(),pC=new Map(),pA=new Map(),pK=new Map(),pR=new Map(),pix=(a,m,v)=>{let i=m.get(v);if(i==null){i=a.length;a.push(v);m.set(v,i)}return i};
  for(let i=1;i<rows.length;i++){
    const r=rows[i];if(!r)continue;if(r[cQ])r[cQ]=agFix(r[cQ]);const f=toISO(r[cV]);
    const c=parseFloat(r[cAH]),pv=parseFloat(r[cAG]);
    const cant=isNaN(c)?1:c,prod=isNaN(pv)?0:(x12?pv*12:pv);
    const cp0=norm(r[cD])||"(sin campaña)",cp=CALIAS[cp0]||cp0;  // campaña de la base (columna D)
    const sv=sc.map(([j])=>r[j]==null?"":String(r[j]).trim());
    const dp=norm(r[cK])||"(sin dato)",cy=norm(r[cJ])||"(sin dato)",ed=parseFloat(r[cM]),eb=AB(ed);
    if(f){const cv=KNOWNC.has(cp)?cp:(campProd(r[cAM])||cp);       // si D no dice la campaña, se toma del producto
      out.push([r[cQ]||"",f,cant,prod,r[cAM]||"",sv,r[cAI]==null?"":String(r[cAI]).trim(),cv,dp,cy,isNaN(ed)?null:ed,r[cID]==null?"":String(r[cID]).trim()])}
    {const id=r[cID]==null?"":String(r[cID]).trim();if(id){pr.ids.push(id);pr.d.push(pix(pr.D,pD,dp));pr.c.push(pix(pr.C,pC,cy));pr.e.push(isNaN(ed)?0:ed);pr.a.push(pix(pr.A,pA,r[cQ]?String(r[cQ]).trim():""));pr.k.push(pix(pr.K,pK,cp));pr.r.push(pix(pr.R,pR,r[cX]==null?"":String(r[cX]).trim()));for(const dk in DCOL){const A=pr["x_"+dk]||(pr["x_"+dk]=[]),V=pr["X_"+dk]||(pr["X_"+dk]=[]),mp=PDM[dk]||(PDM[dk]=new Map());A.push(pix(V,mp,dicCode(r[DCOL[dk]])))}}}
    if(cCT>=0){const o=ct[cp]||(ct[cp]={reg:0,c:0});o.reg++;if(parseFloat(r[cCT])===1)o.c++}
    {const G=geo[cp]||(geo[cp]={d:{},c:{},e:{},x:{}});G.d[dp]=(G.d[dp]||0)+1;G.c[cy]=(G.c[cy]||0)+1;G.e[eb]=(G.e[eb]||0)+1;const xk=dp+"\t"+cy+"\t"+eb;G.x[xk]=(G.x[xk]||0)+1}
    sc.forEach(([j,hd],t)=>{const v=sv[t];if(!v)return;const S=strat[cp]||(strat[cp]={}),s=S[hd]||(S[hd]={});s[v]=(s[v]||0)+1});
    if(r[cQ]&&r[cX]){const A=ag[cp]||(ag[cp]={}),x=A[r[cQ]]||(A[r[cQ]]={});x[r[cX]]=(x[r[cX]]||0)+1}
  }
  return {rows:out,total:rows.length-1,sheet:name,strat,ag,geo,pr,ct,sh:sc.map(x=>x[1]),x12,mixta:!Object.keys(geo).some(k=>KNOWNC.has(k))};
}

/* ---------- Página 1 ---------- */
function renderMonths(){
  $("months").innerHTML=MESES.map((n,i)=>{
    const k=`${YEAR}-${String(i+1).padStart(2,"0")}`,d=DB[k];
    return `<div class="m ${d?"ok":""}"><b>${n}</b>
      <small>${d?`✔ ${fmt(d.rows.reduce((s,r)=>s+r[2],0))} ventas<br>${d.file}<br>${"montada el "+new Date(d.at).toLocaleDateString("es-CO")+" "+new Date(d.at).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}${d.v>=2?(d.v>=3?"":"<br>⚠ sin ciudad/edad: reemplázala"):"<br>⚠ sin campaña (D): reemplázala"}${d.x12?"<br>Producción = valor mensual × 12":""}`:"Sin base cargada"}</small>
      <button class="btn ${d?"":"pri"}" data-up="${k}">${d?"Reemplazar":"Montar base"}</button>
      ${d?`<button class="btn del" data-del="${k}">Eliminar</button><button class="btn dl" data-dl="${k}">⬇ Descargar</button>`:""}</div>`}).join("");
}
$("months").addEventListener("click",async e=>{
  const u=e.target.dataset.up,d=e.target.dataset.del,dl=e.target.dataset.dl;
  if(u){pending=u;$("file").value="";$("file").click()}
  if(dl)descargarVentas(dl);
  if(d&&confirm("¿Eliminar la base de "+MESES[+d.slice(5)-1]+"?")){if(!await API.eliminar("ventas",d,$("msg")))return;delete DB[d];renderMonths();refresh();$("msg").textContent="Base eliminada."}
});
$("file").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f||!pending)return;
  $("msg").textContent="Procesando "+f.name+"…";
  try{
    const k=pending,buf=await f.arrayBuffer(),r=parseBook(buf);
    const bad=r.rows.filter(x=>x[1].slice(0,7)!==k).length;
    const nuevo={rows:r.rows,total:r.total,sheet:r.sheet,strat:r.strat,ag:r.ag,geo:r.geo,pr:r.pr,ct:r.ct,sh:r.sh,x12:r.x12,mixta:r.mixta};
    $("msg").textContent="Guardando "+f.name+" en la plataforma…";
    const meta=await API.guardar("ventas",k,f.name,buf,nuevo);
    DB[k]=Object.assign(nuevo,{file:meta.archivoNombre,at:meta.cargadoEn,v:18});delete DB[k].total;delete DB[k].sheet;
    renderMonths();refresh();
    $("msg").textContent=`${MESES[+k.slice(5)-1]}: ${r.rows.length} registros con venta de ${fmt(r.total)} filas leídas (hoja «${r.sheet}»).`+(bad?` ⚠ ${bad} tienen fecha de otro mes.`:"");
  }catch(err){$("msg").textContent=(err.guardando?"No se pudo guardar: ":"No pude leer el archivo: ")+err.message}
  pending=null;
});

/* ---------- Filtros globales: campaña (D), mes, validación (AI) ---------- */
const NV="(sin validación)",LEG="(base sin columna D)";
let VOFF=new Set(),MOFF=new Set();
const MK=()=>Object.keys(DB).filter(k=>!k.startsWith("__")).sort(),MKF=()=>MK().filter(k=>!MOFF.has(k)),mname=k=>MESES[+k.slice(5)-1];
const campOf=r=>r[7]||LEG,cOK=c=>!$("cf").value||c===$("cf").value,cName=c=>c===LEG||c[0]==="("?c:({odontologico:"Odontológico",salud_para_ti:"Salud para ti"})[c]||pretty(c);
// Formato nuevo (v2): por campaña. Bases antiguas: todo queda bajo LEG.
const stratOf=d=>{if(d.v>=2)return d.strat||{};const o={};for(const h in d.strat||{}){o[h]={};for(const v in d.strat[h])o[h][v]=d.strat[h][v].reg}return Object.keys(o).length?{[LEG]:o}:{}};
const agOf=d=>d.v>=2?(d.ag||{}):(d.ag?{[LEG]:d.ag}:{});
/* mismo asesor escrito distinto entre bases: tildes (no la ñ) y nombres incompletos */
let AGALIAS={}; // Fase 215: alias de asesores, del servidor (config "agalias")
function agFix(a){if(a==null)return a;let x=String(a).trim().toLowerCase().replace(/[áàä]/g,"a").replace(/[éèë]/g,"e").replace(/[íìï]/g,"i").replace(/[óòö]/g,"o").replace(/[úùü]/g,"u");return AGALIAS[x]||x}
function agFixDB(){for(const k of MK()){const d=DB[k];if(!d||d.__agf===2)continue;d.rows.forEach(r=>{if(r[0])r[0]=agFix(r[0])});
  const A=agOf(d);for(const c in A){const N={};for(const a in A[c]){const b=agFix(a),o=N[b]||(N[b]={});for(const r in A[c][a])o[r]=(o[r]||0)+A[c][a][r]}A[c]=N}
  if(d.pr&&d.pr.A){const old=d.pr.A,M=new Map(),NA=[];old.forEach((a,i)=>{const b=a?agFix(a):a;let j=M.get(b);if(j==null){j=NA.length;NA.push(b);M.set(b,j)}old[i]=j});d.pr.a=d.pr.a.map(i=>old[i]);d.pr.A=NA}
  d.__agf=2}}
function all(){return MK().flatMap(k=>DB[k].rows)}
/* ---------- Días hábiles (Colombia: fines de semana y festivos, Ley Emiliani) ---------- */
const FCACHE={},ymd=(y,m,d)=>new Date(Date.UTC(y,m-1,d)),iso=d=>d.toISOString().slice(0,10),addD=(d,n)=>new Date(d.getTime()+n*864e5);
const lunes=d=>{const w=d.getUTCDay();return w===1?d:addD(d,(8-w)%7)};
function pascua(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=(h+l-7*m+114)%31+1;return ymd(y,mo,da)}
function festivos(y){
  if(FCACHE[y])return FCACHE[y];const E=pascua(y),F=[];
  [[1,1],[5,1],[7,20],[8,7],[12,8],[12,25]].forEach(([m,d])=>F.push(ymd(y,m,d)));             // fijos
  [[1,6],[3,19],[6,29],[8,15],[10,12],[11,1],[11,11]].forEach(([m,d])=>F.push(lunes(ymd(y,m,d)))); // se corren al lunes
  F.push(addD(E,-3),addD(E,-2),lunes(addD(E,39)),lunes(addD(E,60)),lunes(addD(E,68)));          // Semana Santa, Ascensión, Corpus, Sagrado Corazón
  return FCACHE[y]=new Set(F.map(iso));
}
const esHabil=s=>{if(!s||s.length<10)return false;const d=new Date(s.slice(0,10)+"T00:00:00Z"),w=d.getUTCDay();return w!==0&&w!==6&&!festivos(+s.slice(0,4)).has(s.slice(0,10))};
const HCACHE={};
function habMes(ym){ // lista de días hábiles del mes 'YYYY-MM'
  if(HCACHE[ym])return HCACHE[ym];const y=+ym.slice(0,4),m=+ym.slice(5,7),L=[];
  for(let d=ymd(y,m,1);d.getUTCMonth()===m-1;d=addD(d,1)){const s=iso(d);if(esHabil(s))L.push(s)}
  return HCACHE[ym]=L;
}
const habIdx=s=>{const L=habMes(s.slice(0,7));return L.indexOf(s.slice(0,10))+1};          // n-ésimo día hábil (0 si no es hábil)
const habHasta=s=>habMes(s.slice(0,7)).filter(x=>x<=s.slice(0,10)).length;                  // días hábiles transcurridos hasta esa fecha
let DHN=0;
function dOK(f,k){if(!f||!DHN)return true;if(k&&f.slice(0,7)!==k)return false;const i=esHabil(f)?habIdx(f):habHasta(f)+0.5;return i<=DHN}
const lastSale=k=>DB[k].rows.reduce((m,r)=>r[1]&&r[1].slice(0,7)===k&&r[1]>m?r[1]:m,"");
const hoyISO=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
function corte(){ // días hábiles que lleva el último mes cargado: hasta el último día hábil antes de hoy si es el mes en curso
  const ks=MK(),k=ks[ks.length-1];if(!k)return {k:null,n:0,hasta:""};
  const hoy=hoyISO();
  if(hoy.slice(0,7)===k){const ay=iso(addD(new Date(hoy+"T00:00:00Z"),-1));const L=habMes(k).filter(x=>x<=ay),h=L.length?L[L.length-1]:"";return {k,n:L.length,hasta:h,curso:true}}
  const ls=lastSale(k);return {k,n:ls?habHasta(ls):habMes(k).length,hasta:ls,curso:false};
}
function diasMes(k){const ls=lastSale(k),c=corte(),tr=c.curso&&c.k===k?c.n:habMes(k).length;return DHN?Math.min(DHN,tr):tr}
const fcorta=s=>+s.slice(8,10)+" "+MESES[+s.slice(5,7)-1].slice(0,3).toLowerCase();
function setupDH(){
  const mx=Math.max(23,...MK().map(k=>habMes(k).length));
  $("dh").innerHTML='<option value="0">Mes completo</option>'+Array.from({length:mx},(_,i)=>`<option value="${i+1}">Primeros ${i+1} días hábiles</option>`).join("");
  $("dh").value=String(DHN);
  const c=corte();
  $("dhtog").textContent=DHN?`✅ Comparando los primeros ${DHN} días hábiles de cada mes · clic para ver meses completos`:`📅 Comparar a la misma fecha${c.n?` (${c.n} días hábiles)`:""}`;
  if($("dhbtn4"))$("dhbtn4").textContent=DHN?`✅ Primeros ${DHN} días hábiles ▾`:`📅 Mes completo ▾`;
  if(!c.k){$("dhinfo").innerHTML="";return}
  let h=`<div class="msg" style="margin:0 0 8px">${mname(c.k)} lleva <b>${c.n} de ${habMes(c.k).length}</b> días hábiles${c.hasta?` (${c.curso?"último día hábil: "+["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][new Date(c.hasta+"T12:00:00Z").getUTCDay()]+" ":"hasta "}${fcorta(c.hasta)})`:""}. Se cuentan lunes a viernes sin festivos de Colombia.</div>`;
  if(DHN){
    if(CURTAB==="p9"&&(GF.c.size||GF.d.size))h+=`<div class="msg" style="margin:0 0 8px">📍 Filtrado por ${[...GF.c,...GF.d].map(pretty).join(", ")}</div>`;
    const R=rows(true).filter(r=>CURTAB!=="p9"||geoOK(r)),T={};R.forEach(r=>{const o=T[r.k]||(T[r.k]={v:0,p:0});o.v+=r[2];o.p+=r[3]});
    const ks=MKF(),L=ks.map(k=>{const H=habMes(k),n=Math.min(DHN,H.length);return {k,n,ini:H[0],fin:H[n-1],v:(T[k]||{}).v||0,p:(T[k]||{}).p||0}});
    const best=Math.max(...L.map(x=>x.v)),ref=L.find(x=>x.k===c.k)||L[L.length-1];
    h+=`<div class="tbl"><table><tr><th>Mes</th><th>Días comparados</th><th>Ventas (pólizas)</th><th>Producción</th><th>Diferencia vs ${mname(ref.k)}</th></tr>`+
      L.map(x=>{const d=x.v-ref.v;return `<tr${x.v===best&&best>0?' style="background:color-mix(in srgb,var(--ac2) 14%,transparent)"':""}><td><b>${mname(x.k)}</b>${x.v===best&&best>0?" 🏆":""}</td><td>${x.n} días · del ${fcorta(x.ini)} al ${fcorta(x.fin)}</td><td><b>${fmt(x.v)}</b></td><td>${money(x.p)}</td><td>${x===ref?"—":d===0?"igual":`${d>0?"+":""}${fmt(d)} pólizas`}</td></tr>`}).join("")+`</table></div>`;
    const prev=L.filter(x=>x!==ref);
    if(prev.length){const p=prev[prev.length-1],d=ref.v-p.v;
      h+=`<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--bg)">A la misma altura (${DHN} días hábiles), <b>${mname(ref.k)}</b> lleva <b>${fmt(ref.v)}</b> pólizas y <b>${mname(p.k)}</b> llevaba <b>${fmt(p.v)}</b>: ${d===0?"van iguales.":d>0?`${mname(ref.k)} va <b style="color:var(--ac2)">${fmt(d)} arriba</b> (${p.v?"+"+(d/p.v*100).toFixed(0)+"%":""}).`:`${mname(ref.k)} va <b style="color:var(--dng)">${fmt(-d)} abajo</b> (${(d/p.v*100).toFixed(0)}%).`}</div>`}
    h+=`<div class="msg">Las gráficas y tablas de esta pestaña solo cuentan esos días (según la fecha de venta, columna V).</div>`;
  }
  $("dhinfo").innerHTML=h;
}
$("dh").addEventListener("change",()=>{DHN=+$("dh").value;drawAll()});
$("dhtog").addEventListener("click",()=>{DHN=DHN?0:corte().n;drawAll()});
function rows(dh){return MKF().flatMap(k=>DB[k].rows.filter(r=>!VOFF.has(r[6]||NV)&&cOK(campOf(r))&&(!dh||dOK(r[1],k))).map(r=>{const x=r.slice();x.k=k;return x}))}
/* asesores quitados / agregados por campaña (solo gráfica Ventas por agente, KPIs de Agentes y Cumplimiento individual) */
const AGC=()=>DB.__agc||(DB.__agc={});
const agL=(c,t)=>((DB.__agc||{})[c]||{})[t]||[];
function agCnt(a,rc,c){if(!c)return true;if(rc===c)return !agL(c,"out").includes(a);return agL(c,"in").includes(a)}
function rowsA(dh){const c=$("cf").value;return MKF().flatMap(k=>DB[k].rows.filter(r=>!VOFF.has(r[6]||NV)&&agCnt(r[0],campOf(r),c)&&(!dh||dOK(r[1],k))).map(r=>{const x=r.slice();x.k=k;return x}))}
function chips(el,vals,off,lab){el.innerHTML=vals.length?vals.map(v=>`<label class="chip"><input type="checkbox" value="${v}" ${off.has(v)?"":"checked"}> ${lab?lab(v):v}</label>`).join(""):'<span class="msg">Sin datos</span>'}
function setupG(){
  const a=all(),cs=new Set(a.map(campOf));
  ["salud_para_ti","odontologico"].forEach(c=>cs.add(c));sel($("cf"),[["","Todas las campañas"],...[...cs].sort((a,b)=>(a[0]==="(")-(b[0]==="(")||a.localeCompare(b)).map(c=>[c,cName(c)])]);cfBtns();
  chips($("mf"),MK(),MOFF,mname);
  chips($("vf"),[...new Set(a.map(r=>r[6]||NV))].sort(),VOFF);
  const leg=MK().filter(k=>!(DB[k].v>=2)),mix=MKF().filter(k=>DB[k].mixta);
  $("legw").hidden=!leg.length&&!(mix.length&&$("cf").value);
  $("legw").textContent=leg.length?`⚠ ${leg.map(mname).join(", ")}: base cargada sin la columna D, aparece como «${LEG}». Reemplázala en «Cargar información» con el mismo Excel para separar Salud para ti y Odontológico.`:"";
  if(mix.length&&$("cf").value)$("legw").textContent+=(leg.length?" ":"")+`ℹ️ ${mix.map(mname).join(", ")}: la columna D de la base dice «cn», así que las ventas se separan por producto (columna AM), pero los registros de la base no. Con una campaña elegida, la efectividad y los resultados de esos meses no se pueden calcular.`;
}
const CICO=c=>`<span class="camp-ico" aria-hidden="true">${c==="odontologico"?"🦷":"💙"}</span>`; // Fase 217: icono de campaña con tamaño propio
function cfBtns(){const v=$("cf").value;$("cfb").innerHTML=[...$("cf").options].map(o=>`<button class="btn ${o.value===v?"on":""}" data-v="${o.value}">${o.value==="odontologico"||o.value==="salud_para_ti"?CICO(o.value)+" ":""}${o.textContent}</button>`).join("")}
$("cfb").addEventListener("click",e=>{const x=e.target.closest("button");if(!x)return;$("cf").value=x.dataset.v;cfBtns();$("cf").dispatchEvent(new Event("change"))});
$("cf").addEventListener("change",()=>{setupG();drawAll()});
[["mf",()=>MOFF],["vf",()=>VOFF]].forEach(([id,S])=>$(id).addEventListener("change",e=>{const v=e.target.value;e.target.checked?S().delete(v):S().add(v);drawAll()}));
function drawAll(){setupDH();draw();draw3();draw4();draw5();draw6();draw7();draw8();draw9();if(!$("bs2").hidden)drawIA();if(!$("bs3").hidden)drawIni()}

/* ---------- Página 2 ---------- */
function refresh(){
  setupG();setupDH();
  const a=all(),ds=a.map(x=>x[1]).sort();
  const prods=[...new Set(a.map(x=>x[4]).filter(Boolean))].sort(),cur=$("fp").value;
  $("fp").innerHTML='<option value="">Todos</option>'+prods.map(p=>`<option ${p===cur?"selected":""}>${p}</option>`).join("");
  if(ds.length){
    if(!$("fd").value||$("fd").value<ds[0])$("fd").value=ds[0];
    if(!$("fh").value||$("fh").value>ds[ds.length-1])$("fh").value=ds[ds.length-1];
  }else{$("fd").value="";$("fh").value=""}
  setup4();setup5();drawAll();
}
function bars(el,data,key,p,f){
  if(!data.length){el.innerHTML='<div class="empty">Sin datos para mostrar</div>';return}
  const mx=Math.max(...data.map(x=>x[key]));
  el.innerHTML=data.map(x=>`<div class="bar ${p?"p":""}"><span class="n" title="${x.n}">${x.n}</span><span class="t"><i style="width:${mx?x[key]/mx*100:0}%"></i></span><span class="v">${f(x[key])}</span></div>`).join("");
}
function draw(){
  const d1=$("fd").value,d2=$("fh").value,pr=$("fp").value;
  const R=rowsA();agcNote();
  const m={};
  R.forEach(r=>{const o=m[r[0]]||(m[r[0]]={n:pretty(r[0]),v:0,p:0,reg:0});o.v+=r[2];o.p+=r[3];o.reg++});
  const L=Object.values(m),tv=L.reduce((s,x)=>s+x.v,0),tp=L.reduce((s,x)=>s+x.p,0);
  $("k1").textContent=fmt(tv);$("k2").textContent=money(tp);{const ks=MKF(),KC=ks[ks.length-1];$("k3").textContent=KC?new Set(R.filter(r=>r.k===KC&&r[2]>0).map(r=>r[0])).size:0;$("k3l").textContent="Agentes con ventas"+(KC?" en "+mname(KC):"")}$("k4").textContent=money(tv?tp/tv:0);
  {const m=C1M;$("c1t").textContent=m==="p"?"Producción por agente ($)":"Ventas por agente (cantidad de pólizas)";
   rankLine($("c1"),[...L].filter(x=>x[m]>0).sort((a,b)=>b[m]-a[m]).map(x=>({n:x.n,y:x[m],v:x.v,p:x.p})),m==="p"?(v=>"$"+(v>=1e6?(v/1e6).toFixed(1).replace(".",",")+"M":fmt(v))):fmt,true,true);}
}
function sel(el,o){const c=el.value;el.innerHTML=o.map(([v,t])=>`<option value="${v}" ${v===c?"selected":""}>${t}</option>`).join("")}
const SH=d=>d.sh||(d.rows[0]&&d.rows[0][5]?d.rows[0][5].map((_,i)=>"estrategia "+(i+1)):[]);
/* ---------- Archivos originales (para Descargar) ---------- */
const ORIGT={v:"ventas",e:"estrategias",i:"inicial"};
async function origGet(t,k){return await API.archivo(ORIGT[t],k)}
function bajar(name,buf){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([buf]));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function bajarAOA(name,aoa,hoja){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),hoja);XLSX.writeFile(wb,name)}
async function descargarVentas(k){
  const o=await origGet("v",k);if(o){bajar(o.name,o.buf);return}
  if(!confirm(`El Excel original de ${mname(k)} no está guardado en la plataforma.\n\nPara poder descargarlo tal cual, usa «Reemplazar» en ${mname(k)} con ese mismo Excel una sola vez.\n\n¿Quieres descargar por ahora solo las ventas que tiene la plataforma?`))return;
  const d=DB[k];
  bajarAOA(`ventas_${mname(k).toLowerCase()}_${k.slice(0,4)}.xlsx`,[["identificacion","agente","fecha_venta","cantidad_poliza","produccion_anualizada","producto","resultado_validacion","campaña","departamento","ciudad","edad"],
    ...d.rows.map(r=>[r[11]||"",r[0],r[1],r[2],r[3],r[4],r[6],r[7],r[8],r[9],r[10]])],"Ventas");
  $("msg").textContent=`${mname(k)}: se descargaron las ${fmt(d.rows.length)} ventas que tiene la plataforma (el Excel original completo solo se guarda cuando lo montas desde este navegador).`;
}
/* ---------- Bases de estrategias (sección verde) ---------- */
const EST=()=>DB.__est||(DB.__est={});
let epending=null;
const hn=h=>norm(h).replace(/[^a-z0-9]/g,"");
function parseEst(buf){
  const wb=XLSX.read(buf,{type:"array"});let A=null,sheet=null,H=null,iId=-1;
  for(const sn of wb.SheetNames){const R=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:null});const h=(R[0]||[]).map(hn);
    const ii=h.findIndex(x=>["identificacion","cedula","documento","numeroidentificacion","numerodeidentificacion","nroidentificacion"].includes(x));if(ii>=0){A=R;sheet=sn;H=h;iId=ii;break}}
  if(!A)throw new Error("no encontré la columna de identificación (cédula).");
  const iCp=H.indexOf("estrategia"),C=[],Ci=new Map(),ix=(arr,map,v)=>{let i=map.get(v);if(i==null){i=arr.length;arr.push(v);map.set(v,i)}return i};
  const cols=[];for(let n=1;n<=20;n++){const ie=H.indexOf("estrategia"+n),il=H.indexOf("lote"+n);if(ie>=0||il>=0)cols.push({num:n,ie,il,N:[],L:[],Nm:new Map(),Lm:new Map(),n:[],l:[]})}
  if(!cols.length)throw new Error("no encontré columnas «Estrategia # 1…» / «Lote # 1…».");
  const ids=[],cp=[];
  for(let r=1;r<A.length;r++){const R=A[r];if(!R)continue;const id=R[iId]==null?"":String(R[iId]).trim();if(!id)continue;
    ids.push(id);cp.push(ix(C,Ci,iCp>=0?(norm(R[iCp])||"(sin campaña)"):"(sin campaña)"));
    cols.forEach(c=>{const nm=c.ie>=0&&R[c.ie]!=null?String(R[c.ie]).trim():"",lt=c.il>=0&&R[c.il]!=null?String(R[c.il]).trim():"";
      c.n.push(nm?ix(c.N,c.Nm,nm)+1:0);c.l.push(lt?ix(c.L,c.Lm,lt)+1:0)})}
  return {ids,cp,C,sheet,cols:cols.filter(c=>c.n.some(Boolean)||c.l.some(Boolean)).map(c=>({num:c.num,N:c.N,L:c.L,n:c.n,l:c.l}))};
}
function renderEst(){
  $("emonths").innerHTML=MESES.map((nm,i)=>{const k=`${YEAR}-${String(i+1).padStart(2,"0")}`,d=EST()[k];
    const ne=d?d.cols.reduce((s,c)=>s+c.N.length,0):0;
    return `<div class="m ${d?"ok":""}"><b>${nm}</b><small>${d?`✔ ${fmt(d.ids.length)} registros · ${ne} estrategias<br>${d.file}<br>${"montada el "+new Date(d.at).toLocaleDateString("es-CO")}${DB[k]?"":"<br>⚠ falta la base de ventas de este mes"}`:"Sin base de estrategias"}</small>
      <button class="btn ${d?"":"pri"}" data-eup="${k}">${d?"Reemplazar":"Montar base"}</button>
      ${d?`<button class="btn del" data-edel="${k}">Eliminar</button><button class="btn dl" data-edl="${k}">⬇ Descargar</button>`:""}</div>`}).join("");
}
async function descargarEst(k){
  const o=await origGet("e",k);if(o){bajar(o.name,o.buf);return}
  if(!confirm(`El Excel original de estrategias de ${mname(k)} no está guardado en la plataforma.\n\nPara poder descargarlo tal cual, usa «Reemplazar» con ese mismo Excel una sola vez.\n\n¿Quieres descargar por ahora la base que tiene la plataforma (mismas columnas y registros)?`))return;
  const d=EST()[k],H=["identificacion","estrategia",...d.cols.map(c=>"Estrategia # "+c.num),...d.cols.map(c=>"Lote # "+c.num)];
  bajarAOA(`estrategias_${mname(k).toLowerCase()}_${k.slice(0,4)}.xlsx`,[H,...d.ids.map((id,i)=>[id,d.C[d.cp[i]],...d.cols.map(c=>c.n[i]?c.N[c.n[i]-1]:""),...d.cols.map(c=>c.l[i]?c.L[c.l[i]-1]:"")])],"Estrategias");
}
$("emonths").addEventListener("click",async e=>{
  const u=e.target.dataset.eup,d=e.target.dataset.edel,dl=e.target.dataset.edl;
  if(u){epending=u;$("efile").value="";$("efile").click()}
  if(dl)descargarEst(dl);
  if(d&&confirm("¿Eliminar la base de estrategias de "+mname(d)+"?")){if(!await API.eliminar("estrategias",d,$("emsg")))return;delete EST()[d];renderEst();draw3();$("emsg").textContent="Base de estrategias eliminada."}
});
$("efile").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f||!epending)return;const k=epending;epending=null;$("emsg").textContent="Procesando "+f.name+"…";
  try{const buf=await f.arrayBuffer(),r=parseEst(buf);$("emsg").textContent="Guardando "+f.name+" en la plataforma…";const meta=await API.guardar("estrategias",k,f.name,buf,r);EST()[k]=Object.assign({file:meta.archivoNombre,at:meta.cargadoEn},r);renderEst();draw3();
    const vs=DB[k]?new Set(DB[k].rows.map(x=>x[11])):null,ids=new Set(r.ids),cr=vs?[...vs].filter(x=>ids.has(x)).length:0;
    $("emsg").textContent=`${mname(k)}: ${fmt(r.ids.length)} registros y ${r.cols.length} columnas de estrategia (hoja «${r.sheet}»).`+(vs?` ${fmt(cr)} de ${fmt(vs.size)} ventas del mes cruzaron por cédula.`:" Aún no hay base de ventas de este mes para cruzar.");}
  catch(err){$("emsg").textContent=(err.guardando?"No se pudo guardar: ":"No pude leer el archivo: ")+err.message}
});
/* ---------- Página 3: Estrategias y lotes ---------- */
/* la venta cuenta para la ÚLTIMA estrategia en la que se montó el cliente (el número más alto que tenga) */
const estUlt=(E,i)=>{let u=0;E.cols.forEach(c=>{if(c.n[i]&&c.num>u)u=c.num});return u};
function estData(){
  const ks=MKF().filter(k=>EST()[k]),G={},tot={reg:0,v:0,p:0,s:0},nos={v:0,s:0};
  const get=(num,name)=>{const id=num+"|"+name;return G[id]||(G[id]={id,num,name,reg:0,v:0,p:0,s:0,lotes:{},ix:{}})};
  const R=rows();
  ks.forEach(k=>{const E=EST()[k],S=new Map();
    R.forEach(r=>{if(r.k!==k)return;const o=S.get(r[11])||{v:0,p:0,s:0};o.v+=r[2];o.p+=r[3];o.s++;S.set(r[11],o)});
    const seen=new Set();
    E.ids.forEach((id,i)=>{if(!cOK(E.C[E.cp[i]]))return;const sv0=S.get(id),ult=estUlt(E,i);let any=false;
      E.cols.forEach(c=>{const ni=c.n[i];if(!ni)return;any=true;const sv=c.num===ult?sv0:null;const g=get(c.num,c.N[ni-1]),lt=c.l[i]?c.L[c.l[i]-1]:"(sin lote)",L=g.lotes[lt]||(g.lotes[lt]={n:lt,reg:0,v:0,p:0,s:0,ix:{}});(g.ix[k]||(g.ix[k]=[])).push(i);(L.ix[k]||(L.ix[k]=[])).push(i);
        g.reg++;L.reg++;if(sv){g.v+=sv.v;g.p+=sv.p;g.s+=sv.s;L.v+=sv.v;L.p+=sv.p;L.s+=sv.s}});
      if(any){tot.reg++;if(sv0&&!seen.has(id)){seen.add(id);tot.v+=sv0.v;tot.p+=sv0.p;tot.s+=sv0.s}}});
    S.forEach((o,id)=>{if(!seen.has(id)){nos.v+=o.v;nos.s+=o.s}});
  });
  Object.values(G).forEach(g=>{g.ef=g.reg?g.v/g.reg*100:0;Object.values(g.lotes).forEach(l=>l.ef=l.reg?l.v/l.reg*100:0)});
  return {ks,G:Object.values(G).sort((a,b)=>a.num-b.num||b.reg-a.reg),tot,nos};
}
const efs=v=>v.toFixed(2).replace(".",",")+"%",rpv=(r,v)=>v?(r/v).toFixed(1).replace(".",","):"—";
function draw3(){
  const D=estData();
  const sin=MKF().filter(k=>DB[k]&&!EST()[k]);
  $("sinfo").innerHTML=(D.ks.length?`Meses con base de estrategias: <b>${D.ks.map(mname).join(", ")}</b>.`:"")+(sin.length?` Sin base de estrategias: ${sin.map(mname).join(", ")}.`:"");
  if(!D.ks.length||!D.G.length){$("slt").innerHTML="";$("stab").innerHTML='<div class="empty">Monta la base de estrategias del mes en «Cargar información» (sección verde) y activa ese mes en los filtros.</div>';sel($("ses"),[]);return}
  // filtro: todas, un número de estrategia o una sola estrategia
  const nums=[...new Set(D.G.map(g=>g.num))],fc=$("sfil").value;
  $("sfil").innerHTML='<option value="">Todas las estrategias</option>'+nums.map(n=>`<optgroup label="Estrategia # ${n}"><option value="n${n}">Estrategia # ${n} (todas)</option>${D.G.filter(g=>g.num===n).map(g=>`<option value="${g.id}">${g.name}</option>`).join("")}</optgroup>`).join("");
  if([...$("sfil").options].some(o=>o.value===fc))$("sfil").value=fc;
  const f=$("sfil").value,V=D.G.filter(g=>!f||(f[0]==="n"&&f.indexOf("|")<0?g.num===+f.slice(1):g.id===f));
  // semáforo dentro de cada número de estrategia
  const sem=g=>semOf(g.ef,D.G.filter(x=>x.num===g.num).map(x=>x.ef));
  const lab={g:"Mejor",y:"Media",r:"Más baja"};
  let last=null;
  $("stab").innerHTML=`<table><tr><th>Estrategia</th><th>Registros</th><th>Ventas (pólizas)</th><th>Efectividad</th><th style="text-align:center">Asesores</th></tr>`+
    V.map(g=>{const h=g.num!==last?`<tr class="grp"><td colspan="5">Estrategia # ${g.num}</td></tr>`:"";last=g.num;const c=sem(g);
      return h+`<tr class="clk" data-g="${g.id}" title="Clic para ver el resumen"><td><span class="sem ${c}" title="${lab[c]}"></span>${g.name}</td><td>${fmt(g.reg)}</td><td>${fmt(g.v)}</td><td><b class="semt ${c}">${efs(g.ef)}</b></td><td style="text-align:center"><button class="pbtn" data-ag="${g.id}" title="Ver asesores"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg></button></td></tr>`}).join("")+`</table>`;
  const cur=$("ses").value;sel($("ses"),D.G.map(g=>[g.id,`Estrategia # ${g.num} · ${g.name}`]));if(cur&&D.G.some(g=>g.id===cur))$("ses").value=cur;
  draw3l(D);
}
function draw3l(D){
  D=D||estData();const g=D.G.find(x=>x.id===$("ses").value)||D.G[0];if(!g)return;
  const L=Object.values(g.lotes).sort((a,b)=>a.n.localeCompare(b.n,"es",{numeric:true}));
  $("slt").innerHTML=`<table><tr><th>Lote</th><th>Registros</th><th>Ventas (pólizas)</th><th>Efectividad</th><th style="text-align:center">Asesores</th></tr>`+
    L.map(x=>{const c=semOf(x.ef,L.map(y=>y.ef));return `<tr class="clk" data-g="${g.id}" data-l="${x.n.replace(/"/g,"&quot;")}" title="Clic para ver el resumen"><td><span class="sem ${c}"></span>${x.n}</td><td>${fmt(x.reg)}</td><td>${fmt(x.v)}</td><td><b class="semt ${c}">${efs(x.ef)}</b></td><td style="text-align:center"><button class="pbtn" data-ag="${g.id}" data-agl="${x.n.replace(/"/g,"&quot;")}" title="Ver asesores"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/></svg></button></td></tr>`}).join("")+
    `<tr><th>Total</th><th>${fmt(g.reg)}</th><th>${fmt(g.v)}</th><th>${efs(g.ef)}</th><th></th></tr></table>`;
}
$("ses").addEventListener("change",()=>draw3l());$("sfil").addEventListener("change",draw3);
/* ---------- Semáforo y resumen emergente (Estrategias) ---------- */
function semRank(v,P){if(v===0)return "r";const S=[...P].sort((a,b)=>b-a),n=S.length;if(n<3)return semOf(v,P);const pos=S.indexOf(v)/n;return pos<1/3?"g":pos<2/3?"y":"r"}
function semOf(v,P){const mx=Math.max(...P),mn=Math.min(...P);if(mx===mn)return mx===0?"r":"y";const t=(mx-mn)/3;return v>=mx-t?"g":v<=mn+t?"r":"y"}
const PRX={};
function prMap(k){const d=DB[k];if(!d||!d.pr)return null;if(PRX[k]&&PRX[k].d===d)return PRX[k].m;const m=new Map();d.pr.ids.forEach((id,i)=>m.set(id,i));PRX[k]={d,m};return m}
const MF={c:new Set(),d:new Set()};let MS=null,MNO=[];
function resumen(gid,lote,keep){
  if(!keep){MF.c.clear();MF.d.clear()}MS={gid,lote};const fil=MF.c.size||MF.d.size,ALLC=new Map(),ALLD=new Map(),PRD={},PRA={},addPr=sv=>{if(sv){for(const p in sv.pr)PRD[p]=(PRD[p]||0)+sv.pr[p];for(const p in sv.pa||{}){const m=PRA[p]||(PRA[p]={});for(const a in sv.pa[p])m[a]=(m[a]||0)+sv.pa[p][a]}}};let TV=0,TR=0;
  const D=estData(),g=D.G.find(x=>x.id===gid);if(!g)return;const L=lote!=null?g.lotes[lote]:null,seg=L||g;
  const R=rows(),A={d:{},c:{},e:{}},IFS=INIF.filter(F=>["sexo","ec","oc","ing","saldo","pct"].includes(F.id)),AG={},addAg=(m,sv)=>{if(sv)for(const a in sv.ag)m[a]=(m[a]||0)+sv.ag[a]},
    AR={},AP={},add=(dim,key,sv,ase,ap)=>{const o=A[dim][key]||(A[dim][key]={n:key,reg:0,v:0,ag:{},ar:{},ap:{}});o.reg++;o.ar[ase]=(o.ar[ase]||0)+1;if(ap)o.ap[ase]=(o.ap[ase]||0)+1;if(sv){o.v+=sv.v;addAg(o.ag,sv)}};
  let sinDatos=0;const hasRR=Object.keys(seg.ix).some(k=>DB[k]&&DB[k].pr&&DB[k].pr.r);
  let hayIni=false;
  for(const k in seg.ix){const E=EST()[k],pm=prMap(k),pr=DB[k]&&DB[k].pr,S=new Map(),IN=INI()[k],ix=IN?new Map(IN.ids.map((x,i)=>[x,i])):null,IC=IN?IFS.map(F=>[F,IN.cols.find(c=>F.m(c.k))]).filter(x=>x[1]):[];if(IC.length)hayIni=true;
    R.forEach(r=>{if(r.k!==k)return;const o=S.get(r[11])||{v:0,ag:{},pr:{}};o.v+=r[2];o.ag[r[0]||""]=(o.ag[r[0]||""]||0)+r[2];const pn=prodName(r[4]),ag=r[0]||"";o.pr[pn]=(o.pr[pn]||0)+r[2];const pa=o.pa||(o.pa={}),q=pa[pn]||(pa[pn]={});q[ag]=(q[ag]||0)+r[2];S.set(r[11],o)});
    seg.ix[k].forEach(i=>{const id=E.ids[i],sv=estUlt(E,i)===g.num?S.get(id):undefined,j=pm?pm.get(id):undefined;
      if(j==null){if(!fil){addAg(AG,sv);addPr(sv);sinDatos++}return}
      const dp=pr.D[pr.d[j]],cy=pr.C[pr.c[j]];ALLD.set(dp,(ALLD.get(dp)||0)+1);ALLC.set(cy,(ALLC.get(cy)||0)+1);
      if((MF.c.size&&!MF.c.has(cy))||(MF.d.size&&!MF.d.has(dp)))return;
      addAg(AG,sv);addPr(sv);TR++;if(sv)TV+=sv.v;
      const ase=pr.A?pr.A[pr.a[j]]||"":"?",ap=prApto(pr,j);AR[ase]=(AR[ase]||0)+1;if(ap)AP[ase]=(AP[ase]||0)+1;
      add("d",pr.D[pr.d[j]],sv,ase,ap);add("c",pr.C[pr.c[j]],sv,ase,ap);add("e",AB(pr.e[j]||null),sv,ase,ap);
      if(ix){const ii=ix.get(id);IC.forEach(([F,c])=>{const dim="i_"+F.id;A[dim]=A[dim]||{};add(dim,ii==null?"(no está en la base inicial)":F.f(c.n?c.n[ii]:c.V[c.x[ii]]),sv,ase,ap)})}})}
  const tipPr=(m,titulo)=>{const L=Object.entries(m).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);if(!L.length)return `<b>${titulo}</b><br>Sin ventas`;
    return `<b>${titulo}</b><table class="tt"><tr><th>Asesor</th><th>Pólizas</th></tr>`+L.map(([a,v])=>`<tr><td>${a?pretty(a):"(sin asesor)"}</td><td>${fmt(v)}</td></tr>`).join("")+`</table>`};
  const tipAg=(m,ar,titulo,ap)=>{const AP0=ap;const names=new Set([...Object.keys(m),...Object.keys(ar||{})].filter(a=>a&&a!=="?"));
    const L=[...names].map(a=>({a,v:m[a]||0,r:(ar||{})[a]||0,ap:AP0?(AP0[a]||0):null})).map(x=>Object.assign(x,{ef:AP0?(x.ap?x.v/x.ap*100:0):(x.r?x.v/x.r*100:0)})).sort((x,y)=>y.v-x.v||y.ef-x.ef||y.r-x.r);
    const sin=(ar||{})[""]||0;
    if(!L.length)return `<b>${titulo}</b><br>Sin registros gestionados por asesores`;
    const P=L.filter(x=>AP0?x.ap:x.r).map(x=>x.ef);
    return `<b>${titulo}</b>${AP0?`<div style="opacity:.75;margin:2px 0">Efectividad = ventas ÷ aptos</div>`:""}<table class="tt"><tr><th>Asesor</th><th>Ventas</th><th>Registros</th>${AP0?"<th>Aptos</th>":""}<th>Efectividad</th></tr>`+
      L.map(x=>{const d=AP0?x.ap:x.r,c=d?semRank(x.ef,P):"r";return `<tr><td>${pretty(x.a)}</td><td>${fmt(x.v)}</td><td>${fmt(x.r)}</td>${AP0?`<td>${fmt(x.ap)}</td>`:""}<td><span class="semt ${c}">${d?efs(x.ef):"—"}</span></td></tr>`}).join("")+`</table>`+
      (sin?`<div style="opacity:.75;margin-top:4px">${fmt(sin)} registros sin asesor asignado (no gestionados)</div>`:"")};
  const esc=t=>t.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const tab=(dim,lim)=>{const FI=dim.startsWith("i_")?INIF.find(F=>"i_"+F.id===dim):null;let X=Object.values(A[dim]||{}).filter(x=>x.n&&(FI||x.n[0]!=="("));X.forEach(x=>x.ef=x.reg?x.v/x.reg*100:0);
    if(dim==="e")X=EDADES.map(e=>X.find(x=>x.n===e)).filter(Boolean);else if(FI)X=X.sort((a,b)=>{if(FI.ord){const p=FI.ord(a.n),q=FI.ord(b.n);return (p<0?99:p)>(q<0?99:q)?1:-1}return b.reg-a.reg});else X=X.filter(x=>x.v>0).sort((a,b)=>b.v-a.v||b.ef-a.ef);
    if(!X.length)return '<div class="empty">Sin ventas.</div>';const T=X.reduce((s,x)=>({reg:s.reg+x.reg,v:s.v+x.v}),{reg:0,v:0});
    const P=X.filter(x=>!FI||x.reg>=100).map(x=>x.ef),nm=x=>dim==="e"?x.n+" años":FI?x.n:pretty(x.n);
    return `<table><tr><th>${FI?FI.t.replace(/^\S+\s/,""):dim==="d"?"Departamento":dim==="c"?"Ciudad":"Rango de edad"}</th><th>Ventas (pólizas)</th><th>Registros</th><th>Aptos</th><th>Efectividad</th></tr>`+
      X.map(x=>{const c=FI&&x.reg<100?"":dim==="e"?semOf(x.ef,P):semRank(x.ef,P),na=Object.values(x.ap||{}).reduce((s,v)=>s+v,0);return `<tr class="hov" data-tip="${esc(tipAg(x.ag,x.ar,"Asesores en "+nm(x)+":",hasRR?x.ap:null))}"><td><span class="sem ${c}"></span>${nm(x)}</td><td><b>${fmt(x.v)}</b></td><td>${fmt(x.reg)}</td><td>${hasRR?fmt(na):"—"}</td><td><b class="semt ${c}">${efs(x.ef)}</b></td></tr>`}).join("")+
      `<tr class="hov" data-tip="${esc(tipAg(AG,AR,"Asesores en todo el grupo:",hasRR?AP:null))}"><th>Total ${fil?"filtrado":"del grupo"}</th><th>${fmt(fil?TV:seg.v)}</th><th>${fmt(fil?TR:seg.reg)}</th><th>${hasRR?fmt(Object.values(AP).reduce((s,v)=>s+v,0)):"—"}</th><th>${efs(fil?(TR?TV/TR*100:0):seg.ef)}</th></tr></table>`};
  $("mbody").innerHTML=`<h3>Estrategia # ${g.num} · ${g.name}${L?` · ${L.n}`:""}</h3>
    <div class="msg" style="margin:0 0 12px">${fmt(seg.reg)} registros · ${fmt(seg.v)} pólizas · efectividad <b>${efs(seg.ef)}</b></div>
    <div class="msg" style="margin:0 0 4px">Todos los departamentos y ciudades donde hubo ventas, de más a menos ventas. Registros = personas de este grupo en ese lugar · Efectividad = ventas ÷ registros. <b>Pasa el mouse por una fila para ver cada asesor: sus ventas, los registros que tocó y su efectividad.</b></div>
    <div class="geof" id="mgeof" style="margin-top:10px">
      <div class="tagbox"><b>Ciudades</b><div class="tags" id="mgc">${[...MF.c].map(k=>`<span class="tag" data-t="c" data-k="${esc(k)}">${pretty(k)}<button data-t="c" data-k="${esc(k)}" title="Quitar">✕</button></span>`).join("")}<input id="mic" aria-label="Agregar ciudades" list="mdlc" placeholder="Escribe o pega y presiona Enter" autocomplete="off"></div><datalist id="mdlc">${[...ALLC.entries()].filter(x=>x[0][0]!=="(").sort((a,b)=>b[1]-a[1]).map(([k])=>`<option value="${esc(pretty(k))}">`).join("")}</datalist></div>
      <div class="tagbox"><b>Departamentos</b><div class="tags" id="mgd">${[...MF.d].map(k=>`<span class="tag" data-t="d" data-k="${esc(k)}">${pretty(k)}<button data-t="d" data-k="${esc(k)}" title="Quitar">✕</button></span>`).join("")}<input id="mid" aria-label="Agregar departamentos" list="mdld" placeholder="Escribe o pega y presiona Enter" autocomplete="off"></div><datalist id="mdld">${[...ALLD.entries()].filter(x=>x[0][0]!=="(").sort((a,b)=>b[1]-a[1]).map(([k])=>`<option value="${esc(pretty(k))}">`).join("")}</datalist></div>
    </div>
    <div class="msg" id="mgmsg">${fil?`Mostrando solo ${[MF.c.size?"ciudades: "+[...MF.c].map(pretty).join(", "):"",MF.d.size?"departamentos: "+[...MF.d].map(pretty).join(", "):""].filter(Boolean).join(" y ")} · ${fmt(TR)} registros · ${fmt(TV)} pólizas · efectividad <b>${efs(TR?TV/TR*100:0)}</b>. <a href="#" id="mgclr">Quitar filtro</a>`:""}${MNO.length?` <span style="color:var(--dng)">No encontré registros en: ${MNO.join(", ")}.</span>`:""}</div>
    <div class="grid2"><div class="sbox" style="--mc:#1f6feb"><h4>🗺️ Ventas por departamento</h4><div class="tbl" style="max-height:420px;overflow:auto">${tab("d")}</div></div><div class="sbox" style="--mc:#a05cd6"><h4>🏙️ Ventas por ciudad</h4><div class="tbl" style="max-height:420px;overflow:auto">${tab("c")}</div></div></div>
    <div class="grid2"><div class="sbox" style="--mc:#e5833b"><h4>👤 Ventas por rango de edad</h4><div class="tbl">${tab("e")}</div></div>
    <div class="sbox" style="--mc:#12a37f"><h4>📦 Productos vendidos</h4><div class="tbl">${(()=>{const X=Object.entries(PRD).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]),T=X.reduce((s,x)=>s+x[1],0);
      return X.length?`<table><tr><th>Producto</th><th>Ventas (pólizas)</th><th>%</th></tr>`+X.map(([n,v])=>`<tr class="hov" data-tip="${esc(tipPr(PRA[n]||{},"Asesores que vendieron "+n+":"))}"><td>${n}</td><td><b>${fmt(v)}</b></td><td>${(v/T*100).toFixed(1).replace(".",",")}%</td></tr>`).join("")+`<tr class="hov" data-tip="${esc(tipPr(Object.values(PRA).reduce((m,x)=>{for(const a in x)m[a]=(m[a]||0)+x[a];return m},{}),"Asesores en todos los productos:"))}"><th>Total ${fil?"filtrado":"del grupo"}</th><th>${fmt(T)}</th><th>100%</th></tr></table>`:'<div class="empty">Sin ventas.</div>'})()}</div></div></div>`+
    (hayIni?`<h4 style="margin:18px 0 0;font-size:15px">🟣 Según los datos de la base inicial</h4><div class="grid2">`+IFS.filter(F=>A["i_"+F.id]).map((F,i)=>`<div class="sbox" style="--mc:${["#8b5cf6","#2aa6c9","#e255a1","#c9a227","#12a37f","#e5833b"][i%6]}"><h4>${F.t}</h4><div class="tbl">${tab("i_"+F.id)}</div></div>`).join("")+`</div><div class="msg">Cruce por cédula con la base inicial del mes (Cargar información › sección morada). Semáforo solo en grupos con 100 registros o más.</div>`:`<div class="msg">Monta la base inicial del mes (sección morada de Cargar información) para ver aquí sexo, estado civil, ocupación, ingresos, saldo promedio y categoría percentil.</div>`)+
    (sinDatos?`<div class="msg">⚠ ${fmt(sinDatos)} registros no se encontraron en la base de ventas del mes, así que no tienen ciudad, departamento ni edad.</div>`:"");
  $("mdl").hidden=false;BLOQUEO.overflow="hidden";
}
$("mdl").addEventListener("mousemove",e=>{const t=e.target.closest(".hov"),m=$("mtip");if(!t){m.hidden=true;return}
  m.innerHTML=t.dataset.tip;m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;let x=e.clientX+16,y=e.clientY+16;if(x+w>innerWidth-8)x=e.clientX-w-16;if(y+h>innerHeight-8)y=Math.max(8,innerHeight-h-8);m.style.left=x+"px";m.style.top=y+"px"});
$("mdl").addEventListener("mouseleave",()=>$("mtip").hidden=true);
function cerrarM(){$("mtip").hidden=true;$("mdl").hidden=true;$("mdl").querySelector(".mbox").classList.remove("wide");BLOQUEO.overflow=""}
$("mdlx").onclick=cerrarM;$("mdl").addEventListener("click",e=>{if(e.target.id==="mdl")cerrarM()});document.addEventListener("keydown",e=>{if(!ABIERTO())return;if(e.key==="Escape"&&!$("mdl").hidden)cerrarM()});

/* ---------- Asesores por estrategia / lote ---------- */
function asesores(gid,lote){
  const D=estData(),g=D.G.find(x=>x.id===gid);if(!g)return;const L=lote!=null?g.lotes[lote]:null,seg=L||g;
  const R=rows(),M={};let sinA=0,sinDatos=0,hasR=false;
  for(const k in seg.ix){const E=EST()[k],pm=prMap(k),pr=DB[k]&&DB[k].pr,S=new Map();
    R.forEach(r=>{if(r.k!==k)return;const o=S.get(r[11])||{};o[r[0]||""]=(o[r[0]||""]||0)+r[2];S.set(r[11],o)});
    seg.ix[k].forEach(i=>{const id=E.ids[i],sv=estUlt(E,i)===g.num?S.get(id):undefined,j=pm?pm.get(id):undefined;
      if(sv)for(const a in sv){const o=M[a]||(M[a]={a,v:0,r:0});o.v+=sv[a]}
      if(j==null){sinDatos++;return}
      const a=pr.A?pr.A[pr.a[j]]||"":"";if(!a){sinA++;return}const o=M[a]||(M[a]={a,v:0,r:0});o.r++;if(prApto(pr,j))o.ap=(o.ap||0)+1;if(pr.r)hasR=true})}
  const X=Object.values(M).filter(x=>x.a).map(x=>Object.assign(x,{ef:x.r?x.v/x.r*100:0})).sort((a,b)=>b.v-a.v||b.ef-a.ef||b.r-a.r);
  const P=X.filter(x=>x.r).map(x=>x.ef),T=X.reduce((s,x)=>({v:s.v+x.v,r:s.r+x.r}),{v:0,r:0});
  $("mbody").innerHTML=`<h3>Asesores · Estrategia # ${g.num} · ${g.name}${L?` · ${L.n}`:""}</h3>
    <div class="msg" style="margin:0 0 12px">${fmt(seg.reg)} registros · ${fmt(seg.v)} pólizas · efectividad <b>${efs(seg.ef)}</b>. Registros = los que tocó cada asesor de esta ${L?"lote":"estrategia"} (columna Q, agente) · Aptos = de esos registros, los que quedaron con una tipificación marcada como APTO = 1 en «Cargar información › Códigos» · Efectividad = ventas ÷ registros.</div>
    <div class="msg" style="margin:0 0 8px"><span class="sem g"></span> Mejor &nbsp; <span class="sem y"></span> Media &nbsp; <span class="sem r"></span> Más baja</div>
    <div class="tbl">${X.length?`<table><tr><th>Asesor</th><th>Ventas (pólizas)</th><th>Registros</th><th>Aptos</th><th>Efectividad</th></tr>`+
      X.map(x=>{const c=x.r?semRank(x.ef,P):"r";return `<tr><td><span class="sem ${c}"></span>${pretty(x.a)}</td><td><b>${fmt(x.v)}</b></td><td>${fmt(x.r)}</td><td>${hasR?fmt(x.ap||0):"—"}</td><td><b class="semt ${c}">${x.r?efs(x.ef):"—"}</b></td></tr>`}).join("")+
      `<tr><th>Total · ${X.length} ${X.length===1?"asesor":"asesores"}</th><th>${fmt(T.v)}</th><th>${fmt(T.r)}</th><th>${hasR?fmt(X.reduce((s,x)=>s+(x.ap||0),0)):"—"}</th><th>${efs(T.r?T.v/T.r*100:0)}</th></tr></table>`:'<div class="empty">Ningún asesor ha tocado estos registros.</div>'}</div>`+
    (!hasR&&X.length?`<div class="msg" style="color:var(--dng)">⚠ Para ver los aptos, la base de ventas de este mes debe estar montada con la versión nueva: dale «⟳ Actualizar» o «Reemplazar» en Cargar información con el mismo Excel.</div>`:"")+
    (sinA?`<div class="msg">${fmt(sinA)} registros de ${L?"este lote":"esta estrategia"} no tienen asesor asignado (no gestionados).</div>`:"")+
    (sinDatos?`<div class="msg">⚠ ${fmt(sinDatos)} registros no se encontraron en la base de ventas del mes.</div>`:"");
  $("mdl").hidden=false;BLOQUEO.overflow="hidden";
}
["stab","slt"].forEach(id=>$(id).addEventListener("click",e=>{const b=e.target.closest(".pbtn");if(!b)return;e.stopPropagation();asesores(b.dataset.ag,b.dataset.agl!=null?b.dataset.agl:null)},true));
function mfAdd(t,txt){
  const S=MS;if(!S)return;const inp=t==="c"?"mic":"mid",keys=[...$(t==="c"?"mdlc":"mdld").options].map(o=>o.value);MNO=[];
  txt.split(/[,;\n\t]+/).map(x=>x.trim()).filter(Boolean).forEach(q=>{const n=norm(q).replace(/[^a-z0-9]/g,"");
    const k=keys.find(k=>norm(k).replace(/[^a-z0-9]/g,"")===n)||keys.find(k=>norm(k).replace(/[^a-z0-9]/g,"").startsWith(n));
    if(k)MF[t].add(norm(k));else MNO.push(q)});
  resumen(S.gid,S.lote,true);MNO=[];setTimeout(()=>{const i=$(inp);if(i)i.focus()},0);
}
$("mbody").addEventListener("keydown",e=>{const i=e.target;if(i.id!=="mic"&&i.id!=="mid")return;const t=i.id==="mic"?"c":"d";
  if(e.key==="Enter"||e.key===","){e.preventDefault();if(i.value.trim())mfAdd(t,i.value)}
  if(e.key==="Backspace"&&!i.value&&MF[t].size){MF[t].delete([...MF[t]].pop());const id=i.id;resumen(MS.gid,MS.lote,true);setTimeout(()=>$(id).focus(),0)}});
$("mbody").addEventListener("change",e=>{const i=e.target;if((i.id==="mic"||i.id==="mid")&&i.value.trim())mfAdd(i.id==="mic"?"c":"d",i.value)});
$("mbody").addEventListener("paste",e=>{const i=e.target;if(i.id!=="mic"&&i.id!=="mid")return;const v=(e.clipboardData||window.clipboardData).getData("text");if(v){e.preventDefault();mfAdd(i.id==="mic"?"c":"d",v)}});
$("mbody").addEventListener("click",e=>{const b=e.target.closest("#mgeof .tag button");if(b){MF[b.dataset.t].delete(b.dataset.k);resumen(MS.gid,MS.lote,true);return}
  if(e.target.id==="mgclr"){e.preventDefault();MF.c.clear();MF.d.clear();resumen(MS.gid,MS.lote,true);return}
  const tb=e.target.closest("#mgeof .tags");if(tb&&!e.target.closest(".tag"))tb.querySelector("input").focus()});
["stab","slt"].forEach(id=>$(id).addEventListener("click",e=>{if(e.target.closest(".pbtn"))return;const tr=e.target.closest("tr.clk");if(!tr)return;resumen(tr.dataset.g,tr.dataset.l!=null?tr.dataset.l:null)}));

/* ---------- Página 4: Agendas ---------- */
const PAL=["#1f6feb","#12a37f","#e5833b","#a05cd6","#d64545","#c9a227","#2aa6c9","#7a8b99","#e255a1","#6b8e23","#8d5a3c","#3f51b5"];
function line(S,X,f=fmt,pct=false){
  const W=900,H=pct?350:330,l=pct?64:48,r=24,t=30,b=pct?54:34,mx=Math.max(1,...S.flatMap(s=>s.v));
  const px=i=>X.length>1?l+40+i*(W-l-r-80)/(X.length-1):(l+W-r)/2,py=v=>t+(H-t-b)*(1-v/mx);
  let g="";
  for(let i=0;i<=4;i++){const v=mx*i/4,y=py(v);g+=`<line class="gl" x1="${l}" x2="${W-r}" y1="${y}" y2="${y}"/><text class="ax" x="${l-6}" y="${y+4}" text-anchor="end">${f(v)}</text>`}
  X.forEach((x,i)=>g+=`<text class="ax" x="${px(i)}" y="${H-10}" text-anchor="middle">${x}</text>`);
  S.forEach((s,k)=>{const c=PAL[k%PAL.length];
    g+=`<polyline fill="none" stroke="${c}" stroke-width="2.2" points="${s.v.map((v,i)=>px(i)+","+py(v)).join(" ")}"/>`+
       s.v.map((v,i)=>`<circle cx="${px(i)}" cy="${py(v)}" r="4" fill="${c}"><title>${s.n} · ${X[i]}: ${f(v)}</title></circle><text class="lb" fill="${c}" x="${px(i)}" y="${py(v)-9}" text-anchor="middle">${f(v)}</text>`+
         (pct&&i>0?(()=>{const a=s.v[i-1];if(!a)return "";const d=(v-a)/a*100;return `<text x="${px(i)}" y="${py(v)+20}" text-anchor="middle" style="font-size:12px;font-weight:700;fill:${d>=0?"var(--ac2)":"var(--dng)"}">${d>=0?"▲ +":"▼ "}${d.toFixed(1).replace(".",",")}%</text>`})():"")).join("")});
  return `<div class="tbl"><svg viewBox="0 0 ${W} ${H}" style="min-width:560px;width:100%">${g}</svg></div><div class="lg">${S.map((s,k)=>`<span><i style="background:${PAL[k%PAL.length]}"></i>${s.n}</span>`).join("")}</div>`;
}
function setup4(){
  const ags=[...new Set(all().map(r=>r[0]))].sort();
  sel($("ga"),[["__total","Total equipo"],["__all","Todos (una línea por agente)"],...ags.map(a=>[a,pretty(a)])]);
}

/* ---------- Filtro por ciudades y departamentos (Agendas) ---------- */
const GF={c:new Set(),d:new Set(),p:new Set()};let CURTAB="p1";const DHHOME=ROOT.getElementById("dhhome");
const geoOK=r=>(!GF.c.size||GF.c.has(r[9]))&&(!GF.d.size||GF.d.has(r[8]))&&(!GF.p.size||GF.p.has(prodName(r[4])));
function geoLists(){const C=new Map(),D=new Map(),PP=new Map();all().forEach(r=>{const pn=prodName(r[4]);if(pn)PP.set(pn,(PP.get(pn)||0)+r[2]);if(r[9]&&r[9][0]!=="(")C.set(r[9],(C.get(r[9])||0)+r[2]);if(r[8]&&r[8][0]!=="(")D.set(r[8],(D.get(r[8])||0)+r[2])});
  const opt=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]).map(([k])=>`<option value="${pretty(k)}">`).join("");$("dlc").innerHTML=opt(C);$("dld").innerHTML=opt(D);$("dlp").innerHTML=[...PP.entries()].sort((a,b)=>b[1]-a[1]).map(([k])=>`<option value="${k}">`).join("");return {C,D,P:PP}}
function geoRender(){
  [["c","tgc","tic"],["d","tgd","tid"],["p","tgp","tip"]].forEach(([t,box,inp])=>{const b=$(box),i=$(inp);b.querySelectorAll(".tag").forEach(x=>x.remove());
    [...GF[t]].forEach(k=>{const s=document.createElement("span");s.className="tag";s.dataset.t=t;s.dataset.k=k;s.innerHTML=`${t==="p"?k:pretty(k)}<button data-t="${t}" data-k="${k}" title="Quitar">✕</button>`;b.insertBefore(s,i)})});
  const parts=[];if(GF.c.size)parts.push("ciudades: "+[...GF.c].map(pretty).join(", "));if(GF.d.size)parts.push("departamentos: "+[...GF.d].map(pretty).join(", "));if(GF.p.size)parts.push("productos: "+[...GF.p].join(", "));
  $("geomsg").innerHTML=parts.length?`Mostrando solo ventas de ${parts.join(" y ")}. <a href="#" id="geoclr">Quitar filtro</a>`:"";
  const c=$("geoclr");if(c)c.onclick=e=>{e.preventDefault();GF.c.clear();GF.d.clear();GF.p.clear();geoRender();draw4();setupDH()};
}
function geoAdd(t,txt){
  const L=geoLists()[t==="c"?"C":t==="d"?"D":"P"],keys=[...L.keys()],no=[],kn=k=>norm(k).replace(/[^a-z0-9]/g,"");
  txt.split(/[,;\n\t]+/).map(x=>x.trim()).filter(Boolean).forEach(q=>{const n=norm(q).replace(/[^a-z0-9]/g,"");
    const k=keys.find(k=>kn(k)===n)||keys.find(k=>kn(k).startsWith(n));
    if(k)GF[t].add(k);else no.push(q)});
  geoRender();draw4();setupDH();
  if(no.length)$("geomsg").innerHTML+=` <span style="color:var(--dng)">No encontré ventas en: ${no.join(", ")}.</span>`;
}
[["c","tic"],["d","tid"],["p","tip"]].forEach(([t,id])=>{const i=$(id);
  i.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();if(i.value.trim()){geoAdd(t,i.value);i.value=""}}
    if(e.key==="Backspace"&&!i.value&&GF[t].size){GF[t].delete([...GF[t]].pop());geoRender();draw4();setupDH()}});
  i.addEventListener("paste",e=>{const v=(e.clipboardData||window.clipboardData).getData("text");if(v){e.preventDefault();geoAdd(t,v);i.value=""}});
  i.addEventListener("change",()=>{if(i.value.trim()){geoAdd(t,i.value);i.value=""}});
  i.parentElement.addEventListener("click",e=>{const b=e.target.closest(".tag button");if(b){GF[b.dataset.t].delete(b.dataset.k);geoRender();draw4();setupDH();return}i.focus()})});

function tagTip(t,k){
  if(t==="p"){const m=new Map();rows(true).forEach(r=>{if(prodName(r[4])!==k)return;const c=cName(campOf(r));m.set(c,(m.get(c)||0)+r[2])});const L=[...m.entries()].sort((a,b)=>b[1]-a[1]);
    return `<b>${k}</b>`+(L.length?`<table class="tt"><tr><th>Campaña</th><th>Ventas (pólizas)</th></tr>`+L.map(([n,v])=>`<tr><td>${n}</td><td>${fmt(v)}</td></tr>`).join("")+`</table>`:"<br>Sin ventas con los filtros actuales")}
  const R=rows(true),m=new Map(),ix=t==="d"?9:8,own=t==="d"?8:9;
  R.forEach(r=>{if(r[own]!==k)return;const x=r[ix]||"(sin dato)";m.set(x,(m.get(x)||0)+r[2])});
  const L=[...m.entries()].sort((a,b)=>b[1]-a[1]),tot=L.reduce((s,x)=>s+x[1],0);
  if(!L.length)return `<b>${pretty(k)}</b><br>Sin ventas con los filtros actuales`;
  return (t==="d"?`<b>${pretty(k)}</b> · ${L.length} ${L.length===1?"ciudad":"ciudades"} con ventas (${fmt(tot)} pólizas)`:`<b>${pretty(k)}</b> pertenece a:`)+
    `<table class="tt"><tr><th>${t==="d"?"Ciudad":"Departamento"}</th><th>Ventas (pólizas)</th></tr>`+L.map(([n,v])=>`<tr><td>${n[0]==="("?n:pretty(n)}</td><td>${fmt(v)}</td></tr>`).join("")+`</table>`;
}
$("geof4").addEventListener("mousemove",e=>{const g=e.target.closest(".tag"),m=$("mtip");if(!g||e.target.closest("button")){m.hidden=true;return}
  m.innerHTML=tagTip(g.dataset.t,g.dataset.k);m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;let x=e.clientX+16,y=e.clientY+16;if(x+w>innerWidth-8)x=e.clientX-w-16;if(y+h>innerHeight-8)y=Math.max(8,e.clientY-h-16);m.style.left=x+"px";m.style.top=y+"px"});
$("geof4").addEventListener("mouseleave",()=>$("mtip").hidden=true);

/* ---------- Productos al pasar el mouse por las tarjetas (Geografía y edad) ---------- */
function prodName(p){const n=norm(p).replace(/[^a-z0-9]/g," ");const o=/odonto/.test(n),sp=/salud/.test(n),pv=/pvm/.test(n);
  const L=[];if(o)L.push("Odontológico");if(sp)L.push("Salud para ti");if(pv)L.push("PVM");return L.length?L.join(" + "):(p?pretty(p):"(sin producto)")}
function prodTip(f,tt){
  const [d,key]=[f.slice(0,1),f.slice(2)],R=rows(true).filter(r=>d==="t"||(d==="d"?r[8]===key:d==="c"?r[9]===key:AB(r[10])===key));
  const m=new Map();R.forEach(r=>{const n=prodName(r[4]);m.set(n,(m.get(n)||0)+r[2])});
  const L=[...m.entries()].sort((a,b)=>b[1]-a[1]),T=L.reduce((s,x)=>s+x[1],0);
  if(!L.length)return `<b>${tt}</b><br>Sin ventas`;
  return `<b>Productos vendidos · ${tt}</b><table class="tt"><tr><th>Producto</th><th>Pólizas</th><th>%</th></tr>`+L.map(([n,v])=>`<tr><td>${n}</td><td>${fmt(v)}</td><td>${(v/T*100).toFixed(1).replace(".",",")}%</td></tr>`).join("")+`<tr><th>Total</th><th>${fmt(T)}</th><th>100%</th></tr></table>`;
}
$("gk").addEventListener("mousemove",e=>{const g=e.target.closest(".hovk"),m=$("mtip");if(!g||(!g.dataset.f&&!g._pt)){m.hidden=true;return}
  m.innerHTML=g._pt||prodTip(g.dataset.f,g.dataset.tt);m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;let x=e.clientX+16,y=e.clientY+16;if(x+w>innerWidth-8)x=e.clientX-w-16;if(y+h>innerHeight-8)y=Math.max(8,e.clientY-h-16);m.style.left=x+"px";m.style.top=y+"px"});
$("gk").addEventListener("mouseleave",()=>$("mtip").hidden=true);

/* ---------- Metas (Cargar información › Metas del mes) ---------- */
const METAS=()=>DB.__metas||(DB.__metas={});
const CAMPS=[["odontologico","Odontológico"],["salud_para_ti","Salud para ti"]];
const numIn=v=>{const n=parseFloat(String(v||"").replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",","."));return isNaN(n)?null:n};
function renderMetas(){
  const M=METAS();
  $("mtab").innerHTML=`<table><tr><th>Mes</th>${CAMPS.map(([c,n])=>`<th>${n}<br><small>Meta producción ($)</small></th><th>${n}<br><small>Meta ventas (pólizas)</small></th>`).join("")}<th>Total meta producción</th><th>Total meta ventas</th></tr>`+
    MESES.map((nm,i)=>{const k=`${YEAR}-${String(i+1).padStart(2,"0")}`,m=M[k]||{};let tp=0,tv=0,any=false;
      return `<tr><td><b>${nm}</b></td>`+CAMPS.map(([c])=>{const x=m[c]||{};if(x.p!=null){tp+=x.p;any=true}if(x.v!=null){tv+=x.v;any=true}
        return `<td><input aria-label="Meta de producción ${nm} ${cName(c)}" data-mk="${k}" data-mc="${c}" data-mf="p" inputmode="numeric" placeholder="$0" value="${x.p!=null?fmt(x.p):""}"></td><td><input aria-label="Meta de ventas ${nm} ${cName(c)}" data-mk="${k}" data-mc="${c}" data-mf="v" inputmode="numeric" placeholder="0" value="${x.v!=null?fmt(x.v):""}"></td>`}).join("")+
        `<td>${any?money(tp):"—"}</td><td>${any?fmt(tv):"—"}</td></tr>`}).join("")+`</table>`;
}
$("mtab").addEventListener("change",async e=>{const t=e.target;if(!t.dataset.mk)return;const M=METAS(),m=M[t.dataset.mk]||(M[t.dataset.mk]={}),c=m[t.dataset.mc]||(m[t.dataset.mc]={});
  const n=numIn(t.value);if(n==null)delete c[t.dataset.mf];else c[t.dataset.mf]=n;await API.config("metas",METAS());renderMetas();draw9();
  $("mmsg").textContent=`✔ Guardado: ${mname(t.dataset.mk)} · ${CAMPS.find(x=>x[0]===t.dataset.mc)[1]}`;});
ROOT.querySelectorAll(".stab").forEach(b=>b.addEventListener("click",()=>{const box=b.closest(".subtabs"),bs=[...box.querySelectorAll(".stab")];bs.forEach(x=>x.classList.toggle("on",x===b));bs.forEach(x=>$(x.dataset.s).hidden=x!==b);if(b.dataset.s==="sb2"){renderMetas();renderMetaA()}if(b.dataset.s==="sb3"){renderDic();renderTip()}if(b.dataset.s==="bs2")drawIA();if(b.dataset.s==="bs3")drawIni()}));
/* ---------- Pestaña Cumplimiento ---------- */
function metaChart(el,X,meta,real,f,cont){cont=cont||[];
  if(!X.length){el.innerHTML='<div class="empty">Activa al menos un mes.</div>';return}
  const W=960,H=420,L=30,R=30,bT=28,bB=118,top=150,bot=H-36,n=X.length,st=(W-L-R)/n,x=i=>L+st*i+st/2;
  const mx=Math.max(1,...meta.map(v=>v||0),...real)*1.12,y=v=>bot-(bot-top)*v/mx,bw=Math.min(54,st*.34);
  const pct=X.map((_,i)=>meta[i]?real[i]/meta[i]:null),pv=pct.filter(v=>v!=null).concat(cont.filter(v=>v!=null)),pmx=Math.max(1,...pv),yb=v=>bB-(bB-bT)*v/pmx;
  let g="";for(let i=0;i<=6;i++){const yy=top+(bot-top)*i/6;g+=`<line class="gl" x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}"/>`}
  g+=`<line x1="${L}" x2="${W-R}" y1="${yb(1)}" y2="${yb(1)}" stroke="var(--mut)" stroke-dasharray="5 5"/><text class="ax" x="${W-R}" y="${yb(1)-5}" text-anchor="end">100%</text>`;
  X.forEach((k,i)=>{const cx=x(i);
    if(meta[i]!=null){const yy=y(meta[i]);g+=`<path d="M${cx-bw-2},${bot}V${yy+4}q0,-4 4,-4h${bw-8}q4,0 4,4V${bot}Z" fill="#e5833b"/><text x="${cx-2}" y="${yy-6}" text-anchor="end" style="fill:#e5833b;font-size:12px;font-weight:700">${f(meta[i])}</text>`}
    const yr=y(real[i]);g+=`<path d="M${cx+2},${bot}V${yr+4}q0,-4 4,-4h${bw-8}q4,0 4,4V${bot}Z" fill="#8b5cf6"/><text x="${cx+2}" y="${yr-6}" text-anchor="start" style="fill:#a78bfa;font-size:12px;font-weight:700">${f(real[i])}</text>`;
    g+=`<text class="ax" x="${cx}" y="${H-14}" text-anchor="middle">${mname(k)}</text>`;
    g+=`<rect x="${L+st*i}" y="0" width="${st}" height="${H-30}" fill="transparent"><title>${mname(k)} · Meta: ${meta[i]!=null?f(meta[i]):"sin meta"} · Logrado: ${f(real[i])}${pct[i]!=null?" · Cumplimiento: "+(pct[i]*100).toFixed(2).replace(".",",")+"%":""}</title></rect>`});
  let d="",seg=[];pct.forEach((v,i)=>{if(v==null){if(seg.length)d+="M"+seg.join("L");seg=[];return}seg.push(x(i)+","+yb(v))});if(seg.length)d+="M"+seg.join("L");
  g+=`<path d="${d}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>`;
  pct.forEach((v,i)=>{if(v==null)return;g+=`<circle cx="${x(i)}" cy="${yb(v)}" r="5" fill="#3b82f6" stroke="var(--card)" stroke-width="2"/><text x="${x(i)}" y="${cont[i]!=null&&cont[i]>v?yb(v)+22:yb(v)-11}" text-anchor="middle" style="fill:#60a5fa;font-size:13px;font-weight:700">${(v*100).toFixed(2).replace(".",",")}%</text>`});
  {let d2="",sg=[];cont.forEach((v,i)=>{if(v==null){if(sg.length)d2+="M"+sg.join("L");sg=[];return}sg.push(x(i)+","+yb(v))});if(sg.length)d2+="M"+sg.join("L");
   g+=`<path d="${d2}" fill="none" stroke="#12a37f" stroke-width="2.5" stroke-dasharray="7 4"/>`;
   cont.forEach((v,i)=>{if(v==null)return;g+=`<circle cx="${x(i)}" cy="${yb(v)}" r="5" fill="#12a37f" stroke="var(--card)" stroke-width="2"><title>${mname(X[i])} · Contactabilidad: ${(v*100).toFixed(1).replace(".",",")}%</title></circle><text x="${x(i)}" y="${pct[i]!=null&&pct[i]>=v?yb(v)+22:yb(v)-11}" text-anchor="middle" style="fill:#2fc79f;font-size:13px;font-weight:700">${(v*100).toFixed(1).replace(".",",")}%</text>`})}
  el.innerHTML=`<div class="tbl"><svg viewBox="0 0 ${W} ${H}" style="min-width:620px;width:100%">${g}</svg></div><div class="lg"><span><i style="background:#e5833b"></i>Meta</span><span><i style="background:#8b5cf6"></i>Logrado</span><span><i style="background:#3b82f6;height:3px;vertical-align:3px"></i>% de cumplimiento</span></div>`;
}
function draw9(){
  if(!$("p9"))return;
  const ks=MKF(),med=$("cmed").value,cf=$("cf").value,M=METAS();
  const R=rows(),val=[...ROOT.querySelectorAll("#vf input")].filter(i=>i.checked).map(i=>i.value),nv=ROOT.querySelectorAll("#vf input").length;
  $("cfil").innerHTML=`Mostrando: <b>${cf?cName(cf):"Todas las campañas"}</b> · <b>${ks.map(mname).join(", ")||"ningún mes"}</b> · validación: <b>${val.length===nv?"todas":val.join(", ")||"ninguna"}</b>`;
  const camps=cf?[cf]:CAMPS.map(c=>c[0]);
  const meta=ks.map(k=>{let t=null;camps.forEach(c=>{const x=((M[k]||{})[c]||{})[med];if(x!=null)t=(t||0)+x});return t});
  const real=ks.map(k=>R.filter(r=>r.k===k).reduce((s,r)=>s+(med==="p"?r[3]:r[2]),0));
  const f=med==="p"?money:fmt,fl=med==="p"?money:fmt;
  $("ctit").textContent=(med==="p"?"Meta vs. producción":"Meta vs. ventas")+" por mes"+(cf?" · "+cName(cf):"");
  const cont=ks.map(k=>{const C=DB[k].ct;if(!C)return null;let reg=0,c=0;for(const cp in C){if(!cOK(cp))continue;reg+=C[cp].reg;c+=C[cp].c}return reg?c/reg:null});
  {let TM=0,TRm=0,TRall=0,nm=0;ks.forEach((k,i)=>{TRall+=real[i];if(meta[i]!=null){TM+=meta[i];TRm+=real[i];nm++}});const p=TM?TRm/TM:null,c=p==null?"":p>=1?"g":p>=.8?"y":"r",K=(t,v,sub,cl)=>`<div class="k"><span>${t}</span><div class="${cl||""}">${v}</div>${sub?`<span>${sub}</span>`:""}</div>`;
   $("ck").innerHTML=K(med==="p"?"Meta de producción":"Meta de ventas",nm?fl(TM):"—",nm?`${nm} ${nm===1?"mes":"meses"} con meta`:"escríbela en «Cargar información › Metas del mes»")+
     K(med==="p"?"Producción lograda (anualizada)":"Ventas logradas",fl(TRall),`de las bases cargadas · ${ks.map(k=>mname(k).slice(0,3)).join(", ")}`)+
     K("Cumplimiento",p==null?"—":(p*100).toFixed(2).replace(".",",")+"%",nm?"logrado ÷ meta de esos meses":"",p==null?"":"cum "+c)+
     K("Falta para la meta",nm?(TM>TRm?fl(TM-TRm):"✔ cumplida"):"—","")}
  metaChart($("cchart"),ks,meta,real,f);
  const CT=ks.map(k=>{const C=DB[k].ct;let reg=0,c=0;if(C)for(const cp in C){if(!cOK(cp))continue;reg+=C[cp].reg;c+=C[cp].c}return {reg,c}});
  $("ctchart").innerHTML=cont.some(v=>v!=null)?line([{n:"Contactabilidad",v:cont.map(v=>v==null?0:v*100)}],ks.map(mname),v=>v.toFixed(1).replace(".",",")+"%",false):
    '<div class="empty">Las bases de estos meses no traen la columna «contacto». Usa «Reemplazar» con el mismo Excel.</div>';
  const cls=p=>p==null?"":p>=1?"g":p>=.8?"y":"r";
  let TM=0,TR=0,anyM=false;
  $("ctab").innerHTML=`<table><tr><th>Mes</th><th>Meta</th><th>Logrado</th><th>Falta para la meta</th><th>Cumplimiento</th></tr>`+
    ks.map((k,i)=>{const p=meta[i]?real[i]/meta[i]:null;if(meta[i]!=null){TM+=meta[i];anyM=true}TR+=real[i];
      return `<tr><td>${mname(k)}</td><td>${meta[i]!=null?fl(meta[i]):'<span class="msg">sin meta</span>'}</td><td>${fl(real[i])}</td><td>${meta[i]!=null?(meta[i]>real[i]?fl(meta[i]-real[i]):"✔ cumplida"):"—"}</td><td><b class="cum ${cls(p)}">${p!=null?(p*100).toFixed(1).replace(".",",")+"%":"—"}</b></td></tr>`}).join("")+
    `<tr><th>Total</th><th>${anyM?fl(TM):"—"}</th><th>${fl(TR)}</th><th></th><th><span class="cum ${cls(anyM&&TM?TR/TM:null)}">${anyM&&TM?(TR/TM*100).toFixed(1).replace(".",",")+"%":"—"}</span></th></tr></table>`+
    `<div class="msg">Colores del cumplimiento: verde 100% o más · amarillo 80% a 99% · rojo menos de 80%.${anyM?"":" Aún no hay metas: escríbelas en «Cargar información › Metas del mes»."}</div>`;
}
$("cmed").addEventListener("change",draw9);

let G4V="";
function drawX4(R,a,med){
  const el=$("g4x");$("g4v").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.v===G4V));
  if(!G4V){el.hidden=true;return}el.hidden=false;
  const RR=R.filter(r=>a==="__total"||a==="__all"||r[0]===a),val=r=>med==="p"?r[3]:r[2],fl=med==="p"?money:fmt,unit=med==="p"?"Producción":"Ventas (pólizas)";
  const agg=f=>{const m=new Map();RR.forEach(r=>{const k=f(r);const o=m.get(k)||{v:0,d:r[8],ag:{}};o.v+=val(r);const a=r[0]||"";o.ag[a]=(o.ag[a]||0)+val(r);m.set(k,o)});return m};
  const esc=t=>String(t).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const tip=(t,ag)=>{const L=Object.entries(ag).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]),S=L.reduce((s,x)=>s+x[1],0);return esc(`<b>${t}</b> · ${L.length} ${L.length===1?"asesor":"asesores"}<table class="tt"><tr><th>Asesor</th><th>${unit}</th><th>%</th></tr>`+L.map(([a,v])=>`<tr><td>${a?pretty(a):"(sin asesor)"}</td><td>${fl(v)}</td><td>${S?(v/S*100).toFixed(0):0}%</td></tr>`).join("")+`</table>`)};
  const T=RR.reduce((s,r)=>s+val(r),0),pc=v=>T?(v/T*100).toFixed(1).replace(".",",")+"%":"0%";
  const barc=(v,mx,c)=>`<span style="display:inline-block;vertical-align:middle;width:80px;height:8px;border-radius:4px;background:var(--bg);margin-right:8px;overflow:hidden"><i style="display:block;height:100%;width:${mx?v/mx*100:0}%;background:${c}"></i></span>`;
  const X='<div style="display:flex;justify-content:flex-end;margin-bottom:-4px"><button class="btn" id="g4close" type="button" style="width:auto;margin:0 0 6px;padding:6px 14px;border-color:var(--dng);color:var(--dng);font-weight:600">✕ Cerrar</button></div>';
  if(!RR.length){el.innerHTML=X+'<div class="empty">Sin ventas con los filtros actuales.</div>';return}
  if(G4V==="map"){
    const D=[...agg(r=>r[8]||"(sin dato)").entries()].sort((x,y)=>y[1].v-x[1].v),C=[...agg(r=>(r[8]||"")+"\t"+(r[9]||"(sin dato)")).entries()].sort((x,y)=>y[1].v-x[1].v);
    const mxD=D.length?D[0][1].v:0,mxC=C.length?C[0][1].v:0;
    el.innerHTML=X+`<div class="grid2"><div class="sbox" style="--mc:#c9a227"><h4>🗺️ Departamentos (${D.length})</h4><div class="tbl" style="max-height:420px;overflow:auto"><table><tr><th>Departamento</th><th>${unit}</th><th>%</th></tr>`+
      D.map(([k,o])=>`<tr class="hov" data-tip="${tip(k[0]==="("?k:pretty(k),o.ag)}"><td>${k[0]==="("?k:pretty(k)}</td><td style="white-space:nowrap">${barc(o.v,mxD,"#c9a227")}<b>${fl(o.v)}</b></td><td>${pc(o.v)}</td></tr>`).join("")+`<tr><th>Total</th><th>${fl(T)}</th><th>100%</th></tr></table></div></div>`+
      `<div class="sbox" style="--mc:#e255a1"><h4>🏙️ Ciudades (${C.length})</h4><div class="tbl" style="max-height:420px;overflow:auto"><table><tr><th>Ciudad</th><th>Departamento</th><th>${unit}</th><th>%</th></tr>`+
      C.map(([k,o])=>{const [d,c]=k.split("\t");return `<tr class="hov" data-tip="${tip((c[0]==="("?c:pretty(c))+(d?" ("+(d[0]==="("?d:pretty(d))+")":""),o.ag)}"><td>${c[0]==="("?c:pretty(c)}</td><td style="white-space:nowrap">${d?(d[0]==="("?d:pretty(d)):"—"}</td><td style="white-space:nowrap">${barc(o.v,mxC,"#e255a1")}<b>${fl(o.v)}</b></td><td>${pc(o.v)}</td></tr>`}).join("")+`<tr><th>Total</th><th></th><th>${fl(T)}</th><th>100%</th></tr></table></div></div></div>`;
  }else{
    const m=agg(r=>AB(r[10])),E=EDADES.concat([SINE]).filter(e=>m.has(e)).map(e=>[e,m.get(e).v,m.get(e).ag]),mx=Math.max(0,...E.filter(x=>x[0]!==SINE).map(x=>x[1])),top=E.find(x=>x[1]===mx&&x[0]!==SINE);
    el.innerHTML=X+`<div class="sbox" style="--mc:#e5833b"><h4>👤 Edades${top?` · se vende más entre <b>${top[0]} años</b>`:""}</h4><div class="tbl"><table><tr><th>Rango de edad</th><th>${unit}</th><th>%</th></tr>`+
      E.map(([e,v,ag])=>`<tr class="hov" data-tip="${tip(e===SINE?e:e+" años",ag)}"${top&&e===top[0]?' style="background:color-mix(in srgb,#e5833b 14%,transparent)"':""}><td>${e===SINE?e:e+" años"}</td><td>${barc(v,Math.max(mx,v),"#e5833b")}<b>${fl(v)}</b></td><td>${pc(v)}</td></tr>`).join("")+`<tr><th>Total</th><th>${fl(T)}</th><th>100%</th></tr></table></div></div>`;
  }
}
$("g4x").addEventListener("mousemove",e=>{const t=e.target.closest("tr.hov"),m=$("mtip");if(!t){m.hidden=true;return}
  m.innerHTML=t.dataset.tip;m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;let x=e.clientX+16,y=e.clientY+16;if(x+w>innerWidth-8)x=e.clientX-w-16;if(y+h>innerHeight-8)y=Math.max(8,e.clientY-h-16);m.style.left=x+"px";m.style.top=y+"px"});
$("g4x").addEventListener("mouseleave",()=>$("mtip").hidden=true);
$("g4x").addEventListener("click",e=>{if(e.target.id==="g4close"){G4V="";draw4();$("g4v").scrollIntoView({block:"nearest"})}});
$("g4v").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;G4V=G4V===b.dataset.v?"":b.dataset.v;draw4()});
function drawProd4(R,ks,a,med){
  const fl=med==="p"?money:fmt,RR=R.filter(r=>a==="__total"||a==="__all"||r[0]===a);
  $("gprod").innerHTML=CAMPS.map(([c,nm])=>{const X=RR.filter(r=>campOf(r)===c),m={};
    X.forEach(r=>{const n=prodName(r[4]),o=m[n]||(m[n]={n,t:0,k:{}}),v=med==="p"?r[3]:r[2];o.t+=v;o.k[r.k]=(o.k[r.k]||0)+v});
    const L=Object.values(m).sort((x,y)=>y.t-x.t),T=L.reduce((s,x)=>s+x.t,0);
    return `<div class="sbox" style="--mc:${c==="odontologico"?"#2aa6c9":"#e255a1"}"><h4>${CICO(c)} Campaña ${nm}</h4>`+(L.length?`<div class="tbl"><table><tr><th>Producto</th>${ks.map(k=>`<th>${mname(k).slice(0,3)}</th>`).join("")}<th>Total</th><th>%</th></tr>`+
      L.map(x=>`<tr><td>${x.n}</td>${ks.map(k=>`<td>${x.k[k]?fl(x.k[k]):"—"}</td>`).join("")}<td><b>${fl(x.t)}</b></td><td>${T?(x.t/T*100).toFixed(1).replace(".",","):"0"}%</td></tr>`).join("")+
      `<tr><th>Total</th>${ks.map(k=>`<th>${fl(L.reduce((s,x)=>s+(x.k[k]||0),0))}</th>`).join("")}<th>${fl(T)}</th><th>100%</th></tr></table></div>`:'<div class="empty">Sin ventas con estos filtros.</div>')+`</div>`}).join("");
}
const fmon=v=>"$"+(Math.abs(v)>=1e6?(v/1e6).toFixed(1).replace(".",",")+" M":fmt(v));
const vpct=(a,b)=>{if(!a)return '<span class="msg">—</span>';const d=(b-a)/a*100;return `<b style="color:${d>=0?"var(--ac2)":"var(--dng)"}">${d>=0?"▲ +":"▼ "}${d.toFixed(1).replace(".",",")}%</b>`};
function draw4(){
  const a=$("ga").value||"__total",med=$("gm").value,R=rows(true).filter(geoOK),ks=MKF(),f=med==="p"?fmon:fmt,fl=med==="p"?money:fmt;
  $("g4t").textContent=(med==="p"?"Producción":"Agendas (ventas)")+" por mes";
  if(!R.length||!ks.length){$("gl").innerHTML='<div class="empty">Sin ventas con los filtros actuales.</div>';$("gt").innerHTML="";$("g4s").innerHTML="";return}
  const m={};
  R.forEach(r=>{const o=m[r[0]]||(m[r[0]]={});o[r.k]=(o[r.k]||0)+(med==="p"?r[3]:r[2])});
  const names=Object.keys(m),val=(x,k)=>(m[x]||{})[k]||0,sum=v=>v.reduce((p,q)=>p+q,0);
  let S;
  if(a==="__total")S=[{n:"Total equipo",v:ks.map(k=>names.reduce((s,x)=>s+val(x,k),0))}];
  else S=(a==="__all"?names:[a]).map(x=>({n:pretty(x),v:ks.map(k=>val(x,k))})).sort((p,q)=>sum(q.v)-sum(p.v));
  const X=ks.map(mname),one=S.length===1;
  // resumen de % de caída o incremento mes a mes
  if(one&&ks.length>1){const v=S[0].v,c=corte(),L=v.length,inc=c.curso&&ks[L-1]===c.k&&!DHN;
    $("g4s").innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">`+ks.slice(1).map((k,i)=>`<div style="border:1px solid var(--bd);border-radius:8px;padding:6px 10px;font-size:13px;background:var(--bg)">${mname(ks[i]).slice(0,3)} → ${mname(k).slice(0,3)}: ${vpct(v[i],v[i+1])}</div>`).join("")+
      `<div style="border:1px solid var(--bd);border-radius:8px;padding:6px 10px;font-size:13px;background:var(--bg)">${mname(ks[0]).slice(0,3)} → ${mname(ks[L-1]).slice(0,3)} (acumulado): ${vpct(v[0],v[L-1])}</div></div>`+
      (inc?`<div class="msg" style="margin:-4px 0 10px">⚠ ${mname(c.k)} va en ${c.n} de ${habMes(c.k).length} días hábiles, por eso cae frente a meses completos. Para compararlo parejo usa el botón «📅 Días hábiles».</div>`:"");}
  else $("g4s").innerHTML="";
  $("gl").innerHTML=line(S,X,f,one);
  drawX4(R,a,med);
  $("gt").innerHTML=`<table><tr><th>Agente</th>${X.map(x=>`<th>${x}</th>`).join("")}<th>Total</th></tr>`+S.map(s=>`<tr><td>${s.n}</td>${s.v.map((v,i)=>`<td>${fl(v)}${i?`<br><small>${vpct(s.v[i-1],v)}</small>`:""}</td>`).join("")}<td><b>${fl(sum(s.v))}</b></td></tr>`).join("")+`</table>`;
}
$("ga").addEventListener("change",draw4);$("gm").addEventListener("change",draw4);
/* ---------- Página 5: Resultados ---------- */
function setup5(){
  const s=new Set();MK().forEach(k=>{const A=agOf(DB[k]);for(const c in A)Object.keys(A[c]).forEach(x=>s.add(x))});
  sel($("ra"),[["","Todos los agentes"],...[...s].sort().map(a=>[a,pretty(a)])]);
}
function draw5(){
  const a=$("ra").value,m={},MA={},addA=(res,x,v)=>{const o=MA[res]||(MA[res]={});o[x]=(o[x]||0)+v};
  MKF().forEach(k=>{const A=agOf(DB[k]);for(const c in A){if(!cOK(c))continue;for(const x in A[c]){if(a&&x!==a)continue;for(const res in A[c][x])if(res!=="venta"){m[res]=(m[res]||0)+A[c][x][res];addA(res,x,A[c][x][res])}}}});
  rows().forEach(r=>{if(a&&r[0]!==a)return;m.venta=(m.venta||0)+1;addA("venta",r[0]||"",1)});
  const L=Object.entries(m).map(([n,v])=>({n,v})).sort((p,q)=>q.v-p.v),T=L.reduce((s,x)=>s+x.v,0);
  if(!L.length){$("rc").innerHTML='<div class="empty">Sin resultados para mostrar.</div>';$("rt").innerHTML="";return}
  {const S={RPC:0,WPC:0,NC:0,"Sin clasificar":0};L.forEach(x=>{const t=tipOf(x.n)[0];S[t?t[2]:"Sin clasificar"]=(S[t?t[2]:"Sin clasificar"]||0)+x.v});
   const lab={RPC:"RPC · contacto con el titular",WPC:"WPC · contacto con otra persona",NC:"NC · no contacto","Sin clasificar":"Sin clasificar"};
   $("rind").innerHTML=Object.entries(S).filter(([k,v])=>v||k!=="Sin clasificar").map(([k,v])=>`<div class="k"><span>${k==="Sin clasificar"?k:`<span class="ichip ${k}">${k}</span>`}${lab[k].split(" · ")[1]||""}</span><div>${T?(v/T*100).toFixed(2).replace(".",","):0}%</div><span>${fmt(v)} registros</span></div>`).join("")}
  bars($("rc"),L,"v",false,v=>`${fmt(v)} <span style="display:inline-block;min-width:52px;color:var(--mut);font-weight:500">${(v/T*100).toFixed(1).replace(".",",")}%</span>`);
  $("rc").querySelectorAll(".bar").forEach((el,i)=>{const x=L[i],E=Object.entries(MA[x.n]||{}).filter(y=>y[1]>0).sort((p,q)=>q[1]-p[1]);
    const tp=tipOf(x.n),ti=tp[0],nEl=el.querySelector(".n");if(ti&&nEl)nEl.innerHTML=`<span class="ichip ${ti[2]}">${ti[2]}</span>${x.n}`;
    const fl=ti?`<div style="margin:4px 0 2px;opacity:.85">Código ${tp.map(r=>r[0]).join(" / ")} · ${ti[2]} · ${["Contacto","RPC","APTO","NO APTO","RPC +","Titular","Cerrado","PROSPECTO"].filter((h,j)=>String(ti[3+j])==="1").join(", ")||"sin contacto"} · volver a llamar: <b>${ti[12]}</b></div>`:`<div style="margin:4px 0 2px;color:var(--dng)">No está en la tabla de tipificaciones (Cargar información › Códigos)</div>`;
    el.classList.add("hov");el._tip=`<b>${x.n}</b>${fl}${E.length} ${E.length===1?"agente":"agentes"}<table class="tt"><tr><th>Agente</th><th>Cantidad</th><th>%</th></tr>`+E.map(([n,v])=>`<tr><td>${n?pretty(n):"(sin agente)"}</td><td>${fmt(v)}</td><td>${x.v?(v/x.v*100).toFixed(0):0}%</td></tr>`).join("")+`</table>`});
  $("rt").innerHTML=`<table><tr><th>Resultado</th><th>Cantidad</th><th>%</th></tr>`+L.map(x=>`<tr><td>${x.n}</td><td>${fmt(x.v)}</td><td>${(x.v/T*100).toFixed(1)}%</td></tr>`).join("")+`<tr><th>Total</th><th>${fmt(T)}</th><th>100%</th></tr></table>`;
}
$("ra").addEventListener("change",draw5);
$("rc").addEventListener("mousemove",e=>{const t=e.target.closest(".bar"),m=$("mtip");if(!t||!t._tip){m.hidden=true;return}
  m.innerHTML=t._tip;m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;let x=e.clientX+16,y=e.clientY+16;if(x+w>innerWidth-8)x=e.clientX-w-16;if(y+h>innerHeight-8)y=Math.max(8,e.clientY-h-16);m.style.left=x+"px";m.style.top=y+"px"});
$("rc").addEventListener("mouseleave",()=>$("mtip").hidden=true);
/* ---------- Página 6: Campañas ---------- */
function draw6(){
  const R=rows(true),cs=[...new Set(R.map(campOf))].sort(),L=MKF().map(k=>{const o={n:mname(k),v:0,p:0,d:diasMes(k)};R.forEach(r=>{if(r.k!==k)return;o.v+=r[2];o.p+=r[3]});return o});
  if(!L.length){$("v1").innerHTML=$("v2").innerHTML='<div class="empty">Carga una base o activa algún mes.</div>';$("vt").innerHTML="";return}
  bars($("v1"),L,"v",false,fmt);bars($("v2"),L,"p",true,money);
  const tv=L.reduce((s,x)=>s+x.v,0),tp=L.reduce((s,x)=>s+x.p,0),td=L.reduce((s,x)=>s+x.d,0);
  const byC=c=>{let v=0,p=0;R.forEach(r=>{if(campOf(r)===c){v+=r[2];p+=r[3]}});return{v,p}};
  $("vt").innerHTML=`<table><tr><th>Mes</th><th>Días hábiles</th><th>Ventas (pólizas)</th><th>Ventas por día hábil</th><th>Producción</th><th>Producción por día hábil</th><th>Prom. por póliza</th></tr>`+
   L.map(x=>`<tr><td>${x.n}</td><td>${x.d}</td><td>${fmt(x.v)}</td><td><b>${x.d?(x.v/x.d).toFixed(1).replace(".",","):"—"}</b></td><td>${money(x.p)}</td><td>${x.d?money(x.p/x.d):"—"}</td><td>${money(x.v?x.p/x.v:0)}</td></tr>`).join("")+
   `<tr><th>Total</th><th>${td}</th><th>${fmt(tv)}</th><th>${td?(tv/td).toFixed(1).replace(".",","):"—"}</th><th>${money(tp)}</th><th>${td?money(tp/td):"—"}</th><th>${money(tv?tp/tv:0)}</th></tr></table>`+
   `<div class="msg">Ventas por día hábil = ventas ÷ días hábiles del mes (en el mes en curso, los días hábiles transcurridos hasta la última venta). Sirve para comparar meses incompletos.</div>`+
   (cs.length?`<h2 style="margin-top:16px">Por campaña (columna D)</h2><table><tr><th>Campaña</th><th>Ventas (pólizas)</th><th>Producción</th><th>Prom. por póliza</th></tr>`+
   cs.map(c=>{const o=byC(c);return `<tr><td>${cName(c)}</td><td>${fmt(o.v)}</td><td>${money(o.p)}</td><td>${money(o.v?o.p/o.v:0)}</td></tr>`}).join("")+`</table>`:"");
}


["c1","grc"].forEach(id=>{$(id).addEventListener("mousemove",e=>{const h=e.target.closest(".hit"),m=$("mtip");if(!h){m.hidden=true;return}const x=$(id)._L[+h.dataset.i];
  m.innerHTML=`<b>${x.n}</b><table class="tt"><tr><td>Ventas (pólizas)</td><td><b>${fmt(x.v)}</b></td></tr><tr><td>Producción</td><td><b>${money(x.p)}</b></td></tr></table>`;
  m.hidden=false;const w=m.offsetWidth,hh=m.offsetHeight;let X=e.clientX+16,Y=e.clientY+16;if(X+w>innerWidth-8)X=e.clientX-w-16;if(Y+hh>innerHeight-8)Y=Math.max(8,e.clientY-hh-16);m.style.left=X+"px";m.style.top=Y+"px"});
$(id).addEventListener("mouseleave",()=>$("mtip").hidden=true)});
$("dhclose4").addEventListener("click",()=>{$("dhpop4").hidden=true;$("dhbtn4").classList.remove("on");$("dhbtn4").scrollIntoView({block:"nearest"})});
document.addEventListener("keydown",e=>{if(!ABIERTO())return;if(e.key!=="Escape"||!$("mdl").hidden)return;if(!$("dhpop4").hidden)$("dhclose4").click();else if(G4V){G4V="";draw4()}});
$("dhbtn4").addEventListener("click",()=>{$("dhpop4").hidden=!$("dhpop4").hidden;$("dhbtn4").classList.toggle("on",!$("dhpop4").hidden)});

/* ---------- Agentes › cumplimiento de la meta individual ---------- */
let CUMC="odontologico",CUMK="";
function drawCumA(){$("mdl").querySelector(".mbox").classList.add("wide");$("mdl").hidden=false;BLOQUEO.overflow="hidden";
  const ks=MKF(),all=MK();if(!CUMK||!all.includes(CUMK))CUMK=ks[ks.length-1]||all[all.length-1];const k=CUMK;const TT=`<h3>🎯 Cumplimiento de la meta individual${k?" · "+mname(k):""}</h3>`;
  if(!k){$("mbody").innerHTML=TT+'<div class="empty">Activa al menos un mes.</div>';return}
  const MI=(DB.__metasI||{})[k]||{},hay=CAMPS.some(([c])=>MI[c]&&(MI[c].v!=null||MI[c].p!=null));
  // campaña de cada asesor = donde más registros gestionó en el mes
  // cada campaña por separado (no depende del filtro de campaña de arriba): solo lo que el asesor hizo en esa campaña, contra la meta de esa campaña
  if(!CAMPS.some(([c])=>c===CUMC))CUMC=CAMPS[0][0];const camp=CUMC;
  const reg={},A=agOf(DB[k]);if(A[camp])for(const a in A[camp]){let n=0;for(const r in A[camp][a])n+=A[camp][a][r];reg[a]=n}
  const S={};DB[k].rows.forEach(r=>{if(!r[0]||VOFF.has(r[6]||NV)||!agCnt(r[0],campOf(r),camp))return;const o=S[r[0]]||(S[r[0]]={v:0,p:0});o.v+=r[2];o.p+=r[3]});
  const names=new Set([...Object.keys(S),...Object.keys(reg)].filter(a=>a&&!agL(camp,"out").includes(a)));
  const pct=(x,m)=>m?x/m:null,fp=p=>p==null?"—":(p*100).toFixed(1).replace(".",",")+"%";
  const m=MI[camp]||{};let X=[...names].map(a=>{const o=S[a]||{v:0,p:0};return {a,camp,reg:reg[a]||0,v:o.v,p:o.p,mv:m.v,mp:m.p,pv:pct(o.v,m.v),pp:pct(o.p,m.p)}}).filter(x=>x.v||x.reg);
  X.sort((a,b)=>(b.pp??b.pv??-1)-(a.pp??a.pv??-1)||b.v-a.v);
  const c=corte(),curso=c.curso&&c.k===k,av=curso?c.n/habMes(k).length:1,col=p=>p==null?"":p>=av?"g":p>=.8*av?"y":"r",est=p=>p==null?"—":p>=1?"✔ Cumplió":p>=av?"✔ Va al día":p>=.8*av?"⚠ Un poco atrás":"✖ Atrasado";
  const bar=(p,cl)=>`<span style="display:inline-block;vertical-align:middle;width:64px;height:9px;border-radius:5px;background:var(--bg);margin-right:8px;overflow:hidden;position:relative"><i style="display:block;height:100%;width:${Math.min(100,(p||0)*100)}%;background:${cl==="g"?"#12a37f":cl==="y"?"#e0a800":"#d64545"}"></i>${curso?`<b style="position:absolute;top:-2px;bottom:-2px;left:${av*100}%;width:2px;background:var(--tx);opacity:.6"></b>`:""}</span>`;
  const cum=X.filter(x=>(x.pp??x.pv)>=1).length,aldia=X.filter(x=>(x.pp??x.pv)>=av).length;
  $("mbody").innerHTML=TT+`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 10px"><div class="subtabs" id="cumtabs" style="margin:0">${CAMPS.map(([c,n])=>`<button class="stab${c===camp?" on":""}" type="button" data-cc="${c}">${CICO(c)} ${n}</button>`).join("")}</div><div class="row fx" style="--fc:#a05cd6;margin:0;padding:6px 10px"><label>Mes<select id="cumm">${all.map(x=>`<option value="${x}"${x===k?" selected":""}>${mname(x)}</option>`).join("")}</select></label></div></div>
    <div class="msg" style="margin:0 0 10px">Resultados de cada asesor <b>solo en ${cName(camp)}</b> (registros de esa campaña, columna D), contra la meta individual de ${cName(camp)} en <b>${mname(k)}</b>: ${m.v!=null?fmt(m.v)+" ventas":"sin meta de ventas"} · ${m.p!=null?money(m.p):"sin meta de producción"}. Si un asesor trabaja en las dos campañas, aparece en las dos pestañas con su resultado de cada una. Este cuadro no depende del filtro de campaña de arriba. <b>${cum}</b> de ${X.length} asesores ya cumplieron la meta${curso?` y <b>${aldia}</b> ${aldia===1?"va":"van"} al día`:""}.${curso?` ${mname(k)} va en ${c.n} de ${habMes(k).length} días hábiles: la rayita en cada barra marca dónde deberían ir a esta fecha (${(av*100).toFixed(0)}%).`:""}</div>
    <div class="tbl"><table class="cumt"><tr><th rowspan="2" style="vertical-align:bottom">Asesor</th><th colspan="4" class="gv gh">🛒 Ventas (pólizas)</th><th colspan="4" class="gp gh">💰 Producción</th></tr>
      <tr><th class="gv gs">Ventas / meta</th><th class="gv">Falta</th><th class="gv">Cumplimiento</th><th class="gv">Estado</th><th class="gp gs">Producción / meta</th><th class="gp">Falta</th><th class="gp">Cumplimiento</th><th class="gp">Estado</th></tr>`+
      [...X].sort((a,b)=>(b.pp??-1)-(a.pp??-1)||(b.pv??-1)-(a.pv??-1)).map(x=>{const cell=(cls,h,m,isV)=>{const p=isV?x.pv:x.pp;if(m==null)return `<td class="${cls} gs">${isV?fmt(h):money(h)}</td><td class="${cls}" colspan="3" style="text-align:center;opacity:.6">sin meta para este mes</td>`;const f=m-h;
        return `<td class="${cls} gs">${isV?fmt(h)+" / "+fmt(m):money(h)+" / "+money(m)}</td><td class="${cls}" style="white-space:nowrap">${f>0?`<b>${isV?fmt(f)+(f===1?" venta":" ventas"):money(f)}</b>`:`<b class="cum g">✔ Cumplida</b>`}</td><td class="${cls}" style="white-space:nowrap">${bar(p,col(p))}<b class="cum ${col(p)}">${fp(p)}</b></td><td class="${cls}" style="white-space:nowrap"><b class="cum ${col(p)}">${est(p)}</b></td>`};
        return `<tr><td><b>${pretty(x.a)}</b></td>${cell("gv",x.v,x.mv,true)}${cell("gp",x.p,x.mp,false)}</tr>`}).join("")+`</table></div>
    <div class="msg">${curso?`Como el mes va en curso, el color compara contra lo que deberían llevar a hoy (${(av*100).toFixed(0)}% de la meta): verde = va al día o mejor · amarillo = un poco atrás · rojo = atrasado.`:"Verde = 100% o más · amarillo = 80% a 99% · rojo = menos de 80%."} Respeta el filtro de resultado de validación.</div>`;
}
$("mbody").addEventListener("click",e=>{const b=e.target.closest("[data-cc]");if(!b)return;CUMC=b.dataset.cc;drawCumA()});
$("mbody").addEventListener("change",e=>{if(e.target.id==="cumm"){CUMK=e.target.value;drawCumA()}});
let AGCC="";
function agcNote(){const c=$("cf").value,n=CAMPS.reduce((s,[x])=>s+agL(x,"out").length+agL(x,"in").length,0);$("c1agn").textContent=n?` · ${n}`:"";
  const o=c?agL(c,"out"):[],i=c?agL(c,"in"):[],el=$("c1agm");
  if(!o.length&&!i.length){el.hidden=true;return}el.hidden=false;
  el.innerHTML=`👥 ${cName(c)}: ${o.length?`sin <b>${o.map(pretty).join(", ")}</b> (sus ventas de esta campaña no cuentan aquí)`:""}${o.length&&i.length?" · ":""}${i.length?`con <b>${i.map(pretty).join(", ")}</b> (sus ventas de la otra campaña sí cuentan aquí)`:""}.`}
function drawAgc(){$("mdl").querySelector(".mbox").classList.add("wide");$("mdl").hidden=false;BLOQUEO.overflow="hidden";
  if(!CAMPS.some(([c])=>c===AGCC))AGCC=$("cf").value||CAMPS[0][0];const c=AGCC,ks=MKF();
  const S={};ks.forEach(k=>DB[k].rows.forEach(r=>{if(!r[0]||VOFF.has(r[6]||NV))return;const o=S[r[0]]||(S[r[0]]={});const rc=campOf(r);o[rc]=(o[rc]||0)+r[2]}));
  [...agL(c,"out"),...agL(c,"in")].forEach(a=>S[a]||(S[a]={}));
  const out=agL(c,"out"),inn=agL(c,"in");
  const L=Object.keys(S).map(a=>{const o=S[a],own=o[c]||0,oth=Object.keys(o).filter(x=>x!==c).reduce((s,x)=>s+o[x],0);
    const st=own>0||out.includes(a)?(out.includes(a)?"out":"on"):(inn.includes(a)?"in":"off");return {a,own,oth,st}});
  const ord={on:0,in:1,out:2,off:3};L.sort((x,y)=>ord[x.st]-ord[y.st]||(y.own+y.oth)-(x.own+x.oth));
  const oc=CAMPS.find(([x])=>x!==c)[1],ico=CICO;
  const lab={on:'<b class="cum g">✔ Cuenta en esta gráfica</b>',in:'<b class="cum g">＋ Agregada a esta gráfica</b>',out:'<b class="cum r">✖ Quitada de esta gráfica</b>',off:'<span style="opacity:.6">No aparece (solo vende en '+oc+')</span>'};
  const act={on:'<button class="btn" data-ga="out" style="border-color:var(--dng);color:var(--dng)">✖ Quitar</button>',out:'<button class="btn" data-ga="back">↩ Volver a incluir</button>',in:'<button class="btn" data-ga="unin" style="border-color:var(--dng);color:var(--dng)">✖ Quitar</button>',off:'<button class="btn" data-ga="in" style="border-color:#12a37f;color:#12a37f">＋ Agregar</button>'};
  $("mbody").innerHTML=`<h3>👥 Asesores en la gráfica de cada campaña</h3>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 10px"><div class="subtabs" style="margin:0">${CAMPS.map(([x,n])=>`<button class="stab${x===c?" on":""}" type="button" data-gc="${x}">${ico(x)} ${n}</button>`).join("")}</div>${out.length||inn.length?'<button class="btn" data-ga="reset">⟲ Restablecer '+cName(c)+'</button>':""}</div>
  <div class="msg" style="margin:0 0 10px"><b>Quitar</b>: el asesor sale de la gráfica de ${cName(c)} y sus ventas de esa campaña no cuentan ahí (ej.: es de ${oc} pero vendió de la base de ${cName(c)}). <b>Agregar</b>: un asesor que solo aparece en ${oc} entra a la gráfica de ${cName(c)} y sus ventas de ${oc} cuentan ahí. Aplica cuando arriba eliges <b>${cName(c)}</b> (gráfica de ventas, KPIs de Agentes y 🎯 Cumplimiento). Ventas de los meses activos.</div>
  <div class="tbl"><table class="agct"><tr><th>Asesor</th><th style="text-align:right">${ico(c)} Ventas en ${cName(c)}</th><th style="text-align:right">${ico(CAMPS.find(([x])=>x!==c)[0])} Ventas en ${oc}</th><th>Estado</th><th></th></tr>`+
  L.map(x=>`<tr data-a="${x.a}"${x.st==="out"||x.st==="off"?' style="opacity:.75"':""}><td><b>${pretty(x.a)}</b></td><td style="text-align:right">${fmt(x.own)}</td><td style="text-align:right">${fmt(x.oth)}</td><td>${lab[x.st]}</td><td style="text-align:right">${act[x.st]}</td></tr>`).join("")+`</table></div>`}
$("c1ag").addEventListener("click",()=>{AGCC=$("cf").value;drawAgc()});
$("mbody").addEventListener("click",async e=>{const t=e.target.closest("[data-gc]");if(t){AGCC=t.dataset.gc;drawAgc();return}
  const b=e.target.closest("[data-ga]");if(!b)return;const c=AGCC,o=AGC()[c]||(AGC()[c]={out:[],in:[]});o.out=o.out||[];o.in=o.in||[];const g=b.dataset.ga;
  if(g==="reset"){o.out=[];o.in=[]}else{const a=b.closest("tr").dataset.a;
    if(g==="out")o.out.push(a);if(g==="back")o.out=o.out.filter(x=>x!==a);if(g==="in")o.in.push(a);if(g==="unin")o.in=o.in.filter(x=>x!==a)}
  await API.config("agc",AGC());drawAgc();draw()});
let C1M="v";$("c1m").addEventListener("click",e=>{const x=e.target.closest("button");if(!x)return;if(x.dataset.m==="c"){CUMK="";drawCumA();return}C1M=x.dataset.m;$("c1m").querySelectorAll("button").forEach(y=>y.classList.toggle("on",y===x));draw()});
/* ---------- Página 7: Geografía y edad ---------- */
const DIMN={d:"Departamento",c:"Ciudad",e:"Rango de edad"},gname=(dim,n)=>n[0]==="("?n:dim==="e"?n:pretty(n);
const gkey=(dim,r)=>dim==="e"?AB(r[10]):(dim==="d"?r[8]:r[9])||"(sin dato)";
function gdata(dim,ks){
  const m={},get=n=>m[n]||(m[n]={n,reg:0,v:0,p:0,s:0});
  (ks||MKF()).forEach(k=>{const G=DB[k].geo||{};for(const c in G){if(!cOK(c))continue;const g=G[c][dim]||{};for(const n in g)get(n).reg+=g[n]}});
  rows(true).forEach(r=>{if(ks&&!ks.includes(r.k))return;const o=get(gkey(dim,r));o.v+=r[2];o.p+=r[3];o.s++});
  const L=Object.values(m);L.forEach(o=>o.ef=o.reg?o.v/o.reg*100:0);return L;
}
const efp=v=>v.toFixed(2).replace(".",",")+"%";
function gtable(dim,L,showShare){
  const T=L.reduce((s,x)=>({reg:s.reg+x.reg,v:s.v+x.v,p:s.p+x.p}),{reg:0,v:0,p:0});
  return `<table><tr><th>${DIMN[dim]}</th><th>Registros</th><th>Ventas (pólizas)</th><th>% de las ventas</th><th>Producción</th><th>Efectividad</th></tr>`+
    L.map(x=>`<tr><td>${gname(dim,x.n)}</td><td>${fmt(x.reg)}</td><td>${fmt(x.v)}</td><td>${T.v?(x.v/T.v*100).toFixed(1).replace(".",","):"0"}%</td><td>${money(x.p)}</td><td>${efp(x.ef)}</td></tr>`).join("")+
    `<tr><th>Total</th><th>${fmt(T.reg)}</th><th>${fmt(T.v)}</th><th>100%</th><th>${money(T.p)}</th><th>${efp(T.reg?T.v/T.reg*100:0)}</th></tr></table>`;
}
function draw7(){
  const ks=MKF(),old=ks.filter(k=>!DB[k].geo);
  $("gw").hidden=!old.length;$("gw").textContent=old.length?`⚠ ${old.map(mname).join(", ")}: base cargada sin ciudad, departamento y edad. Reemplázala en «Cargar información» con el mismo Excel.`:"";
  const D=gdata("d"),C=gdata("c"),E=gdata("e");
  const top=(L,k)=>[...L].filter(x=>x.n[0]!=="(").sort((a,b)=>b[k]-a[k])[0];
  const ER=EDADES.concat([SINE]).map(n=>E.find(x=>x.n===n)).filter(x=>x&&(x.reg||x.v));
  const sold=rows(true).filter(r=>r[10]!=null),avg=sold.length?sold.reduce((s,r)=>s+r[10]*r[2],0)/sold.reduce((s,r)=>s+r[2],0):null;
  const td=top(D,"v"),tc=top(C,"v"),te=top(ER.filter(x=>x.n!==SINE),"v"),tee=top(ER.filter(x=>x.n!==SINE&&x.reg>=100),"ef");
  const k=(t,v,s,f,tt)=>`<div class="k hovk" data-f="${f||""}" data-tt="${(tt||"").replace(/"/g,"&quot;")}"><span>${t}</span><div style="font-size:20px">${v}</div><span>${s||""}</span></div>`;
  $("gk").innerHTML=k("Departamento que más vende",td?gname("d",td.n):"—",td?fmt(td.v)+" pólizas":"",td?"d:"+td.n:"",td?gname("d",td.n):"")+k("Ciudad que más vende",tc?gname("c",tc.n):"—",tc?fmt(tc.v)+" pólizas":"",tc?"c:"+tc.n:"",tc?gname("c",tc.n):"")+
    k("Edad con más ventas",te?te.n+" años":"—",te?fmt(te.v)+" pólizas":"",te?"e:"+te.n:"",te?te.n+" años":"")+k("Edad con mejor efectividad",tee?tee.n+" años":"—",tee?efp(tee.ef):"",tee?"e:"+tee.n:"",tee?tee.n+" años":"")+k("Edad promedio de quien compra",avg==null?"—":Math.round(avg)+" años","","t:","todas las ventas");
  const nm=dim=>x=>Object.assign({},x,{n:gname(dim,x.n)});
  bars($("gd"),[...D].filter(x=>x.v).sort((a,b)=>b.v-a.v).slice(0,15).map(nm("d")),"v",false,fmt);
  bars($("gc"),[...C].filter(x=>x.v).sort((a,b)=>b.v-a.v).slice(0,15).map(nm("c")),"v",false,fmt);
  bars($("ge1"),ER.map(x=>Object.assign({},x,{n:x.n===SINE?x.n:x.n+" años"})),"v",false,fmt);
  bars($("ge2"),ER.filter(x=>x.n!==SINE).map(x=>Object.assign({},x,{n:x.n+" años"})),"ef",true,efp);
  $("get").innerHTML=ER.length?gtable("e",ER):"";
  draw7d();draw7f();draw7r();drawProd4(rows(true),MKF(),"__total","v");drawDvIni();
}
function rankLine(el,L,f,rot,big){
  if(!L.length){el.innerHTML='<div class="empty">Sin ventas con los filtros actuales.</div>';return}
  const W=big?Math.max(960,L.length*50):960,H=rot?(big?420:360):300,l=big?110:20,r=20,t=34,b=rot?(big?150:110):40,mx=Math.max(1,...L.map(x=>x.y))*1.12;
  const px=i=>L.length>1?l+30+i*(W-l-r-60)/(L.length-1):W/2,py=v=>t+(H-t-b)*(1-v/mx);
  let g="";for(let i=0;i<=4;i++){const y=t+(H-t-b)*i/4;g+=`<line class="gl" x1="${l}" x2="${W-r}" y1="${y}" y2="${y}"/>`}
  g+=`<polyline fill="none" stroke="var(--bar)" stroke-width="2.5" stroke-linejoin="round" points="${L.map((x,i)=>px(i)+","+py(x.y)).join(" ")}"/>`;
  L.forEach((x,i)=>{const X=px(i),Y=py(x.y);
    g+=`${big?`<rect class="hit" data-i="${i}" x="${X-22}" y="${t-10}" width="44" height="${H-b-t+10}" fill="transparent" style="cursor:pointer"/>`:""}<circle cx="${X}" cy="${Y}" r="5" fill="var(--bar)" stroke="var(--card)" stroke-width="2" style="pointer-events:none">${big?"":`<title>${x.n}: ${f(x.y)}</title>`}</circle><text x="${X}" y="${big&&i%2&&i<L.length-1&&Y+21<H-b-6?Y+21:Y-11}" text-anchor="middle" style="fill:var(--tx);font-size:12px;font-weight:700">${f(x.y)}</text>`;
    g+=rot?`<text class="ax" transform="translate(${X},${H-b+14}) rotate(-40)" text-anchor="end">${x.n}</text>`:`<text class="ax" x="${X}" y="${H-b+20}" text-anchor="middle">${x.n}</text>`});
  el.innerHTML=`<div class="tbl"><svg viewBox="0 0 ${W} ${H}" style="min-width:620px;width:100%">${g}</svg></div>`;
  el._L=L;
}
let GRD="c";
function draw7d(){
  const n=+$("grk").value,m=$("grm").value,f=m==="p"?v=>"$"+(v>=1e6?(v/1e6).toFixed(1).replace(".",",")+"M":fmt(v)):fmt;
  $("grk").parentElement.style.display=GRD==="e"?"none":"";
  $("grt").textContent="Ranking de "+(m==="p"?"producción":"ventas")+" · "+({c:"Ciudades",d:"Departamentos",e:"Edades"})[GRD];
  let L;
  if(GRD==="e"){const E=gdata("e");L=EDADES.concat([SINE]).map(e=>E.find(x=>x.n===e)).filter(x=>x&&x[m]>0).map(x=>({n:x.n===SINE?x.n:x.n+" años",y:x[m],v:x.v,p:x.p}))}
  else L=gdata(GRD).filter(x=>x[m]>0&&x.n[0]!=="(").sort((a,b)=>b[m]-a[m]).slice(0,n).map(x=>({n:gname(GRD,x.n),y:x[m],v:x.v,p:x.p}));
  rankLine($("grc"),L,f,GRD!=="e",true);
}
$("grdim").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;GRD=b.dataset.d;$("grdim").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));draw7d()});
$("grmb").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;$("grm").value=b.dataset.m;$("grmb").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));draw7d()});
function draw7f(){
  const dim=$("gdim2").value,n=+$("gtop").value,med=$("gmed").value,ks=MKF();
  if(!ks.length){$("gfl").innerHTML='<div class="empty">Activa al menos un mes.</div>';$("gft").innerHTML="";return}
  const tot=gdata(dim);let names;
  if(dim==="e")names=EDADES.concat([SINE]).filter(x=>tot.some(t=>t.n===x&&t.v));
  else names=[...tot].filter(x=>x.v&&x.n[0]!=="(").sort((a,b)=>b[med]-a[med]).slice(0,n).map(x=>x.n);
  const per=ks.map(k=>{const m={};gdata(dim,[k]).forEach(x=>m[x.n]=x);return m});
  const S=names.map(nn=>({n:gname(dim,nn)+(dim==="e"&&nn!==SINE?" años":""),v:per.map(m=>m[nn]?m[nn][med]:0)}));
  if(!S.length){$("gfl").innerHTML='<div class="empty">Sin ventas con los filtros actuales.</div>';$("gft").innerHTML="";return}
  const MC=["#1f6feb","#e5833b","#12a37f","#a05cd6","#d64545","#c9a227","#2aa6c9","#7a8b99","#e255a1","#6b8e23","#8d5a3c","#3f51b5"],fv=med==="p"?v=>"$"+(v>=1e6?(v/1e6).toFixed(1).replace(".",",")+" M":fmt(v)):fmt;
  const mxv=Math.max(1,...S.flatMap(x=>x.v)),mc=i=>MC[(allM=MK()).indexOf(ks[i])%MC.length];let allM;
  $("gfl").innerHTML=`<div class="msg" style="margin:0 0 10px">Cada ${DIMN[dim].toLowerCase()} tiene una barra por mes: así comparas cuánto vendió en cada mes.</div>`+
    `<div class="lg" style="margin:0 0 10px">${ks.map((k,i)=>`<span><i style="background:${mc(i)}"></i>${mname(k)}</span>`).join("")}</div>`+
    S.map(x=>`<div style="display:grid;grid-template-columns:minmax(90px,160px) 1fr;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd)"><b style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${x.n}">${x.n}</b><div>`+
      x.v.map((v,i)=>`<div style="display:grid;grid-template-columns:1fr 70px;gap:8px;align-items:center;margin:2px 0" title="${x.n} · ${mname(ks[i])}: ${fv(v)}"><span style="background:var(--bg);border-radius:4px;height:16px;overflow:hidden"><i style="display:block;height:100%;width:${v/mxv*100}%;background:${mc(i)};border-radius:4px"></i></span><span style="font-size:13px;font-weight:600;text-align:right">${fv(v)}</span></div>`).join("")+`</div></div>`).join("");
  const f=med==="p"?money:fmt,L=ks.length;
  const vr=(a,b)=>{if(L<2)return "";if(!b)return a?"nuevo":"—";const d=(a-b)/b*100;return `<span style="color:${d>=0?"var(--ac2)":"var(--dng)"};font-weight:600">${d>=0?"▲ +":"▼ "}${d.toFixed(0)}%</span>`};
  $("gft").innerHTML=`<table><tr><th>${DIMN[dim]}</th>${ks.map(k=>`<th>${mname(k)}</th>`).join("")}<th>Total</th>${L>1?`<th>Variación ${mname(ks[L-2]).slice(0,3)} → ${mname(ks[L-1]).slice(0,3)}</th>`:""}</tr>`+
    S.map(s=>`<tr><td>${s.n}</td>${s.v.map(v=>`<td>${f(v)}</td>`).join("")}<td><b>${f(s.v.reduce((a,b)=>a+b,0))}</b></td>${L>1?`<td>${vr(s.v[L-1],s.v[L-2])}</td>`:""}</tr>`).join("")+`</table>`+
    (dim!=="e"?`<div class="msg">Los ${names.length} con más ${med==="p"?"producción":"ventas"} en los meses seleccionados.${L>1?" La variación compara el último mes con el anterior (si el último mes está incompleto, la variación lo refleja).":""}</div>`:"");
}
$("grk").addEventListener("change",draw7d);
/* Registros por departamento y ciudad (con filtro de ciudades y departamentos) */
const GR={c:new Set(),d:new Set()};
function regData(){const ks=MKF(),M=new Map();let falta=[];
  ks.forEach(k=>{const G=DB[k].geo||{};let ok=false;for(const c in G){if(!G[c].x)continue;ok=true;if(!cOK(c))continue;
    for(const x in G[c].x){let o=M.get(x);if(!o){const t=x.split("\t");o={d:t[0],c:t[1],e:t[2],k:{},t:0};M.set(x,o)}const v=G[c].x[x];o.k[k]=(o.k[k]||0)+v;o.t+=v}}
    if(!ok&&Object.keys(G).length)falta.push(k)});
  return {ks,L:[...M.values()],falta}}
const regOK=o=>(!GR.c.size||GR.c.has(o.c))&&(!GR.d.size||GR.d.has(o.d));
const rgn=n=>n[0]==="("||/años$|^Sin dato$/.test(n)?n:pretty(n);let RGD="d";
$("rgt").addEventListener("mousemove",e=>{const t=e.target.closest("tr.hov"),m=$("mtip"),T=$("rgt")._tips;if(!t||!T){m.hidden=true;return}
  m.innerHTML=T[+t.dataset.i]();m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;let x=e.clientX+16,y=e.clientY+16;if(x+w>innerWidth-8)x=e.clientX-w-16;if(y+h>innerHeight-8)y=Math.max(8,e.clientY-h-16);m.style.left=x+"px";m.style.top=y+"px"});
$("rgt").addEventListener("mouseleave",()=>$("mtip").hidden=true);
$("rgdim").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;e.preventDefault();RGD=b.dataset.d;$("rgdim").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));draw7r()});
function draw7r(){
  const {ks,L,falta}=regData();
  $("rgw").hidden=!falta.length;$("rgw").textContent=falta.length?`⚠ ${falta.map(mname).join(", ")}: base montada antes de esta sección. Usa «Reemplazar» con el mismo Excel para ver sus registros aquí.`:"";
  {const C=new Map(),D=new Map();L.forEach(o=>{if(o.c[0]!=="(")C.set(o.c,(C.get(o.c)||0)+o.t);if(o.d[0]!=="(")D.set(o.d,(D.get(o.d)||0)+o.t)});
   const opt=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]).map(([k])=>`<option value="${pretty(k)}">`).join("");$("rdlc").innerHTML=opt(C);$("rdld").innerHTML=opt(D)}
  {const D=DICS(),has=Object.keys(D).filter(k=>ks.some(m=>DB[m].pr&&DB[m].pr["x_"+k]));if(RGD.startsWith("dic:")&&!has.includes(RGD.slice(4)))RGD="d";
   $("rgdim").innerHTML=[["d","🗺️ Departamentos"],["c","🏙️ Ciudades"],["e","👤 Rangos de edad"],...has.map(k=>["dic:"+k,"📖 "+D[k].t])].map(([v,t])=>`<button class="btn${RGD===v?" on":""}" type="button" data-d="${v}">${t}</button>`).join("")}
  const X=L.filter(regOK);
  if(!ks.length||!X.length){$("rgt").innerHTML='<div class="empty">Sin registros con estos filtros.</div>';$("rgl").innerHTML='<div class="empty">Sin registros con estos filtros.</div>';return}
  $("rgl").innerHTML=line([{n:"Registros de la base"+(GR.c.size||GR.d.size?" (filtrado)":""),v:ks.map(k=>X.reduce((s,o)=>s+(o.k[k]||0),0))}],ks.map(mname),fmt,true);
  const TIPS=[],mk=(x,key)=>{const sub=key==="d"?"c":"d",m=new Map();X.forEach(o=>{const v=key==="e"?(o.e||SINE):o[key];if(key==="c"?(o.c!==x.n||o.d!==x.d):v!==x.raw)return;m.set(o[sub],(m.get(o[sub])||0)+o.t)});
    const L=[...m.entries()].sort((a,b)=>b[1]-a[1]),nm=rgn(x.n);
    if(key==="c")return `<b>${nm}</b> pertenece a:<table class="tt"><tr><th>Departamento</th><th>Registros</th></tr>`+L.map(([n,v])=>`<tr><td>${rgn(n)}</td><td>${fmt(v)}</td></tr>`).join("")+`</table>`;
    const top=L.slice(0,25);return `<b>${nm}</b> · ${L.length} ${key==="d"?(L.length===1?"ciudad":"ciudades"):(L.length===1?"departamento":"departamentos")}<table class="tt"><tr><th>${key==="d"?"Ciudad":"Departamento"}</th><th>Registros</th></tr>`+top.map(([n,v])=>`<tr><td>${rgn(n)}</td><td>${fmt(v)}</td></tr>`).join("")+`</table>`+(L.length>25?`<div style="opacity:.75;margin-top:4px">y ${L.length-25} más…</div>`:"")};
  const tbl=(rowsA,first,extra)=>{const T=rowsA.reduce((s,x)=>s+x.t,0);rowsA.forEach(x=>{x._i=TIPS.length;TIPS.push(()=>mk(x,RGD))});$("rgt")._tips=TIPS;
    return `<table><tr><th>${first}</th>${extra?"<th>Departamento</th>":""}${ks.map(k=>`<th>${mname(k).slice(0,3)}</th>`).join("")}<th>Total</th><th>%</th></tr>`+
      rowsA.map(x=>`<tr class="hov" data-i="${x._i}"><td>${rgn(x.n)}</td>${extra?`<td>${rgn(x.d)}</td>`:""}${ks.map(k=>`<td>${x.k[k]?fmt(x.k[k]):"—"}</td>`).join("")}<td><b>${fmt(x.t)}</b></td><td>${T?(x.t/T*100).toFixed(1).replace(".",","):"0"}%</td></tr>`).join("")+
      `<tr><th>Total</th>${extra?"<th></th>":""}${ks.map(k=>`<th>${fmt(rowsA.reduce((s,x)=>s+(x.k[k]||0),0))}</th>`).join("")}<th>${fmt(T)}</th><th>100%</th></tr></table>`};
  const agg=(key)=>{const m=new Map();X.forEach(o=>{const n=key==="e"?(o.e||SINE):o[key],id=key==="c"?o.d+"\t"+o.c:n;let a=m.get(id);if(!a){a={n,raw:n,d:o.d,k:{},t:0};m.set(id,a)}for(const k in o.k)a.k[k]=(a.k[k]||0)+o.k[k];a.t+=o.t});return [...m.values()].sort((a,b)=>b.t-a.t)};
  if(RGD.startsWith("dic:")){const dk=RGD.slice(4),M=new Map();ks.forEach(k=>{const p=DB[k].pr;if(!p||!p["x_"+dk])return;
      p["x_"+dk].forEach((ci,j)=>{if(p.K&&!cOK(p.K[p.k[j]]))return;const d=p.D[p.d[j]],c=p.C[p.c[j]];if((GR.c.size&&!GR.c.has(c))||(GR.d.size&&!GR.d.has(d)))return;
        const code=p["X_"+dk][ci],n=dicName(dk,code);let o=M.get(n);if(!o){o={n,codes:new Set(),k:{},t:0};M.set(n,o)}if(code)o.codes.add(code);o.k[k]=(o.k[k]||0)+1;o.t++})});
    const A=[...M.values()].sort((a,b)=>b.t-a.t),T=A.reduce((s,x)=>s+x.t,0);$("rgt")._tips=null;
    $("rgt").innerHTML=A.length?`<table><tr><th>${DICS()[dk].t}</th><th>Código</th>${ks.map(k=>`<th>${mname(k).slice(0,3)}</th>`).join("")}<th>Total</th><th>%</th></tr>`+A.map(x=>`<tr><td>${x.n}</td><td>${[...x.codes].join(", ")||"—"}</td>${ks.map(k=>`<td>${x.k[k]?fmt(x.k[k]):"—"}</td>`).join("")}<td><b>${fmt(x.t)}</b></td><td>${T?(x.t/T*100).toFixed(1).replace(".",","):0}%</td></tr>`).join("")+`<tr><th>Total</th><th></th>${ks.map(k=>`<th>${fmt(A.reduce((s,x)=>s+(x.k[k]||0),0))}</th>`).join("")}<th>${fmt(T)}</th><th>100%</th></tr></table>`:'<div class="empty">Las bases de estos meses no traen esta columna.</div>';return}
  if(RGD==="e"){const m=agg("e"),A=EDADES.concat([SINE]).map(e=>m.find(x=>x.n===e)).filter(Boolean).map(x=>Object.assign({},x,{n:x.n===SINE?x.n:x.n+" años"}));
    const old=X.some(o=>o.e==null);
    $("rgt").innerHTML=tbl(A,"Rango de edad",false)+(old?'<div class="msg">Estas bases se montaron antes de este cambio y no traen la edad por ciudad. Usa «Reemplazar» con el mismo Excel.</div>':"");return}
  const D=agg(RGD);
  $("rgt").innerHTML=tbl(D,RGD==="c"?`Ciudad (${D.length})`:`Departamento (${D.length})`,RGD==="c");
}
function rgRender(){
  [["c","rgc","ric"],["d","rgd","rid"]].forEach(([t,box,inp])=>{const b=$(box),i=$(inp);b.querySelectorAll(".tag").forEach(x=>x.remove());
    [...GR[t]].forEach(k=>{const s=document.createElement("span");s.className="tag";s.dataset.t=t;s.dataset.k=k;s.innerHTML=`${pretty(k)}<button data-t="${t}" data-k="${k}" title="Quitar">✕</button>`;b.insertBefore(s,i)})});
  const parts=[];if(GR.c.size)parts.push("ciudades: "+[...GR.c].map(pretty).join(", "));if(GR.d.size)parts.push("departamentos: "+[...GR.d].map(pretty).join(", "));
  $("rgmsg").innerHTML=parts.length?`Mostrando solo registros de ${parts.join(" y ")}. <a href="#" id="rgclr">Quitar filtro</a>`:"";
  const c=$("rgclr");if(c)c.onclick=e=>{e.preventDefault();GR.c.clear();GR.d.clear();rgRender();draw7r()};
}
function rgAdd(t,txt){
  const {L}=regData(),keys=[...new Set(L.map(o=>o[t]).filter(k=>k[0]!=="("))],no=[];
  txt.split(/[,;\n\t]+/).map(x=>x.trim()).filter(Boolean).forEach(q=>{const n=norm(q).replace(/[^a-z0-9]/g,"");
    const k=keys.find(k=>k.replace(/[^a-z0-9]/g,"")===n)||keys.find(k=>k.replace(/[^a-z0-9]/g,"").startsWith(n));
    if(k)GR[t].add(k);else no.push(q)});
  rgRender();draw7r();
  if(no.length)$("rgmsg").innerHTML+=` <span style="color:var(--dng)">No encontré registros en: ${no.join(", ")}.</span>`;
}
[["c","ric"],["d","rid"]].forEach(([t,id])=>{const i=$(id);
  i.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();if(i.value.trim()){rgAdd(t,i.value);i.value=""}}
    if(e.key==="Backspace"&&!i.value&&GR[t].size){GR[t].delete([...GR[t]].pop());rgRender();draw7r()}});
  i.addEventListener("paste",e=>{const v=(e.clipboardData||window.clipboardData).getData("text");if(v){e.preventDefault();rgAdd(t,v);i.value=""}});
  i.addEventListener("change",()=>{if(i.value.trim()){rgAdd(t,i.value);i.value=""}});
  i.parentElement.addEventListener("click",e=>{const b=e.target.closest(".tag button");if(b){GR[b.dataset.t].delete(b.dataset.k);rgRender();draw7r();return}i.focus()})});
function rgTip(t,k){
  const m=new Map(),ix=t==="d"?"c":"d";regData().L.forEach(o=>{if(o[t]!==k)return;m.set(o[ix],(m.get(o[ix])||0)+o.t)});
  const L=[...m.entries()].sort((a,b)=>b[1]-a[1]),tot=L.reduce((s,x)=>s+x[1],0);
  if(!L.length)return `<b>${pretty(k)}</b><br>Sin registros con los filtros actuales`;
  return (t==="d"?`<b>${pretty(k)}</b> · ${L.length} ${L.length===1?"ciudad":"ciudades"} (${fmt(tot)} registros)`:`<b>${pretty(k)}</b> pertenece a:`)+
    `<table class="tt"><tr><th>${t==="d"?"Ciudad":"Departamento"}</th><th>Registros</th></tr>`+L.map(([n,v])=>`<tr><td>${rgn(n)}</td><td>${fmt(v)}</td></tr>`).join("")+`</table>`;
}
$("geof7").addEventListener("mousemove",e=>{const g=e.target.closest(".tag"),m=$("mtip");if(!g||e.target.closest("button")){m.hidden=true;return}
  m.innerHTML=rgTip(g.dataset.t,g.dataset.k);m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;let x=e.clientX+16,y=e.clientY+16;if(x+w>innerWidth-8)x=e.clientX-w-16;if(y+h>innerHeight-8)y=Math.max(8,e.clientY-h-16);m.style.left=x+"px";m.style.top=y+"px"});
$("geof7").addEventListener("mouseleave",()=>$("mtip").hidden=true);
["gdim2","gtop","gmed"].forEach(i=>$(i).addEventListener("change",draw7f));





/* ---------- Base inicial del mes ---------- */
const INI=()=>DB.__ini||(DB.__ini={});let ipending=null;
function parseIni(buf){
  const wb=XLSX.read(buf,{type:"array"});
  for(const sn of wb.SheetNames){const A=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:null});const H0=(A[0]||[]).map(x=>x==null?"":String(x).trim()),H=H0.map(norm);
    const iId=H.findIndex(h=>/identificacion|cedula|documento/.test(h)&&!/tipo/.test(h));if(iId<0)continue;
    const ids=[],cols=H.map((k,i)=>i===iId?null:{h:H0[i],k,raw:[]});
    for(let r=1;r<A.length;r++){const R=A[r];if(!R)continue;const id=R[iId]==null?"":String(R[iId]).trim();if(!id)continue;ids.push(id);cols.forEach((c,i)=>{if(c)c.raw.push(R[i])})}
    const out=cols.filter(c=>c&&c.k).map(c=>{const nums=c.raw.filter(v=>v!=null&&v!=="").every(v=>typeof v==="number"),dist=new Set(c.raw).size;
      if(nums&&dist>60)return {h:c.h,k:c.k,n:c.raw.map(v=>v==null||v===""?null:+v)};
      const V=[],m=new Map(),x=c.raw.map(v=>{const t=v==null?"":String(v).trim();let j=m.get(t);if(j==null){j=V.length;V.push(t);m.set(t,j)}return j});return {h:c.h,k:c.k,V,x}});
    return {ids,cols:out,sheet:sn};}
  throw new Error("no encontré la columna de identificación (cédula).");
}
function renderIni(){
  $("imonths").innerHTML=MESES.map((nm,i)=>{const k=`${YEAR}-${String(i+1).padStart(2,"0")}`,d=INI()[k];
    const cr=d&&DB[k]&&DB[k].pr?(()=>{const s=new Set(DB[k].pr.ids);let n=0;d.ids.forEach(x=>{if(s.has(x))n++});return n})():null;
    return `<div class="m ${d?"ok":""}"><b>${nm}</b><small>${d?`✔ ${fmt(d.ids.length)} registros · ${d.cols.length} columnas<br>${d.file}<br>${"montada el "+new Date(d.at).toLocaleDateString("es-CO")}${cr!=null?`<br>${fmt(cr)} cruzan con la base de ventas`:"<br>⚠ falta la base de ventas de este mes"}`:"Sin base inicial"}</small>
      <button class="btn ${d?"":"pri"}" data-iup="${k}">${d?"Reemplazar":"Montar base"}</button>
      ${d?`<button class="btn del" data-idel="${k}">Eliminar</button><button class="btn dl" data-idl="${k}">⬇ Descargar</button>`:""}</div>`}).join("");
}
async function descargarIni(k){
  const o=await origGet("i",k);if(o){bajar(o.name,o.buf);return}
  if(!confirm(`El Excel original de la base inicial de ${mname(k)} no está guardado en la plataforma.\n\nPara descargarlo tal cual, usa «Reemplazar» con ese mismo Excel una vez.\n\n¿Quieres descargar por ahora la base que tiene la plataforma (mismas columnas y registros)?`))return;
  const d=INI()[k];bajarAOA(`base_inicial_${mname(k).toLowerCase()}_${k.slice(0,4)}.xlsx`,[["Identificación",...d.cols.map(c=>c.h)],...d.ids.map((id,i)=>[id,...d.cols.map(c=>c.n?c.n[i]:c.V[c.x[i]])])],"Base inicial");
}
$("imonths").addEventListener("click",async e=>{const u=e.target.dataset.iup,d=e.target.dataset.idel,dl=e.target.dataset.idl;
  if(u){ipending=u;$("ifile").value="";$("ifile").click()}
  if(dl)descargarIni(dl);
  if(d&&confirm("¿Eliminar la base inicial de "+mname(d)+"?")){if(!await API.eliminar("inicial",d,$("imsg")))return;delete INI()[d];renderIni();drawIni();$("imsg").textContent="Base inicial eliminada."}});
$("ifile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f||!ipending)return;const k=ipending;ipending=null;$("imsg").textContent="Procesando "+f.name+"…";
  try{const buf=await f.arrayBuffer(),r=parseIni(buf);$("imsg").textContent="Guardando "+f.name+" en la plataforma…";const meta=await API.guardar("inicial",k,f.name,buf,r);INI()[k]=Object.assign({file:meta.archivoNombre,at:meta.cargadoEn},r);renderIni();drawIni();
    $("imsg").textContent=`${mname(k)}: ${fmt(r.ids.length)} registros y ${r.cols.length} columnas (hoja «${r.sheet}»).`}
  catch(err){$("imsg").textContent=(err.guardando?"No se pudo guardar: ":"No pude leer el archivo: ")+err.message}});
/* qué columna es qué y cómo se muestra */
const INIF=[
  {id:"sexo",t:"⚧ Sexo",m:k=>/^sexo|genero/.test(k),f:v=>({F:"Femenino",M:"Masculino"})[String(v).toUpperCase()]||v},
  {id:"edad",t:"👤 Edad",m:k=>/edad/.test(k),num:true,f:v=>v==null?SINE:AB(v)+(AB(v)===SINE?"":" años"),ord:v=>EDADES.indexOf(v.replace(" años",""))},
  {id:"ing",t:"💵 Ingresos",m:k=>/ingreso/.test(k),num:true,f:v=>v==null||v<=0?"Sin dato":v<1e6?"Menos de $1 M":v<2e6?"$1 M a $2 M":v<3e6?"$2 M a $3 M":v<5e6?"$3 M a $5 M":"$5 M o más",ord:v=>["Menos de $1 M","$1 M a $2 M","$2 M a $3 M","$3 M a $5 M","$5 M o más","Sin dato"].indexOf(v)},
  {id:"ec",t:"💍 Estado civil",m:k=>/estado_?civil/.test(k),f:v=>v?dicName("ec",dicCode(v)):"(sin dato)"},
  {id:"oc",t:"💼 Ocupación",m:k=>/ocupacion/.test(k),f:v=>v?dicName("oc",dicCode(v)):"(sin dato)"},
  {id:"saldo",t:"🏦 Saldo promedio",m:k=>/saldo/.test(k),f:v=>v===""||v==null?"(sin dato)":/^\d+$/.test(v)?"Más de "+v:"Entre "+v},
  {id:"pct",t:"🏷️ Categoría percentil",m:k=>/percentil/.test(k),f:v=>v?"Categoría "+v:"(sin dato)",ord:v=>v},
  {id:"dep",t:"🗺️ Departamento",m:k=>/dpto|departamento/.test(k),f:v=>v?pretty(norm(v)):"(sin dato)"},
  {id:"ciu",t:"🏙️ Ciudad",m:k=>/ciudad/.test(k),f:v=>v?pretty(norm(v)):"(sin dato)"},
  {id:"ti",t:"🪪 Tipo de documento",m:k=>/tipo/.test(k)&&/document|identific/.test(k),f:v=>v?dicName("ti",dicCode(v)):"(sin dato)"}
];
let INID="pct";
function drawIni(){
  const ks=MKF().filter(k=>INI()[k]);
  const avail=INIF.filter(F=>ks.some(k=>INI()[k].cols.some(c=>F.m(c.k))));if(!avail.some(F=>F.id===INID)&&avail.length)INID=avail[0].id;
  $("inidim").innerHTML=avail.map(F=>`<button class="btn${F.id===INID?" on":""}" type="button" data-i="${F.id}">${F.t}</button>`).join("");
  if(!ks.length){$("init").innerHTML='<div class="empty">Monta la base inicial del mes en «Cargar información» (sección morada) y activa ese mes en los filtros.</div>';$("iniinfo").textContent="";return}
  const F=INIF.find(x=>x.id===INID),M=new Map();let TR=0,TV=0;
  ks.forEach(k=>{const d=INI()[k],c=d.cols.find(c=>F.m(c.k));if(!c)return;
    const sold=new Map();rowsOf(k).forEach(r=>{if(r[11])sold.set(r[11],(sold.get(r[11])||0)+r[2])});
    const p=DB[k]&&DB[k].pr,camp=new Map();if(p&&p.K)p.ids.forEach((id,j)=>camp.set(id,p.K[p.k[j]]));
    d.ids.forEach((id,i)=>{const cp=camp.get(id);if($("cf").value&&cp!==$("cf").value)return;const raw=c.n?c.n[i]:c.V[c.x[i]],n=F.f(raw);let o=M.get(n);if(!o){o={n,reg:0,v:0};M.set(n,o)}o.reg++;TR++;const v=sold.get(id)||0;o.v+=v;TV+=v})});
  let L=[...M.values()];L.forEach(o=>o.ef=o.reg?o.v/o.reg:0);
  if(F.ord)L.sort((a,b)=>{const x=F.ord(a.n),y=F.ord(b.n);return (x<0?99:x)>(y<0?99:y)?1:-1});else L.sort((a,b)=>b.reg-a.reg);
  const P=L.filter(o=>o.reg>=200).map(o=>o.ef),best=L.filter(o=>o.reg>=200).sort((a,b)=>b.ef-a.ef)[0];
  $("iniinfo").innerHTML=`${ks.map(mname).join(", ")} · ${fmt(TR)} registros · ${fmt(TV)} ventas · efectividad ${pc2(TR?TV/TR:0)}`+(best?` · mejor: <b>${best.n}</b> (${pc2(best.ef)})`:"");
  const sem=o=>o.reg<200||!P.length?"":semRank(o.ef,P);
  $("init").innerHTML=`<table><tr><th>${F.t.replace(/^\S+\s/,"")}</th><th>Registros</th><th>% de la base</th><th>Ventas</th><th>Efectividad</th></tr>`+
    L.slice(0,F.id==="ciu"?60:200).map(o=>`<tr><td>${sem(o)?`<span class="sem ${sem(o)}"></span>`:'<span class="sem" style="background:var(--bd)" title="Menos de 200 registros: poca información"></span>'}${o.n}</td><td>${fmt(o.reg)}</td><td>${TR?(o.reg/TR*100).toFixed(1).replace(".",","):0}%</td><td><b>${fmt(o.v)}</b></td><td><b class="semt ${sem(o)}">${pc2(o.ef)}</b></td></tr>`).join("")+
    `<tr><th>Total</th><th>${fmt(TR)}</th><th>100%</th><th>${fmt(TV)}</th><th>${pc2(TR?TV/TR:0)}</th></tr></table>`+
    `<div class="msg">Semáforo: verde = mejor efectividad, amarillo = media, rojo = más baja (solo grupos con 200 registros o más; los grises tienen muy pocos registros para compararlos).${F.id==="ciu"?" Se muestran las 60 ciudades con más registros.":""}</div>`;
}
$("inidim").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;e.preventDefault();INID=b.dataset.i;drawIni()});

/* ---------- Detalle ventas › datos de la base inicial ---------- */
function drawDvIni(){
  const ks=MKF().filter(k=>INI()[k]);
  const R=rows(true),FS=["dep","ciu","sexo","ec","oc","ing","saldo","pct"].map(id=>INIF.find(F=>F.id===id)),COL={dep:"#1f6feb",ciu:"#8b5cf6",sexo:"#e255a1",ec:"#a05cd6",oc:"#2aa6c9",ing:"#12a37f",saldo:"#c9a227",pct:"#e5833b"};
  const KP={};DVD=[];
  const out=FS.map(F=>{const M=new Map();let TR=0,TV=0,TP=0;
    if(F.id==="dep"||F.id==="ciu"){const dim=F.id==="dep"?"d":"c",AG={};const PG={};R.forEach(r=>{const k=(dim==="d"?r[8]:r[9])||"(sin dato)",a=r[0]||"",o=AG[k]||(AG[k]={});o[a]=(o[a]||0)+r[2];const q=PG[k]||(PG[k]={}),pn=prodName(r[4]);q[pn]=(q[pn]||0)+r[2]});
      gdata(dim).forEach(x=>{if(!x.reg&&!x.v)return;const n=x.n[0]==="("?x.n:pretty(x.n);M.set(n,{n,reg:x.reg,v:x.v,p:x.p,ag:AG[x.n]||{},pr:PG[x.n]||{}});TR+=x.reg;TV+=x.v;TP+=x.p})}
    else ks.forEach(k=>{const d=INI()[k],c=d.cols.find(c=>F.m(c.k));if(!c)return;const sold=new Map();R.forEach(r=>{if(r.k!==k||!r[11])return;const o=sold.get(r[11])||{v:0,p:0,ag:{},pr:{}};o.v+=r[2];o.p+=r[3];const a=r[0]||"";o.ag[a]=(o.ag[a]||0)+r[2];const pn=prodName(r[4]);o.pr[pn]=(o.pr[pn]||0)+r[2];sold.set(r[11],o)});
      const p=DB[k]&&DB[k].pr,camp=new Map();if(p&&p.K)p.ids.forEach((id,j)=>camp.set(id,p.K[p.k[j]]));
      d.ids.forEach((id,i)=>{if($("cf").value&&camp.get(id)!==$("cf").value)return;const n=F.f(c.n?c.n[i]:c.V[c.x[i]]);let o=M.get(n);if(!o){o={n,reg:0,v:0,p:0,ag:{},pr:{}};M.set(n,o)}o.reg++;TR++;const sv=sold.get(id);if(sv){o.v+=sv.v;o.p+=sv.p;TV+=sv.v;TP+=sv.p;for(const a in sv.ag)o.ag[a]=(o.ag[a]||0)+sv.ag[a];for(const q in sv.pr)o.pr[q]=(o.pr[q]||0)+sv.pr[q]}})});
    let L=[...M.values()];L.forEach(o=>o.ef=o.reg?o.v/o.reg:0);
    if(F.ord)L.sort((a,b)=>{const x=F.ord(a.n),y=F.ord(b.n);return (x<0?99:x)>(y<0?99:y)?1:-1});else if(F.id==="dep"||F.id==="ciu")L.sort((a,b)=>((b.reg>=200)-(a.reg>=200))||b.ef-a.ef||b.v-a.v);else L.sort((a,b)=>b.reg-a.reg);
    const LF=L;let extra="",tot=L.length;if((F.id==="dep"||F.id==="ciu")&&!DVX.has(F.id)&&L.length>10)L=L.slice(0,10);if(false){const r=L.slice(15),o={n:`Otras ${r.length} ciudades`,reg:0,v:0,p:0,ag:{},pr:{}};r.forEach(x=>{o.reg+=x.reg;o.v+=x.v;o.p+=x.p;for(const a in x.ag)o.ag[a]=(o.ag[a]||0)+x.ag[a];for(const q in x.pr)o.pr[q]=(o.pr[q]||0)+x.pr[q]});o.ef=o.reg?o.v/o.reg:0;o.otras=true;L=L.slice(0,15).concat([o])}
    const P=LF.filter(o=>o.reg>=200&&!o.otras).map(o=>o.ef),sem=o=>o.reg<200||o.otras||!P.length?"":semRank(o.ef,P),best=LF.filter(o=>o.reg>=200&&!o.otras).sort((a,b)=>b.ef-a.ef)[0];
    const esc=t=>t.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
    const tip=o=>{const A=Object.entries(o.ag).sort((a,b)=>b[1]-a[1]);return esc(`<b>${o.n}</b> · ${A.length} ${A.length===1?"asesor":"asesores"}`+(A.length?`<table class="tt"><tr><th>Asesor</th><th>Ventas</th></tr>`+A.map(([a,v])=>`<tr><td>${a?pretty(a):"(sin asesor)"}</td><td>${fmt(v)}</td></tr>`).join("")+`</table>`:"<br>Sin ventas"))};
    KP[F.id]={mv:L.filter(o=>!o.otras&&o.n[0]!=="(").sort((a,b)=>b.v-a.v)[0],be:best};
    return `<div class="sbox" style="--mc:${COL[F.id]}"><h4>${F.t}${(F.id==="dep"||F.id==="ciu")?` <span style="font-weight:500;font-size:12px;opacity:.85">· ${DVX.has(F.id)?"todos, de mejor a peor efectividad":"las 10 con mejor efectividad"}</span>`:""}${best&&F.id!=="dep"&&F.id!=="ciu"?` <span style="font-weight:500;font-size:12px;opacity:.85">· mejor: ${best.n} (${pc2(best.ef)})</span>`:""}</h4><div class="tbl"><table><tr><th>${F.t.replace(/^\S+\s/,"")}</th><th>Registros</th><th>Ventas</th><th>% ventas</th><th>Producción</th><th>Efectividad</th><th style="text-align:center">Ver</th></tr>`+
      L.map(o=>{const key=F.id+"|"+DVD.length;DVD.push({t:F.t.replace(/^\S+\s/,""),o});return `<tr><td>${sem(o)?`<span class="sem ${sem(o)}"></span>`:'<span class="sem" style="background:var(--bd)"></span>'}${o.n}</td><td>${fmt(o.reg)}</td><td><b>${fmt(o.v)}</b></td><td>${TV?(o.v/TV*100).toFixed(1).replace(".",","):0}%</td><td>${money(o.p)}</td><td><b class="semt ${sem(o)}">${pc2(o.ef)}</b></td><td style="white-space:nowrap;text-align:center">${o.v?`<button class="pbtn" type="button" data-dva="${DVD.length-1}" title="Asesores que vendieron">👤</button> <button class="pbtn" type="button" data-dvp="${DVD.length-1}" title="Productos vendidos">📦</button>`:""}</td></tr>`}).join("")+
      `<tr><th>Total${(F.id==="dep"||F.id==="ciu")&&tot>10?` (${tot})`:""}</th><th>${fmt(TR)}</th><th>${fmt(TV)}</th><th>100%</th><th>${money(TP)}</th><th>${pc2(TR?TV/TR:0)}</th><th></th></tr></table></div>${(F.id==="dep"||F.id==="ciu")&&tot>10?`<button class="btn" type="button" data-dvx="${F.id}" style="width:auto;margin:8px 0 0;padding:5px 12px">${DVX.has(F.id)?"－ Ver solo las 10 mejores":`＋ Ver ${F.id==="dep"?"los":"las"} ${tot} ${F.id==="dep"?"departamentos":"ciudades"}`}</button>`:""}</div>`});
  $("gk").querySelectorAll(".kini").forEach(x=>x.remove());const PT=[];if(ks.length){const K=(t,o,sub,tt)=>o?`<div class="k hovk kini" data-pi="${PT.push(o)-1}"><span>${t}</span><div style="font-size:20px">${o.n}</div><span>${sub(o)}</span></div>`:"",pv=o=>fmt(o.v)+" pólizas",pe=o=>pc2(o.ef)+" de efectividad";
    $("gk").insertAdjacentHTML("beforeend",K("Sexo que más compra",KP.sexo.mv,pv)+K("Estado civil que más compra",KP.ec.mv,pv)+K("Ocupación que más compra",KP.oc.mv,pv)+K("Ingresos con mejor efectividad",KP.ing.be,pe)+K("Saldo promedio con mejor efectividad",KP.saldo.be,pe)+K("Percentil con mejor efectividad",KP.pct.be,pe));
    $("gk").querySelectorAll(".kini").forEach(el=>{const o=PT[+el.dataset.pi];if(!o)return;const L=Object.entries(o.pr||{}).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]),T=L.reduce((s,x)=>s+x[1],0);
      el._pt=`<b>Productos vendidos · ${o.n}</b>`+(L.length?`<table class="tt"><tr><th>Producto</th><th>Pólizas</th><th>%</th></tr>`+L.map(([n,v])=>`<tr><td>${n}</td><td>${fmt(v)}</td><td>${(v/T*100).toFixed(1).replace(".",",")}%</td></tr>`).join("")+`<tr><th>Total</th><th>${fmt(T)}</th><th>100%</th></tr></table>`:"<br>Sin ventas")})}
  $("dvini").innerHTML=out.slice(0,2).join("")+(ks.length?out.slice(2).join(""):'<div class="empty" style="grid-column:1/-1">Monta la base inicial del mes (Cargar información › sección morada) para ver sexo, estado civil, ocupación, ingresos, saldo promedio y categoría percentil.</div>');
}
let DVD=[];const DVX=new Set();
$("dvini").addEventListener("click",e=>{const x=e.target.closest("[data-dvx]");if(x){const id=x.dataset.dvx;DVX.has(id)?DVX.delete(id):DVX.add(id);drawDvIni();return}const b=e.target.closest(".pbtn");if(!b)return;const isA=b.dataset.dva!=null,d=DVD[+(isA?b.dataset.dva:b.dataset.dvp)];if(!d)return;const o=d.o,M=isA?o.ag:o.pr,L=Object.entries(M).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]),T=L.reduce((s,x)=>s+x[1],0);
  $("mbody").innerHTML=`<h3>${isA?"👤 Asesores que vendieron":"📦 Productos vendidos"} · ${d.t}: ${o.n}</h3><div class="msg" style="margin:0 0 10px">${fmt(o.reg)} registros · ${fmt(o.v)} pólizas · efectividad ${pc2(o.ef)}</div><div class="tbl"><table><tr><th>${isA?"Asesor":"Producto"}</th><th>Ventas (pólizas)</th><th>%</th></tr>`+
    L.map(([n,v])=>`<tr><td>${isA?(n?pretty(n):"(sin asesor)"):n}</td><td><b>${fmt(v)}</b></td><td>${T?(v/T*100).toFixed(1).replace(".",","):0}%</td></tr>`).join("")+`<tr><th>Total</th><th>${fmt(T)}</th><th>100%</th></tr></table></div>`;
  $("mdl").hidden=false;BLOQUEO.overflow="hidden"});
$("dvini").addEventListener("mousemove",e=>{const t=e.target.closest("tr.hov"),m=$("mtip");if(!t){m.hidden=true;return}
  m.innerHTML=t.dataset.tip;m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;let x=e.clientX+16,y=e.clientY+16;if(x+w>innerWidth-8)x=e.clientX-w-16;if(y+h>innerHeight-8)y=Math.max(8,e.clientY-h-16);m.style.left=x+"px";m.style.top=y+"px"});
$("dvini").addEventListener("mouseleave",()=>$("mtip").hidden=true);
/* ---------- Diccionarios de códigos (Cargar información › Códigos) ---------- */
const DIC0={
  ec:{t:"Estado civil",cols:["estado_civil","estadocivil","estado_civ"],m:{M:"Casado/a",S:"Soltero/a",I:"Unión libre / Conviviente",W:"Viudo/a",F:"Separado/a",D:"Divorciado/a",O:"Otro"}},
  oc:{t:"Ocupación",cols:["ocupacion","referencia_ocupacion","ocupacion_cliente","actividad","actividad_economica"],m:{"1":"Empleado dependiente","2":"Trabajador independiente","3":"Comerciante","4":"Profesional","5":"Técnico","6":"Estudiante","7":"Jubilado / Pensionado","8":"Hogar / Ama(o) de casa","9":"Desempleado",P:"Pensionado",O:"Otra ocupación",I:"Independiente",E:"Empleado",S:"Sin ocupación",N:"No informa"}},
  ti:{t:"Tipo de identificación",cols:["tipo_identificacion","tipo_documento","tipo_de_documento","tipo_id"],m:{"1":"C","2":"E","CC":"C","CE":"E"}}
};
const DICS=()=>{const u=DB.__dic||{},o={};for(const k in DIC0)o[k]={t:DIC0[k].t,cols:DIC0[k].cols,m:u[k]||DIC0[k].m};return o};
const dicCode=v=>v==null?"":String(v).trim().toUpperCase();
const dicName=(k,c)=>{if(!c)return "(sin dato)";const m=DICS()[k].m;if(m[c]!=null)return m[c];const v=Object.values(m).find(x=>String(x).toUpperCase()===c);return v!=null?v:c+" (código sin significado)"};
function renderDic(){const D=DICS();
  $("dicbox").innerHTML=Object.entries(D).map(([k,d])=>`<div class="sbox" style="--mc:${k==="ec"?"#a05cd6":k==="oc"?"#2aa6c9":"#e5833b"}"><h4>${d.t}</h4>
    <div class="msg" style="margin:0 0 6px">Columna de la base: ${d.cols.slice(0,2).join(" o ")}</div>
    <div class="tbl"><table><tr><th>Código</th><th style="text-align:left">Significado</th><th></th></tr>`+
    Object.entries(d.m).map(([c,v])=>`<tr><td><b>${c}</b></td><td style="text-align:left"><input aria-label="Significado del código ${c}" data-dk="${k}" data-dc="${c}" value="${String(v).replace(/"/g,"&quot;")}" style="width:100%"></td><td><button class="btn del" data-dx="${k}" data-dc="${c}" type="button" style="width:auto;margin:0;padding:3px 8px" title="Quitar código">✕</button></td></tr>`).join("")+
    `<tr><td><input aria-label="Código nuevo" data-nk="${k}" placeholder="Nuevo" style="width:64px"></td><td style="text-align:left"><input aria-label="Significado nuevo" data-nv="${k}" placeholder="Significado" style="width:100%"></td><td><button class="btn pri" data-da="${k}" type="button" style="width:auto;margin:0;padding:3px 8px">＋</button></td></tr></table></div></div>`).join("");
}
async function dicSave(k,m){DB.__dic=DB.__dic||{};DB.__dic[k]=m;await API.config("dic",DB.__dic);$("dicmsg").textContent="Guardado.";draw7r()}
$("dicbox").addEventListener("change",e=>{const i=e.target;if(!i.dataset.dk)return;const k=i.dataset.dk,m={...DICS()[k].m};m[i.dataset.dc]=i.value.trim();dicSave(k,m)});
$("dicbox").addEventListener("click",e=>{const b=e.target;
  if(b.dataset.dx){const k=b.dataset.dx,m={...DICS()[k].m};delete m[b.dataset.dc];dicSave(k,m).then(renderDic)}
  if(b.dataset.da){const k=b.dataset.da,c=dicCode($("dicbox").querySelector(`[data-nk="${k}"]`).value),v=$("dicbox").querySelector(`[data-nv="${k}"]`).value.trim();if(!c||!v){$("dicmsg").textContent="Escribe el código y su significado.";return}
    const m={...DICS()[k].m};m[c]=v;dicSave(k,m).then(renderDic)}});
$("dicreset").addEventListener("click",async()=>{if(!confirm("¿Volver a los códigos originales? Se pierden los cambios que hiciste."))return;delete DB.__dic;delete DB.__tip;renderTip();await API.config("dic",null);await API.config("tip",null);renderDic();draw7r();$("dicmsg").textContent="Códigos originales restaurados."});

/* ---------- Tabla de tipificaciones ---------- */
const TIPH=["Código","Descripción","Indicador","Contacto","RPC","APTO","NO APTO","RPC +","Titular","Cerrado","PROSPECTO","Contador","VOLVER A LLAMAR"];
const TIP0=[["001", "cliente_desempleado_sin_ingresos", "RPC", "1", "1", "0", "1", "0", "1", "1", "0", "1", "NO"], ["003", "cliente_llamado_en_los_ultimos_tres_meses", "RPC", "1", "1", "0", "1", "0", "1", "1", "0", "1", "NO"], ["004", "cliente_no_atiende_asesor", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "SI"], ["005", "cliente_no_quiere_volver_a_ser_contactado", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "NO"], ["006", "cliente_prospecto", "RPC", "1", "1", "1", "0", "0", "1", "0", "1", "1", "VALIDAR"], ["007", "cliente_prospecto_no_contesta", "RPC", "1", "1", "1", "0", "0", "1", "0", "1", "1", "VALIDAR"], ["008", "cliente_tiene_prepagada", "RPC", "1", "1", "0", "1", "0", "1", "1", "0", "1", "NO"], ["010", "desacuerdo_con_la_oferta_-_producto", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "SI"], ["011", "desacuerdo_con_la_oferta_precio", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "SI"], ["012", "desconfia_de_informacion_telefonica", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "NO"], ["014", "mala_experiencia_con_seguros", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "NO"], ["015", "mala_experiencia_con_seguros", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "NO"], ["016", "mala_experiencia_con_sura", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "NO"], ["018", "reintentar_contesta_el_cliente", "RPC", "1", "1", "1", "0", "0", "1", "0", "1", "1", "SI"], ["019", "situacion_economica", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "SI"], ["020", "tiene_odontologo_familiar", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "NO"], ["022", "tiene_pólizas_con_otras_entidades", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "NO"], ["023", "cliente_con_idioma_diferente", "RPC", "1", "1", "0", "1", "0", "1", "1", "0", "1", "NO"], ["024", "cliente_no_tiene_producto_con_el_banco", "RPC", "1", "1", "0", "1", "0", "1", "1", "0", "1", "NO"], ["026", "llamada_entrecortada", "RPC", "1", "1", "0", "0", "0", "1", "0", "0", "1", "SI"], ["028", "cliente_dificil_de_localizar", "WPC", "1", "0", "0", "0", "0", "0", "0", "0", "1", "NO"], ["029", "cliente_fallecido", "WPC", "1", "0", "0", "0", "0", "0", "1", "0", "1", "NO"], ["031", "numero errado", "WPC", "1", "0", "0", "0", "0", "0", "1", "0", "1", "NO"], ["032", "reintentar_contesta_otra_persona", "WPC", "1", "0", "0", "0", "0", "0", "0", "0", "1", "SI"], ["034", "cliente_fuera_de_horario", "RPC", "1", "1", "1", "0", "0", "0", "1", "0", "1", "SI"], ["039", "cliente_pep", "RPC", "1", "1", "0", "1", "0", "1", "1", "0", "1", "NO"], ["059", "cliente no cumple condiciones", "RPC", "1", "1", "0", "1", "0", "1", "1", "0", "1", "NO"], ["060", "situacion_actual_eps", "RPC", "1", "1", "0", "1", "0", "1", "1", "0", "1", "NO"], ["100", "venta", "RPC", "1", "1", "1", "0", "1", "1", "1", "0", "1", "NO"], ["133", "reprogramar", "RPC", "1", "1", "1", "0", "0", "1", "0", "1", "1", "SI"], ["156", "cliente_con_poliza_vigente_sura", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "NO"], ["287", "llamada_colgada_en_interaccion", "RPC", "1", "1", "1", "0", "0", "1", "0", "0", "1", "SI"], ["288", "llamada_colgada_con_oferta", "RPC", "1", "1", "1", "0", "0", "1", "0", "0", "1", "SI"], ["289", "tiene_plan_complementario", "RPC", "1", "1", "1", "0", "0", "1", "1", "0", "1", "NO"], ["314", "cliente_no_tiene_eps", "RPC", "1", "1", "0", "1", "0", "1", "1", "0", "1", "NO"], ["033", "contestador_automático", "NC", "0", "0", "0", "0", "0", "0", "0", "0", "1", "SI"], ["036", "llamada_sin_informacion", "NC", "0", "0", "0", "0", "0", "0", "0", "0", "1", "SI"], ["286", "llamada_colgada", "NC", "0", "0", "0", "0", "0", "0", "0", "0", "1", "SI"], ["290", "no_contesta", "NC", "0", "0", "0", "0", "0", "0", "0", "0", "1", "SI"]];
const TIPS=()=>DB.__tip||TIP0,tipKey=t=>String(t||"").replace(/[\s ]+/g,"_").toLowerCase();
let APS=null,APSsrc=null;function prApto(pr,j){if(!pr.r)return false;const T=TIPS();if(APSsrc!==T){APS=new Set(T.filter(r=>String(r[5])==="1").map(r=>tipKey(r[1])));APSsrc=T}return APS.has(tipKey(pr.R[pr.r[j]]))}
function tipOf(res){const k=tipKey(res);return TIPS().filter(r=>tipKey(r[1])===k)}
function renderTip(){const T=TIPS();
  $("tipbox").innerHTML=`<table class="tiptab"><tr>${TIPH.map(h=>`<th>${h}</th>`).join("")}<th></th></tr>`+T.map((r,i)=>`<tr>${r.map((v,j)=>`<td><input aria-label="${TIPH[j]}, fila ${i+1}" data-ti="${i}" data-tj="${j}" value="${String(v).replace(/"/g,"&quot;")}" class="${j===2?"ind ind-"+v:""}"></td>`).join("")}<td><button class="btn del" data-tx="${i}" type="button" style="width:auto;margin:0;padding:3px 8px" title="Quitar fila">✕</button></td></tr>`).join("")+
    `<tr>${TIPH.map((h,j)=>`<td><input aria-label="${h}, fila nueva" data-tn="${j}" placeholder="${j<3?h:""}"></td>`).join("")}<td><button class="btn pri" id="tipadd" type="button" style="width:auto;margin:0;padding:3px 8px">＋</button></td></tr></table>`;
}
async function tipSave(T){DB.__tip=T;await API.config("tip",T);$("dicmsg").textContent="Tipificaciones guardadas.";draw5()}
$("tipbox").addEventListener("change",e=>{const i=e.target;if(i.dataset.ti==null)return;const T=TIPS().map(r=>r.slice());T[+i.dataset.ti][+i.dataset.tj]=i.value.trim();tipSave(T).then(renderTip)});
$("tipbox").addEventListener("click",e=>{const b=e.target;if(b.dataset.tx!=null){const T=TIPS().map(r=>r.slice());T.splice(+b.dataset.tx,1);tipSave(T).then(renderTip)}
  if(b.id==="tipadd"){const v=[...$("tipbox").querySelectorAll("[data-tn]")].map(x=>x.value.trim());if(!v[0]||!v[1]){$("dicmsg").textContent="Escribe al menos el código y la descripción.";return}const T=TIPS().map(r=>r.slice());T.push(v);tipSave(T).then(renderTip)}});

/* ---------- Tipificaciones › aptos y efectividad por asesor ---------- */
function aptosAsesor(){
  const T=TIPS(),ap=new Set(T.filter(r=>String(r[5])==="1").map(r=>tipKey(r[1]))),a0=$("ra").value,M={},get=a=>M[a]||(M[a]={a,ap:0,reg:0,v:0});
  MKF().forEach(k=>{const A=agOf(DB[k]);for(const c in A){if(!cOK(c))continue;for(const x in A[c]){if(a0&&x!==a0)continue;for(const res in A[c][x]){const n=A[c][x][res],o=get(x);o.reg+=n;if(ap.has(tipKey(res)))o.ap+=n}}}});
  rows().forEach(r=>{const x=r[0]||"";if(!x||(a0&&x!==a0))return;get(x).v+=r[2]});
  const X=Object.values(M).filter(x=>x.a).map(x=>Object.assign(x,{ef:x.ap?x.v/x.ap*100:0})).sort((a,b)=>b.ef-a.ef||b.v-a.v),P=X.filter(x=>x.ap).map(x=>x.ef);
  const S=X.reduce((s,x)=>({ap:s.ap+x.ap,v:s.v+x.v,reg:s.reg+x.reg}),{ap:0,v:0,reg:0});
  $("mbody").innerHTML=`<h3>👥 Aptos y efectividad por asesor</h3>
    <div class="msg" style="margin:0 0 10px">${MKF().map(mname).join(", ")}${$("cf").value?" · "+cName($("cf").value):""}${a0?" · "+pretty(a0):""}. <b>Aptos</b> = registros gestionados con una tipificación marcada APTO = 1 en «Cargar información › Códigos» · <b>Efectividad = ventas ÷ aptos</b>.</div>
    <div class="msg" style="margin:0 0 8px"><span class="sem g"></span> Mejor &nbsp; <span class="sem y"></span> Media &nbsp; <span class="sem r"></span> Más baja</div>
    <div class="tbl">${X.length?`<table><tr><th>Agente</th><th>Aptos</th><th>Ventas (pólizas)</th><th>Efectividad</th></tr>`+
      X.map(x=>{const c=x.ap?semRank(x.ef,P):"r";return `<tr><td><span class="sem ${c}"></span>${pretty(x.a)}</td><td>${fmt(x.ap)}</td><td><b>${fmt(x.v)}</b></td><td><b class="semt ${c}">${x.ap?efs(x.ef):"—"}</b></td></tr>`}).join("")+
      `<tr><th>Total · ${X.length} ${X.length===1?"asesor":"asesores"}</th><th>${fmt(S.ap)}</th><th>${fmt(S.v)}</th><th>${efs(S.ap?S.v/S.ap*100:0)}</th></tr></table>`:'<div class="empty">Sin datos con estos filtros.</div>'}</div>`;
  $("mdl").hidden=false;BLOQUEO.overflow="hidden";
}
$("apbtn").addEventListener("click",aptosAsesor);

/* ---------- Meta individual por mes ---------- */
const METAI=()=>DB.__metasI||(DB.__metasI={});
function renderMetaA(){const M=METAI();
  $("matab").innerHTML=`<table><tr><th>Mes</th><th>Meta individual Odontológico<br><small>(ventas por asesor)</small></th><th>Meta producción Odontológico<br><small>($ por asesor)</small></th><th>Meta individual Salud para ti<br><small>(ventas por asesor)</small></th><th>Meta producción Salud para ti<br><small>($ por asesor)</small></th></tr>`+
    MESES.map((nm,i)=>{const k=`${YEAR}-${String(i+1).padStart(2,"0")}`,m=M[k]||{};
      return `<tr><td><b>${nm}</b></td>`+CAMPS.map(([c])=>{const x=m[c]||{};return `<td><input aria-label="Meta individual de ventas ${nm} ${cName(c)}" data-mi="${k}" data-mc="${c}" data-mf="v" inputmode="numeric" placeholder="0" value="${x.v!=null?fmt(x.v):""}"></td><td><input aria-label="Meta individual de producción ${nm} ${cName(c)}" data-mi="${k}" data-mc="${c}" data-mf="p" inputmode="numeric" placeholder="$0" value="${x.p!=null?fmt(x.p):""}"></td>`}).join("")+`</tr>`}).join("")+`</table>`;
}
$("matab").addEventListener("change",async e=>{const t=e.target;if(!t.dataset.mi)return;const M=METAI(),m=M[t.dataset.mi]||(M[t.dataset.mi]={}),c=m[t.dataset.mc]||(m[t.dataset.mc]={});
  const n=numIn(t.value);if(n==null)delete c[t.dataset.mf];else c[t.dataset.mf]=n;await API.config("metasI",METAI());renderMetaA();$("mamsg").textContent=`✔ Guardado: ${mname(t.dataset.mi)} · ${CAMPS.find(x=>x[0]===t.dataset.mc)[1]}`});
/* ---------- Bases › Análisis inteligente (predicción para la base a trabajar) ---------- */
const IAK=300,IAL={A:"#12a37f",B:"#e0a800",C:"#d64545"};let IA=null;
const pc2=v=>(v*100).toFixed(2).replace(".",",")+"%",nmS=n=>n&&n[0]==="("?n:pretty(n||"");
let IAlast="";function iaSetup(){const ks=MK().filter(k=>DB[k].pr),nw=ks[ks.length-1]||"",cur=nw!==IAlast?nw:$("iam").value;IAlast=nw;
  $("iam").innerHTML=ks.map(k=>`<option value="${k}">${mname(k)} ${k.slice(0,4)}</option>`).join("");$("iam").value=ks.includes(cur)?cur:ks[ks.length-1]||""}
function rowsOf(k){return DB[k]?DB[k].rows.filter(r=>!VOFF.has(r[6]||NV)&&cOK(campOf(r))).map(r=>{const x=r.slice();x.k=k;return x}):[]}
function iaFrac(k){const c=corte();return c.curso&&c.k===k&&habMes(k).length?Math.max(.05,c.n/habMes(k).length):1}
function iaModel(hist){
  const MD=new Map(),MC=new Map(),add=(m,k,f,v)=>{const o=m.get(k)||{reg:0,v:0};o[f]+=v;m.set(k,o)};let TR=0,TV=0;
  hist.forEach(k=>{const G=DB[k].geo||{},f=iaFrac(k);for(const c in G){if(!cOK(c)||!G[c].x)continue;for(const x in G[c].x){const t=x.split("\t"),n=G[c].x[x]*f;add(MD,t[0],"reg",n);add(MC,t[0]+"\t"+t[1],"reg",n);TR+=n}}});
  hist.flatMap(rowsOf).forEach(r=>{const d=r[8]||"(sin dato)",c=r[9]||"(sin dato)";add(MD,d,"v",r[2]);add(MC,d+"\t"+c,"v",r[2]);TV+=r[2]});
  const p0=TR?TV/TR:0,sh=(o,pr)=>o?(o.v+IAK*pr)/(o.reg+IAK):pr;
  return {p0,prob:(d,c)=>sh(MC.get(d+"\t"+c),sh(MD.get(d),p0))};
}
function iaValidar(T){ // prueba el método en meses que ya pasaron: predice cada mes solo con los meses anteriores
  const M=MKF().filter(k=>k<T&&DB[k].pr&&DB[k].rows.length),ms=[],L={A:{n:0,v:0},C:{n:0,v:0}};
  M.forEach(k=>{const h=MKF().filter(x=>x<k);if(!h.length)return;const md=iaModel(h);if(!md.p0)return;const pr=DB[k].pr,sold=new Map();
    rows().forEach(r=>{if(r.k===k&&r[11])sold.set(r[11],(sold.get(r[11])||0)+r[2])});
    const X=pr.ids.map((id,j)=>(!pr.K||cOK(pr.K[pr.k[j]]))?{p:md.prob(pr.D[pr.d[j]],pr.C[pr.c[j]]),y:sold.get(id)||0}:null).filter(Boolean).sort((a,b)=>b.p-a.p),n=X.length;
    X.slice(0,Math.floor(n/3)).forEach(o=>{L.A.n++;L.A.v+=o.y});X.slice(Math.ceil(2*n/3)).forEach(o=>{L.C.n++;L.C.v+=o.y});ms.push(k)});
  if(!ms.length)return null;const a=L.A.n?L.A.v/L.A.n:0,c=L.C.n?L.C.v/L.C.n:0;return {ms,a,c,x:c?a/c:0};
}
function iaData(T){
  if(!T||!DB[T]||!DB[T].pr)return null;
  const prev=MKF().filter(k=>k<T),enCurso=rowsOf(T).length>0,hist=enCurso?[...prev,T]:prev;if(!prev.length&&!enCurso)return {T,hist:[]};
  // 1) histórico: registros y ventas por departamento|ciudad|edad
  const H=new Map(),h=k=>H.get(k)||(H.set(k,{reg:0,v:0}),H.get(k));let sinEdad=false;
  hist.forEach(k=>{const G=DB[k].geo||{},f=iaFrac(k);for(const c in G){if(!cOK(c)||!G[c].x)continue;for(const x in G[c].x){const t=x.split("\t");if(t[2]==null)sinEdad=true;h(t[0]+"\t"+t[1]+"\t"+(t[2]||SINE)).reg+=G[c].x[x]*f}}});
  const R=hist.flatMap(rowsOf);R.forEach(r=>{h((r[8]||"(sin dato)")+"\t"+(r[9]||"(sin dato)")+"\t"+AB(r[10])).v+=r[2]});
  const agg=f=>{const m=new Map();H.forEach((o,k)=>{const t=k.split("\t"),kk=f(t),q=m.get(kk)||{reg:0,v:0};q.reg+=o.reg;q.v+=o.v;m.set(kk,q)});return m};
  const TR=[...H.values()].reduce((s,o)=>s+o.reg,0),TV=[...H.values()].reduce((s,o)=>s+o.v,0),p0=TR?TV/TR:0;
  const sh=(o,pr)=>o?(o.v+IAK*pr)/(o.reg+IAK):pr;
  const prob=iaModel(hist).prob; // ciudad, apoyada en su departamento (lo que mejor predijo en las pruebas)
  // 2) registros repetidos y clientes que ya compraron
  const prevIds=new Set(),comp=new Set();MK().filter(k=>k<T).forEach(k=>{const p=DB[k].pr;if(p)p.ids.forEach(x=>prevIds.add(x));DB[k].rows.forEach(r=>{if(r[11])comp.add(r[11])})});
  let rn={reg:0,v:0},rr={reg:0,v:0};hist.forEach(k=>{const p=DB[k].pr;if(!p)return;const before=new Set();MK().filter(x=>x<k).forEach(x=>{const q=DB[x].pr;if(q)q.ids.forEach(i=>before.add(i))});if(!before.size)return;
    const sold=new Map();R.forEach(r=>{if(r.k===k&&r[11])sold.set(r[11],(sold.get(r[11])||0)+r[2])});p.ids.forEach(i=>{const o=before.has(i)?rr:rn;o.reg++;o.v+=sold.get(i)||0})});
  const fRep=rr.reg>=500&&rn.reg>=500?{n:(rn.v/rn.reg)/((rn.v+rr.v)/(rn.reg+rr.reg)),r:(rr.v/rr.reg)/((rn.v+rr.v)/(rn.reg+rr.reg))}:{n:1,r:1};
  // 3) puntuar cada registro de la base a trabajar
  const pr=DB[T].pr,REC=[],YA=[];
  const prOK=j=>!pr.K||cOK(pr.K[pr.k[j]]);
  pr.ids.forEach((id,j)=>{if(!prOK(j))return;const d=pr.D[pr.d[j]],c=pr.C[pr.c[j]],e=pr.e[j]||null,ab=AB(e),rep=prevIds.has(id);
    const o={j,id,d,c,e,ab,rep,a:pr.A?pr.A[pr.a[j]]||"":""};if(comp.has(id)){YA.push(o);return}o.p=prob(d,c)*(rep?fRep.r:fRep.n);REC.push(o)});
  REC.sort((a,b)=>b.p-a.p);const n=REC.length;REC.forEach((o,i)=>o.lote=i<n/3?"A":i<2*n/3?"B":"C");
  const VAL=iaValidar(T);
  const LT={};["A","B","C"].forEach(l=>{const X=REC.filter(o=>o.lote===l),by=f=>{const m=new Map();X.forEach(o=>{const k=f(o),q=m.get(k)||{n:k,reg:0,pv:0};q.reg++;q.pv+=o.p;m.set(k,q)});return [...m.values()].sort((a,b)=>b.reg-a.reg)};
    LT[l]={l,X,reg:X.length,pv:X.reduce((s,o)=>s+o.p,0),rep:X.filter(o=>o.rep).length,ciu:by(o=>o.c+"\t"+o.d),eda:by(o=>o.ab),dep:by(o=>o.d)};LT[l].ef=LT[l].reg?LT[l].pv/LT[l].reg:0});
  // 4) asesores (histórico); activos = con ventas en el último mes con ventas
  const KS=[...hist].reverse().find(k=>DB[k].rows.length)||hist[hist.length-1],act=new Set(DB[KS].rows.filter(r=>r[2]>0).map(r=>r[0]||"")),AR={},AV={};
  hist.forEach(k=>{const A=agOf(DB[k]);for(const c in A){if(!cOK(c))continue;for(const a in A[c]){let q=0;for(const res in A[c][a])q+=A[c][a][res];AR[a]=(AR[a]||0)+q}}});
  R.forEach(r=>{const a=r[0]||"";AV[a]=(AV[a]||0)+r[2]});
  const ase=Object.keys({...AR,...AV}).filter(a=>a&&act.has(a)).map(a=>{const reg=AR[a]||0,v=AV[a]||0;return {a,reg,v,ef:reg?v/reg:0,adj:(v+IAK*p0)/(reg+IAK)}});
  const ok=ase.filter(x=>x.reg>=200).sort((a,b)=>b.adj-a.adj||b.v-a.v),poco=ase.filter(x=>x.reg<200).sort((a,b)=>b.v-a.v);
  ok.forEach((x,i)=>x.lote=i<ok.length/3?"A":i<2*ok.length/3?"B":"C");poco.forEach(x=>x.lote="C");
  // 5) comprobación: si la base a trabajar ya tiene ventas, ver cuánto vendió cada lote predicho
  const sold=new Map();DB[T].rows.forEach(r=>{if(!VOFF.has(r[6]||NV)&&cOK(campOf(r))&&r[11])sold.set(r[11],(sold.get(r[11])||0)+r[2])});
  // comprobación honesta: lotes predichos SOLO con los meses anteriores (sin las ventas de este mes)
  let BT=null;if(sold.size&&prev.length){const m0=iaModel(prev),X0=REC.map(o=>({id:o.id,p:m0.prob(o.d,o.c)})).sort((a,b)=>b.p-a.p),n0=X0.length;
    BT=["A","B","C"].map((l,i)=>{const X=X0.slice(Math.round(i*n0/3),Math.round((i+1)*n0/3)),v=X.reduce((s,o)=>s+(sold.get(o.id)||0),0);return {l,reg:X.length,v,ef:X.length?v/X.length:0,pv:X.reduce((s,o)=>s+o.p,0)}})}
  return {T,hist,prev,enCurso,vT:rowsOf(T).reduce((s,r)=>s+r[2],0),TR,TV,p0,REC,YA,LT,ase:[...ok,...poco],poco:poco.length,fRep,rn,rr,BT,sinEdad,KS,VAL,pv:REC.reduce((s,o)=>s+o.p,0)};
}
function drawIA(){
  iaSetup();const T=$("iam").value,D=IA=iaData(T);
  const clear=m=>{["iarec","ialotes","iaase","iaest","iabtb"].forEach(i=>$(i).innerHTML=`<div class="empty">${m}</div>`);$("iak").innerHTML="";$("iainfo").textContent=""};
  if(!D){clear("Monta una base de ventas para analizarla.");return}
  if(!D.hist||!D.hist.length||!D.TR){clear(`No hay meses anteriores a ${mname(T)} activos en los filtros para aprender del histórico. Marca meses anteriores o elige otra base.`);return}
  $("iainfo").innerHTML=`Analiza la base de <b>${mname(T)}</b> (${fmt(D.REC.length+D.YA.length)} registros${$("cf").value?" de "+cName($("cf").value):""}) aprendiendo de <b>${D.prev.map(mname).join(", ")}${D.enCurso?`${D.prev.length?" y ":""}lo que va de ${mname(T)}</b> (${fmt(D.vT)} ventas hasta ahora)`:"</b>"}. En total ${fmt(Math.round(D.TR))} registros${D.enCurso&&iaFrac(T)<1?` (los de ${mname(T)} cuentan en proporción a los ${corte().n} de ${habMes(T).length} días hábiles que van)`:""} y ${fmt(D.TV)} ventas (efectividad ${pc2(D.p0)}). Cuando montes una base nueva (por ejemplo noviembre) aparece aquí sola y se analiza de inmediato. Respeta los filtros generales.`+
    (D.sinEdad?`<br><span style="color:var(--dng)">⚠ Alguna base del histórico se montó antes de este análisis y no trae la edad por ciudad; usa «Reemplazar» con el mismo Excel.</span>`:"");
  const A=D.LT.A,B=D.LT.B,C=D.LT.C,k=(t,v,sub)=>`<div class="k"><span>${t}</span><div>${v}</div>${sub?`<span>${sub}</span>`:""}</div>`;
  $("iak").innerHTML=k("Registros a trabajar",fmt(D.REC.length),D.YA.length?`${fmt(D.YA.length)} ya son clientes (aparte)`:"")+k("Ventas esperadas",fmt(Math.round(D.pv)),`efectividad esperada ${pc2(D.REC.length?D.pv/D.REC.length:0)}`)+k("Solo con el Lote A",fmt(Math.round(A.pv)),`${(D.pv?A.pv/D.pv*100:0).toFixed(0)}% de las ventas con 1/3 de la base`)+(D.VAL?k("Probado en meses anteriores",D.VAL.x?D.VAL.x.toFixed(1).replace(".",",")+"×":"—",`el Lote A vendió ${D.VAL.x?D.VAL.x.toFixed(1).replace(".",","):"—"} veces lo del C (${D.VAL.ms.map(mname).join(", ")})`):k("Registros repetidos",fmt(D.REC.filter(o=>o.rep).length),"ya estuvieron en bases anteriores"));
  const asA=D.ase.filter(x=>x.lote==="A"),mult=C.ef?A.ef/C.ef:0,hab=habMes(T).length,dA=Math.max(1,Math.round(hab*0.4)),dB=Math.max(1,Math.round(hab*0.35));
  const topC=A.ciu.slice(0,4).map(x=>nmS(x.n.split("\t")[0])),topE=[...A.eda].sort((a,b)=>b.pv/b.reg-a.pv/a.reg).filter(x=>x.reg>=100).slice(0,2).map(x=>x.n+" años");
  const E=estData().G.filter(g=>g.reg>=300).sort((a,b)=>b.ef-a.ef);
  const rec=[
    `<b>Arranca por el Lote A</b> (${fmt(A.reg)} registros): se espera ${pc2(A.ef)} de efectividad, ${mult?mult.toFixed(1).replace(".",",")+" veces":"más"} que el Lote C. Son sobre todo ${topC.join(", ")}.`,
    `<b>La ciudad es lo que más pesa</b>: al probar con los meses anteriores, la ciudad y el departamento sí anticipan dónde se vende más; la edad cambia mucho de un mes a otro, por eso se muestra pero no decide el lote.`,
    (()=>{const c=corte();if(!(c.curso&&c.k===T&&D.BT))return "";const q=habMes(T).length-c.n,[a,bb,cc]=D.BT;
      return `<b>${mname(T)} va en ${c.n} de ${habMes(T).length} días hábiles</b> y la predicción se está cumpliendo: hasta ahora el Lote A va en ${pc2(a.ef)}, el B en ${pc2(bb.ef)} y el C en ${pc2(cc.ef)}. Para los ${q} días hábiles que quedan, concentra la gestión en los registros del Lote A y del B que aún no se hayan trabajado.`})(),
    `<b>Orden y tiempos sugeridos</b> para ${mname(T)} (${hab} días hábiles): Lote A los primeros ~${dA} días hábiles, Lote B los siguientes ~${dB} y el Lote C al final o como relleno cuando se agoten A y B.`,
    asA.length?`<b>El Lote A para tus mejores asesores</b>: ${asA.slice(0,7).map(x=>pretty(x.a)).join(", ")}.`:"",
    D.YA.length?`<b>${fmt(D.YA.length)} registros ya compraron</b> en meses anteriores: sácalos de la gestión normal y ofréceles otro producto (venta cruzada).`:"",
    D.REC.some(o=>o.rep)&&D.fRep.r!==1?`<b>Registros repetidos</b>: en el histórico, los que ya estaban en una base anterior venden ${D.fRep.r<1?((1-D.fRep.r)*100).toFixed(0)+"% menos":((D.fRep.r-1)*100).toFixed(0)+"% más"} que los nuevos (${pc2(D.rr.v/D.rr.reg)} vs ${pc2(D.rn.v/D.rn.reg)}). Ya está tenido en cuenta en los lotes.`:"",
    E.length?`<b>Estrategia que mejor ha funcionado</b>: #${E[0].num} ${E[0].name} (${efs(E[0].ef)})${E.length>1?`, luego #${E[1].num} ${E[1].name} (${efs(E[1].ef)})`:""}. Úsala para el Lote A.`:""
  ].filter(Boolean);
  $("iarec").innerHTML=`<ol style="margin:0;padding-left:20px;line-height:1.7">${rec.map(r=>`<li>${r}</li>`).join("")}</ol>`;
  const lbl={A:"🟢 1° Lote A · mayor probabilidad",B:"🟡 2° Lote B · media",C:"🔴 3° Lote C · más baja"};
  const mini=(L,tit,f)=>`<table><tr><th>${tit}</th><th>Registros</th><th>Ventas esp.</th><th>Efect. esp.</th></tr>`+L.slice(0,8).map(x=>`<tr><td>${f(x.n)}</td><td>${fmt(x.reg)}</td><td>${x.pv.toFixed(1).replace(".",",")}</td><td>${pc2(x.reg?x.pv/x.reg:0)}</td></tr>`).join("")+`</table>`;
  $("ialotes").innerHTML=`<div class="grid3">`+["A","B","C"].map(l=>{const o=D.LT[l],ed=EDADES.concat([SINE]).map(e=>o.eda.find(x=>x.n===e)).filter(Boolean);
    return `<div class="sbox" style="--mc:${IAL[l]}"><h4>${lbl[l]}</h4>
      <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin:0 0 8px"><div class="k"><span>Registros</span><div style="font-size:18px">${fmt(o.reg)}</div></div><div class="k"><span>Ventas esperadas</span><div style="font-size:18px">${fmt(Math.round(o.pv))}</div></div><div class="k"><span>Efect. esperada</span><div style="font-size:18px">${pc2(o.ef)}</div></div></div>
      <div class="msg" style="margin:0 0 6px">${fmt(o.rep)} repetidos · ${fmt(o.reg-o.rep)} nuevos</div>
      <div class="msg" style="margin:0 0 6px">Ciudades</div><div class="tbl">${mini(o.ciu,"Ciudad",n=>{const t=n.split("\t");return nmS(t[0])+` <span style="opacity:.6">${nmS(t[1])}</span>`})}</div>
      <div class="msg" style="margin:8px 0 6px">Rangos de edad</div><div class="tbl">${mini(ed,"Edad",n=>n===SINE?n:n+" años")}</div>
      <div class="msg" style="margin:8px 0 6px">Departamentos</div><div class="tbl">${mini(o.dep,"Departamento",nmS)}</div>
      <button class="btn pri" data-ial="${l}" style="margin-top:10px">⬇ Descargar Lote ${l} con asesor sugerido</button></div>`}).join("")+`</div>`+
    (D.YA.length?`<div style="margin-top:12px"><button class="btn" data-ial="Y" style="width:auto">⬇ Descargar los ${fmt(D.YA.length)} que ya compraron (venta cruzada)</button></div>`:"");
  $("iaase").innerHTML=`<div class="grid3">`+["A","B","C"].map(l=>{const X=D.ase.filter(x=>x.lote===l);
    return `<div class="sbox" style="--mc:${IAL[l]}"><h4>${lbl[l].replace(/Lote (\w)/,"Asesores Lote $1")}</h4><div class="tbl"><table><tr><th>Asesor</th><th>Efect.</th><th>Ventas</th></tr>`+
      (X.length?X.map(x=>`<tr${x.reg<200?' style="opacity:.6" title="Pocos registros gestionados para medir su efectividad"':""}><td>${pretty(x.a)}</td><td>${x.reg?pc2(x.ef):"—"}</td><td>${fmt(x.v)}</td></tr>`).join(""):`<tr><td colspan="3">—</td></tr>`)+`</table></div></div>`}).join("")+`</div>`+
    (D.poco?`<div class="msg">En gris: asesores con menos de 200 registros gestionados en el histórico; quedan en el Lote C hasta tener más datos.</div>`:"");
  $("iabt").hidden=!D.BT;
  if(D.BT){const t=D.BT.reduce((s,x)=>s+x.v,0);$("iabtb").innerHTML=`<div class="msg" style="margin:-4px 0 10px">${mname(T)} ya tiene ventas, así que se puede comprobar si los lotes predichos (solo con el histórico de ${D.prev.map(mname).join(", ")}, sin las ventas de este mes) acertaron:</div><div class="tbl"><table><tr><th>Lote</th><th>Registros</th><th>Ventas esperadas</th><th>Ventas reales</th><th>Efectividad real</th><th>% de las ventas</th></tr>`+
    D.BT.map(x=>`<tr><td><span class="sem ${x.l==="A"?"g":x.l==="B"?"y":"r"}"></span>Lote ${x.l}</td><td>${fmt(x.reg)}</td><td>${fmt(Math.round(x.pv))}</td><td><b>${fmt(x.v)}</b></td><td>${pc2(x.ef)}</td><td>${t?(x.v/t*100).toFixed(0):0}%</td></tr>`).join("")+`</table></div>`+
    (habMes(T).length>corte().n&&corte().k===T?`<div class="msg">${mname(T)} va en ${corte().n} de ${habMes(T).length} días hábiles, por eso las ventas reales aún son menores que las esperadas para el mes completo.</div>`:"")}
  const ES=estData(),G=ES.G.filter(g=>g.reg>=300),LO=[];G.forEach(g=>Object.values(g.lotes).forEach(x=>{if(x.reg>=300)LO.push({g,x})}));
  if(!ES.ks.length){$("iaest").innerHTML='<div class="empty">Monta la base de estrategias (sección verde de «Cargar información»).</div>';return}
  const top=[...G].sort((a,b)=>b.ef-a.ef),tl=LO.sort((a,b)=>b.x.ef-a.x.ef);
  $("iaest").innerHTML=`<div class="grid2"><div class="sbox" style="--mc:#1f6feb"><h4>Mejores estrategias</h4><div class="tbl"><table><tr><th>Estrategia</th><th>Registros</th><th>Ventas</th><th>Efect.</th></tr>`+
    top.slice(0,5).map(g=>`<tr><td>#${g.num} ${g.name}</td><td>${fmt(g.reg)}</td><td>${fmt(g.v)}</td><td>${efs(g.ef)}</td></tr>`).join("")+`</table></div></div>`+
    `<div class="sbox" style="--mc:#a05cd6"><h4>Mejores lotes de estrategia</h4><div class="tbl"><table><tr><th>Lote</th><th>Registros</th><th>Ventas</th><th>Efect.</th></tr>`+
    tl.slice(0,5).map(({g,x})=>`<tr><td>#${g.num} ${g.name} · ${x.n}</td><td>${fmt(x.reg)}</td><td>${fmt(x.v)}</td><td>${efs(x.ef)}</td></tr>`).join("")+`</table></div></div></div><div class="msg">Solo estrategias y lotes con 300 registros o más.</div>`;
}
$("iam").addEventListener("change",drawIA);
$("ialotes").addEventListener("click",e=>{const l=e.target.dataset.ial;if(!l||!IA)return;const D=IA,T=D.T;
  const head=["identificacion","departamento","ciudad","edad","rango_edad","lote","probabilidad_venta_%","repetido","asesor_actual","asesor_sugerido"];
  if(l==="Y"){bajarAOA(`ya_clientes_${mname(T).toLowerCase()}_${T.slice(0,4)}.xlsx`,[head.slice(0,5).concat(["asesor_actual"]),...D.YA.map(o=>[o.id,nmS(o.d),nmS(o.c),o.e||"",o.ab,o.a?pretty(o.a):""])],"Ya clientes");return}
  const as=D.ase.filter(x=>x.lote===l).map(x=>x.a);let n=0;
  bajarAOA(`lote_${l}_${mname(T).toLowerCase()}_${T.slice(0,4)}.xlsx`,[head,...D.LT[l].X.map(o=>[o.id,nmS(o.d),nmS(o.c),o.e||"",o.ab,"Lote "+l,+(o.p*100).toFixed(2),o.rep?"sí":"no",o.a?pretty(o.a):"",as.length?pretty(as[n++%as.length]):""])],"Lote "+l);
});
/* ---------- Página 8: Asesores por mes (uno a uno) ---------- */
function mini(vals,labs,f,col){
  const W=320,H=150,l=18,r=18,t=24,b=26,mx=Math.max(1,...vals)*1.15,n=vals.length;
  const px=i=>n>1?l+12+i*(W-l-r-24)/(n-1):W/2,py=v=>t+(H-t-b)*(1-v/mx);
  let g=`<line class="gl" x1="${l}" x2="${W-r}" y1="${H-b}" y2="${H-b}"/>`;
  if(n>1)g+=`<polyline fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" points="${vals.map((v,i)=>px(i)+","+py(v)).join(" ")}"/>`;
  vals.forEach((v,i)=>{g+=`<circle cx="${px(i)}" cy="${py(v)}" r="4.5" fill="${col}" stroke="var(--card)" stroke-width="2"><title>${labs[i]}: ${f(v)}</title></circle><text x="${px(i)}" y="${py(v)-9}" text-anchor="middle" style="fill:var(--tx);font-size:12px;font-weight:700">${f(v)}</text><text class="ax" x="${px(i)}" y="${H-8}" text-anchor="middle">${labs[i]}</text>`});
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${g}</svg>`;
}
const mdiff=(a,b)=>(+b.slice(0,4)-+a.slice(0,4))*12+(+b.slice(5,7)-+a.slice(5,7));
function draw8(){
  const ks=MKF(),R=rows(true),med=$("amed").value,q=norm($("aq").value).replace(/_/g," ");
  if(!ks.length){$("agrid").innerHTML='<div class="card empty">Activa al menos un mes.</div>';return}
  // última venta de cada asesor en todas las bases cargadas
  const all=MK(),LM=all[all.length-1],last={};all.forEach(k=>DB[k].rows.forEach(r=>{const a=r[0]||"(sin agente)";if(!last[a]||k>last[a])last[a]=k}));
  const m={};R.forEach(r=>{const a=r[0]||"(sin agente)",o=m[a]||(m[a]={v:{},p:{}});o.v[r.k]=(o.v[r.k]||0)+r[2];o.p[r.k]=(o.p[r.k]||0)+r[3]});
  const dias=ks.map(diasMes),val=(o,k,i)=>med==="p"?(o.p[k]||0):med==="d"?(dias[i]?(o.v[k]||0)/dias[i]:0):(o.v[k]||0);
  const f=med==="p"?v=>"$"+(v>=1e6?(v/1e6).toFixed(1).replace(".",",")+" M":fmt(v)):med==="d"?v=>v.toFixed(1).replace(".",","):fmt;
  const names=new Set([...Object.keys(m),...Object.keys(last)]),KC=ks[ks.length-1],enMes=new Set(DB[KC].rows.filter(r=>r[2]>0).map(r=>r[0]||"(sin agente)"));
  let A=[...names].map(a=>{const o=m[a]||{v:{},p:{}},vals=ks.map((k,i)=>val(o,k,i)),gap=last[a]?mdiff(last[a],LM):99;
    return {a,n:pretty(a),vals,sc:vals[vals.length-1],tot:vals.reduce((s,v)=>s+v,0),t:ks.reduce((s,k)=>s+(o.v[k]||0),0),tp:ks.reduce((s,k)=>s+(o.p[k]||0),0),gap,last:last[a]}});
  const ocultos=A.filter(x=>x.gap>=12).length;A=A.filter(x=>x.gap<12);
  // semáforo entre los activos; quien está en 0 en el mes actual pasa a «Retirados» hasta que vuelva a vender
  A.forEach(x=>x.ret=!enMes.has(x.a));
  const act=A.filter(x=>!x.ret).sort((x,y)=>y.sc-x.sc||y.tot-x.tot),n=act.length;
  act.forEach((x,i)=>x.c=i<n/3?"g":i<2*n/3?"y":"r");A.filter(x=>x.ret).forEach(x=>x.c="x");
  const rank=new Map(act.map((x,i)=>[x.a,i+1]));
  if(q)A=A.filter(x=>norm(x.n).replace(/_/g," ").includes(q));
  const o=$("aord").value,ord=(x,y)=>o==="n"?x.n.localeCompare(y.n):y.sc-x.sc||y.tot-x.tot,MA=mname(ks[ks.length-1]);
  const labs=ks.map(k=>mname(k).slice(0,3)+(DHN?` (${Math.min(DHN,habMes(k).length)}d)`:""));
  const COL={g:"#12a37f",y:"#e0a800",r:"#d64545",x:"#8a94a3"};
  const card=x=>{const L=x.vals.length,d=L>1?x.vals[L-1]-x.vals[L-2]:null,pc=L>1&&x.vals[L-2]?d/x.vals[L-2]*100:null;
    return `<div class="ac ac-${x.c}"><h3>${x.c==="x"?"":rank.get(x.a)+". "}${x.n}</h3><div class="s"><b style="color:var(--tx)">${MA}: ${f(x.sc)}</b> · total ${fmt(x.t)} pólizas · ${money(x.tp)}${x.c==="x"?` · última venta: ${x.last?mname(x.last)+" "+x.last.slice(0,4):"—"}`:pc!=null?` · <span style="color:${d>=0?"var(--ac2)":"var(--dng)"};font-weight:600">${d>=0?"▲ +":"▼ "}${pc.toFixed(0)}% vs mes anterior</span>`:""}</div>${mini(x.vals,labs,f,COL[x.c])}</div>`};
  const sec=[["g","🟢 Mejores"],["y","🟡 Medio"],["r","🔴 Más bajos"],["x","⚪ Retirados (0 pólizas en el mes actual)"]];
  const html=sec.map(([c,t])=>{const X=A.filter(x=>x.c===c).sort(ord);return X.length?`<h2 class="agh agh-${c}">${t} <span>${X.length}</span></h2><div class="agrid">${X.map(card).join("")}</div>`:""}).join("");
  $("agrid").innerHTML=(html||'<div class="card empty">Ningún asesor con ventas con estos filtros.</div>')+
    (ocultos?`<div class="msg" style="margin-top:10px">${ocultos} ${ocultos===1?"asesor oculto":"asesores ocultos"} por llevar más de un año sin ventas.</div>`:"");
}
$("aord").addEventListener("change",draw8);$("amedb").addEventListener("click",e=>{e.preventDefault();const x=e.target.closest("button");if(!x)return;$("amed").value=x.dataset.m;$("amedb").querySelectorAll("button").forEach(y=>y.classList.toggle("on",y===x));draw8()});$("aq").addEventListener("input",draw8);
["fd","fh","fp"].forEach(i=>$(i).addEventListener("change",draw));
$("clr").addEventListener("click",()=>{$("fd").value="";$("fh").value="";$("fp").value="";refresh()});

ROOT.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{CURTAB=t.dataset.p;if(CURTAB==="p9")geoLists();setupDH();
  ROOT.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x===t));
  ["p1","p2","p3","p4","p5","p6","p7","p9","p10"].forEach(p=>$(p).hidden=t.dataset.p!==p||p==="p6");$("gfbar").hidden=t.dataset.p==="p1";$("dhbar").hidden=!["p2","p9","p6","p7"].includes(t.dataset.p);
  {const bar=$("dhbar"),h=bar.querySelector("h2");if(t.dataset.p==="p2"){$("dhslot").appendChild(bar);h.textContent="📅 Comparar a la misma fecha (días hábiles) · aplica a Asesores por mes"}else if(t.dataset.p==="p9"){$("dhpop4").appendChild(bar);$("dhpop4").hidden=true;h.textContent="📅 Comparar a la misma fecha (días hábiles)"}else{if(!DHHOME.contains(bar))DHHOME.parentNode.insertBefore(bar,DHHOME.nextSibling);h.textContent="📅 Comparar a la misma fecha (días hábiles) · aplica a esta pestaña"}}
}));

async function cargar(){ // Fase 215: todo sale de la API (resumen + cada base por mes)
  const R=await API.resumen(),cfg=R.config||{};PERM=R;
  DB={};if(cfg.metas)DB.__metas=cfg.metas;if(cfg.metasI)DB.__metasI=cfg.metasI;if(cfg.agc)DB.__agc=cfg.agc;if(cfg.dic)DB.__dic=cfg.dic;if(cfg.tip)DB.__tip=cfg.tip;AGALIAS=cfg.agalias||{};
  const L=R.bases.slice();
  await Promise.all([0,1,2,3].map(async()=>{while(L.length){const b=L.shift(),d=await API.base(b.tipo,b.mes);if(b.tipo==="ventas")DB[b.mes]=d;else if(b.tipo==="inicial")INI()[b.mes]=d;else EST()[b.mes]=d}}));
  agFixDB();renderMonths();renderEst();renderIni();refresh();
  return R;
}

/* ocultar / mostrar menú lateral */
(function(){const b=$("mtog"),W=ROOT.querySelector(".wrap"),set=c=>{W.classList.toggle("mcol",c);b.textContent=c?"☰ Menú":"«";b.title=c?"Mostrar menú":"Ocultar menú";try{localStorage.setItem("stvMenuOculto",c?"1":"0")}catch(e){}};
  let c=false;try{c=localStorage.getItem("stvMenuOculto")==="1"}catch(e){}set(c);b.addEventListener("click",()=>set(!W.classList.contains("mcol")))})();

// leer: las 3 lecturas de Excel del HTML, para las pruebas con archivos sinteticos.
return { cargar: cargar, leer: { parseBook: parseBook, parseIni: parseIni, parseEst: parseEst } };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { STV_MARKUP: STV_MARKUP, stvCrearApp: stvCrearApp };
