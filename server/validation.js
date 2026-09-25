// validation.js — Esquemas de validacion de entrada (zod) para cada endpoint.
//
// Regla: nada llega a la base de datos sin pasar por aqui. Si algo no cumple
// (tipo, longitud, formato, rol desconocido, etc.) respondemos 400 con un
// mensaje claro y NO ejecutamos la operacion.
const { z } = require('zod');

// zod v4 elimino required_error/invalid_type_error/errorMap (construccion por
// objeto) en favor de un unico parametro `error`. Este helper reproduce el
// mismo comportamiento de zod v3: `required` cuando el campo vino ausente
// (undefined), `invalidType` cuando vino con otro tipo -- si no se pasa
// `invalidType`, se deja el mensaje generico de zod (igual que antes, cuando
// solo se pasaba required_error).
function reqStr(required, invalidType) {
  return {
    error: (iss) => (iss.input === undefined ? required : invalidType),
  };
}

// Roles validos: deben coincidir con ALL_ROLES en public/index.html
const ROLES = [
  'ADMIN',
  'CALIDAD',
  'INVENTARIO',
  'GERENCIA',
  'GESTION_HUMANA',
  'CLIENTES_DASH',
  'REPORTES',
  'ASESOR',
  'SUPERVISOR',
  'AUX_ADMIN',
];

// Politica minima de contrasena: longitud. (No forzamos clases de caracteres
// para no bloquear frases-contrasena largas, que son mas seguras.)
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

const passwordSchema = z
  .string(reqStr('La contrasena es obligatoria', 'La contrasena debe ser texto'))
  .min(PASSWORD_MIN, `La contrasena debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX, `La contrasena no puede superar ${PASSWORD_MAX} caracteres`);

const userSchema = z
  .string(reqStr('El usuario es obligatorio', 'El usuario debe ser texto'))
  .trim()
  .min(3, 'El usuario debe tener al menos 3 caracteres')
  .max(32, 'El usuario no puede superar 32 caracteres')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'El usuario solo puede tener letras, numeros, punto, guion y guion bajo (sin espacios)'
  );

const nombreSchema = z
  .string(reqStr('El nombre es obligatorio', 'El nombre debe ser texto'))
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(120, 'El nombre no puede superar 120 caracteres');

const rolSchema = z.enum(ROLES, {
  error: `Rol invalido. Debe ser uno de: ${ROLES.join(', ')}`,
});

const asesorCampanaSchema = z
  .string()
  .trim()
  .max(120, 'asesorCampana no puede superar 120 caracteres')
  .nullish();

// perms: objeto plano de claves conocidas/dinamicas -> booleano.
// Las claves dinamicas (role_*, cliente_*, campana_*) las genera el frontend a
// partir de nombres de cliente/campana, que pueden tener espacios y signos
// (ej. "campana_CLINICA AURORA", "cliente_HOSPITAL LA MARIA").
const permsSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z0-9_ .\-/]+$/, 'Clave de permiso invalida'),
    z.boolean({ error: 'Los permisos deben ser true/false' })
  )
  .refine((obj) => Object.keys(obj).length <= 200, {
    message: 'Demasiadas claves de permisos',
  });

const idParamSchema = z.object({
  id: z.coerce
    .number({ error: 'id invalido' })
    .int('id invalido')
    .positive('id invalido'),
});

// ── Esquemas por endpoint ───────────────────────────────────

const loginBody = z.object({
  user: z.string(reqStr('Usuario y contrasena requeridos')).min(1, 'Usuario y contrasena requeridos'),
  password: z.string(reqStr('Usuario y contrasena requeridos')).min(1, 'Usuario y contrasena requeridos'),
});

const createUserBody = z.object({
  nombre: nombreSchema,
  user: userSchema,
  password: passwordSchema,
  rol: rolSchema,
  perms: permsSchema.optional().default({}),
  asesorCampana: asesorCampanaSchema,
});

const updateUserBody = z
  .object({
    nombre: nombreSchema.optional(),
    user: userSchema.optional(),
    rol: rolSchema.optional(),
    password: passwordSchema.optional(),
    perms: permsSchema.optional(),
    asesorCampana: asesorCampanaSchema,
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nada que actualizar' });

const changePasswordBody = z.object({
  password: passwordSchema,
});

const updatePermsBody = z.object({
  perms: permsSchema,
});

// ── Modulo de Calidad ───────────────────────────────────────

// Nombre de campana: letras/numeros/espacios y algunos signos, 1..120.
// (Las campanas no son un enum fijo: se pueden agregar. El servidor igual
// valida contra la lista de plantillas existentes en el handler.)
const campanaSchema = z
  .string(reqStr('La campana es obligatoria'))
  .trim()
  .min(1, 'La campana es obligatoria')
  .max(120, 'Nombre de campana demasiado largo')
  .regex(/^[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ .\-/]+$/, 'Nombre de campana con caracteres no permitidos');

const fechaSchema = z
  .string(reqStr('La fecha es obligatoria'))
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD');

const mesSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'El mes debe tener formato AAAA-MM');

const respuestaSchema = z.enum(['SI', 'NO', 'N/A', '']);

// answers: { "1": "SI", "2": "NO", ... } — claves numericas, valores acotados.
const answersSchema = z
  .record(
    z.string().regex(/^\d{1,3}$/, 'Clave de item invalida'),
    respuestaSchema
  )
  .refine((o) => Object.keys(o).length >= 1 && Object.keys(o).length <= 100, {
    message: 'Cantidad de respuestas fuera de rango',
  });

const textoCortoOpt = z.string().trim().max(200).optional().default('');

// El puntaje/clasificacion/fallos NO se aceptan del cliente: los calcula el servidor.
const createMonitoreoBody = z.object({
  campana: campanaSchema,
  asesor: z.string(reqStr('El asesor es obligatorio')).trim().min(1).max(120),
  fecha: fechaSchema,
  canal: z.enum(['LLAMADA', 'WPP']).default('LLAMADA'),
  idLlamada: textoCortoOpt,
  telefono: textoCortoOpt,
  codificacion: textoCortoOpt,
  evaluador: z.string().trim().max(120).optional().default(''),
  observaciones: textoCortoOpt,
  answers: answersSchema,
});

// Carga masiva de monitoreos (Excel de 3 hojas: Monitoreos + Diccionario +
// Resumen por Asesor de apoyo — solo "Monitoreos" se parsea). Cada fila es
// el mismo shape que createMonitoreoBody sin "campana" (va una sola vez a
// nivel de carga, no por fila).
const monitoreoBulkFila = createMonitoreoBody.omit({ campana: true });
const monitoreoBulkBody = z.object({
  campana: campanaSchema,
  archivoNombre: z.string().trim().max(300).optional().default(''),
  filas: z.array(monitoreoBulkFila).min(1, 'El archivo no tiene filas validas').max(2000, 'Demasiadas filas en un solo archivo (maximo 2000)'),
});

const updateMonitoreoBody = z
  .object({
    asesor: z.string().trim().min(1).max(120).optional(),
    fecha: fechaSchema.optional(),
    canal: z.enum(['LLAMADA', 'WPP']).optional(),
    idLlamada: z.string().trim().max(200).optional(),
    telefono: z.string().trim().max(200).optional(),
    codificacion: z.string().trim().max(200).optional(),
    evaluador: z.string().trim().max(120).optional(),
    observaciones: z.string().trim().max(200).optional(),
    answers: answersSchema.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nada que actualizar' });

const metaBody = z.object({
  campana: campanaSchema,
  mes: mesSchema,
  liderId: z.coerce.number().int().positive({ message: 'liderId invalido' }),
  metaGrupal: z.coerce.number().int().min(1, 'La meta debe ser al menos 1').max(100000),
  asesores: z.coerce.number().int().min(1, 'Cantidad de asesores invalida').max(1000),
  diasLaborales: z.coerce.number().int().min(1, 'Dias laborales invalidos').max(31),
  whatsapp: z
    .preprocess(
      (v) => (typeof v === 'string' ? v === 'SI' || v === 'true' : v),
      z.boolean()
    )
    .optional()
    .default(false),
  pctWhatsapp: z.coerce.number().int().min(0).max(100).optional().default(0),
});

const updateMetaBody = metaBody.partial().refine((b) => Object.keys(b).length > 0, {
  message: 'Nada que actualizar',
});

// Umbrales de semaforo: campana vacia/omitida = umbral GLOBAL para esa
// metrica (ver server/db.js). verde/amarillo son numeros libres (pueden
// ser %, segundos, etc. segun la metrica) — no se acotan a 0-100 aqui.
const umbralBody = z.object({
  metrica: z
    .string(reqStr('La metrica es obligatoria'))
    .trim()
    .min(1, 'La metrica es obligatoria')
    .max(100),
  campana: z.string().trim().max(120).optional().default(''),
  verde: z.coerce.number({ error: 'Valor verde invalido' }),
  amarillo: z.coerce.number({ error: 'Valor amarillo invalido' }),
  direccion: z.enum(['mayor_es_mejor', 'menor_es_mejor'], {
    error: 'Direccion invalida',
  }),
});

const updateUmbralBody = umbralBody.partial().refine((b) => Object.keys(b).length > 0, {
  message: 'Nada que actualizar',
});

// Nivel de servicio: llamadas contestadas en <=20s sobre el total, por campana/mes.
const nivelServicioBody = z
  .object({
    campana: campanaSchema,
    mes: mesSchema,
    contestadas20s: z.coerce.number().int().min(0, 'Valor invalido').max(10000000),
    llamadasTotales: z.coerce.number().int().min(0, 'Valor invalido').max(10000000),
  })
  .refine((b) => b.contestadas20s <= b.llamadasTotales, {
    message: 'Las llamadas contestadas no pueden superar el total',
    path: ['contestadas20s'],
  });

const updateNivelServicioBody = z
  .object({
    campana: campanaSchema.optional(),
    mes: mesSchema.optional(),
    contestadas20s: z.coerce.number().int().min(0, 'Valor invalido').max(10000000).optional(),
    llamadasTotales: z.coerce.number().int().min(0, 'Valor invalido').max(10000000).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Nada que actualizar' });

// Nivel de servicio DIARIO (Fase 1, carga real del conmutador): una fila por
// (fecha, skillName), agrupadas por campana en el body. serviceLevel20secPct
// es opcional/null a proposito — un dia sin ese dato no es 0% de servicio.
const nivelServicioDiarioFilaSchema = z
  .object({
    fecha: fechaSchema,
    skillName: z.string(reqStr('El skill es obligatorio')).trim().min(1).max(200),
    totalLlamadas: z.coerce.number().int().min(0, 'Valor invalido').max(1000000),
    contestadas: z.coerce.number().int().min(0, 'Valor invalido').max(1000000),
    serviceLevel20secPct: z.number().min(0).max(100).nullable().optional(),
  })
  .refine((f) => f.contestadas <= f.totalLlamadas, {
    message: 'Las llamadas contestadas no pueden superar el total',
    path: ['contestadas'],
  });

const nivelServicioCargaDiariaBody = z.object({
  campana: campanaSchema,
  archivoNombre: z.string().trim().max(200).optional().default(''),
  filas: z
    .array(nivelServicioDiarioFilaSchema)
    .min(1, 'El archivo no tiene filas de datos')
    .max(2000, 'Demasiadas filas en un solo archivo'),
});

// ── Trafico de llamadas (export real de Volvox, hoja DATA) ─────────────
// A diferencia de nivelServicioCargaDiariaBody (arriba), NO trae `campana`:
// un mismo archivo puede traer varias skills de campanas distintas, y la
// campana de cada fila se resuelve server-side por el mapeo skill->campana
// (server/trafico-skills.js), nunca por lo que mande el cliente. Todo lo
// que no sea SKILL_NAME/DATE/TOTAL LLAMADAS/LLAMADAS CONTESTADAS es
// opcional: si no vino en el archivo, la metrica queda ausente (no 0).
const pctOpcional = z.number().min(0).max(100).optional();
const segundosOpcional = z.coerce.number().min(0).max(1000000).optional();

const traficoFilaSchema = z
  .object({
    fecha: fechaSchema,
    skillName: z.string(reqStr('SKILL_NAME es obligatorio')).trim().min(1).max(200),
    totalLlamadas: z.coerce.number().int().min(0).max(1000000),
    contestadas: z.coerce.number().int().min(0).max(1000000),
    llamadasAbandonadas: z.coerce.number().int().min(0).max(1000000).optional(),
    serviceLevel10secPct: pctOpcional,
    serviceLevel20secPct: pctOpcional,
    serviceLevel30secPct: pctOpcional,
    abandonPct: pctOpcional,
    nivelAtencionPct: pctOpcional,
    tasaAbandonoPct: pctOpcional,
    asaSegundos: segundosOpcional,
    ataSegundos: segundosOpcional,
    ahtSegundos: segundosOpcional,
    waitTimeSegundos: segundosOpcional,
  })
  .refine((f) => f.contestadas <= f.totalLlamadas, {
    message: 'Las llamadas contestadas no pueden superar el total',
    path: ['contestadas'],
  });

const traficoCargaBody = z.object({
  archivoNombre: z.string().trim().max(200).optional().default(''),
  filas: z
    .array(traficoFilaSchema)
    .min(1, 'El archivo no tiene filas de datos')
    .max(5000, 'Demasiadas filas en un solo archivo'),
});

const sedeSchema = z.string().trim().min(1).max(60);

const traficoSkillMapeoBody = z.object({
  campana: campanaSchema.nullable(),
  sede: sedeSchema.nullable().optional(),
});

// Trafico de WhatsApp (Fase 50, plantilla real confirmada por Edwin): mismo
// criterio que traficoFilaSchema de arriba, adaptado a que cada fila es una
// COLA por un PERIODO (fechaInicio..fechaFin), no un dia. Solo 5 obligatorias
// (colaWhatsapp + las 2 fechas + total + contestados); el resto opcional.
const traficoWppFilaSchema = z
  .object({
    colaWhatsapp: z.string(reqStr('NOMBRE_COLA_WHATSAPP es obligatorio')).trim().min(1).max(200),
    fechaInicio: fechaSchema,
    fechaFin: fechaSchema,
    totalWhatsapp: z.coerce.number().int().min(0).max(1000000),
    contestados: z.coerce.number().int().min(0).max(1000000),
    abandonados: z.coerce.number().int().min(0).max(1000000).optional(),
    serviceLevel10secPct: pctOpcional,
    serviceLevel20secPct: pctOpcional,
    serviceLevel30secPct: pctOpcional,
    asaSegundos: segundosOpcional,
    ataSegundos: segundosOpcional,
    ahtSegundos: segundosOpcional,
  })
  .refine((f) => f.contestados <= f.totalWhatsapp, {
    message: 'Los WhatsApp contestados no pueden superar el total',
    path: ['contestados'],
  })
  .refine((f) => f.fechaFin >= f.fechaInicio, {
    message: 'FECHA FIN no puede ser anterior a FECHA INICIO',
    path: ['fechaFin'],
  });

const traficoWppCargaBody = z.object({
  campana: campanaSchema,
  archivoNombre: z.string().trim().max(200).optional().default(''),
  filas: z
    .array(traficoWppFilaSchema)
    .min(1, 'El archivo no tiene filas de datos')
    .max(5000, 'Demasiadas filas en un solo archivo'),
});

// Query params ?campana=&mes= (mes opcional).
const calidadQuery = z.object({
  campana: campanaSchema,
  mes: mesSchema.optional(),
});

// ── Agendas de ORLANT (Fase 78) ──────────────────────────────
// Filas como ARRAY (no objeto con las 8 claves repetidas) -- a ~7.500
// filas/mes, el formato de objeto se acerca al limite de express.json
// (2mb, ver config.js); en arrays el mismo archivo pesa ~35% menos.
// Orden FIJO, debe coincidir con AGENDAS_ORDEN_ARRAY (agendas-logic.js) y
// con el orden en que server/agendas.js los vuelve a mapear por nombre:
//   [asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad]
const agendasTextoObligatorio = z.string().trim().min(1).max(200);
const agendasFechaHoraSchema = z
  .string(reqStr('FECHA_SOLICITUD es obligatoria'))
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'FECHA_SOLICITUD debe tener formato AAAA-MM-DD HH:MM:SS');
const agendasFilaArraySchema = z.tuple([
  agendasTextoObligatorio, // asesor
  agendasTextoObligatorio, // sede
  agendasTextoObligatorio, // examen
  agendasTextoObligatorio, // especialidad
  agendasTextoObligatorio, // profesional
  agendasFechaHoraSchema, // fechaSolicitud
  z.enum(['3P', 'GENERAL'], { error: 'TIPO DE LINEA debe ser 3P o GENERAL' }), // tipoLinea
  agendasTextoObligatorio, // entidad (ya anonimizada en el navegador -- nunca vacia: "SIN ENTIDAD" si no habia dato)
]);

const agendasCargaBody = z.object({
  campana: campanaSchema,
  archivoNombre: z.string().trim().max(200).optional().default(''),
  filas: z
    .array(agendasFilaArraySchema)
    .min(1, 'El archivo no tiene filas de datos')
    .max(20000, 'Demasiadas filas en un solo archivo'),
});

// Filtros compartidos por los 3 endpoints de lectura (opciones/especialidad/
// mensual) -- todos opcionales salvo `campana`; un filtro vacio/ausente
// significa "Todos" (sin restringir por esa columna), igual que el resto
// de desplegables "Todos + seleccion" de la plataforma.
const agendasFiltrosQuery = z.object({
  campana: campanaSchema,
  mes: mesSchema.optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
  asesor: z.string().trim().max(200).optional(),
  sede: z.string().trim().max(120).optional(),
  especialidad: z.string().trim().max(120).optional(),
  examen: z.string().trim().max(200).optional(),
  profesional: z.string().trim().max(200).optional(),
  tipoLinea: z.enum(['3P', 'GENERAL']).optional(),
  entidad: z.string().trim().max(200).optional(),
});

// ── Tipificacion de ORLANT (Fase 77) ─────────────────────────
// Filas como ARRAY, mismo motivo que Agendas -- aqui el volumen es
// aproximadamente el DOBLE (~15.000 filas/mes solo Llamadas), ver el
// limite de tamano especifico de esta ruta en server.js. Orden FIJO, debe
// coincidir con TIPIFICACION_ORDEN_ARRAY (tipificacion-logic.js) y con
// CAMPOS_FILA (server/tipificaciones.js):
//   [agente, fecha, hora, duracionMin, tipificacion, skill]
// hora/duracionMin son OPCIONALES (null si el archivo no trae un valor
// valido -- no todas las filas del archivo real de Edwin tienen HORA
// legible, y TIME_MIN no bloquea nada, se guarda para uso futuro).
const tipificacionTextoObligatorio = z.string().trim().min(1).max(200);
const tipificacionHoraSchema = z
  .string()
  .regex(/^\d{2}:\d{2}:\d{2}$/, 'HORA debe tener formato HH:MM:SS')
  .nullable();
const tipificacionFilaArraySchema = z.tuple([
  tipificacionTextoObligatorio, // agente
  fechaSchema, // fecha
  tipificacionHoraSchema, // hora
  z.number().int().min(0).max(100000).nullable(), // duracionMin
  tipificacionTextoObligatorio, // tipificacion (valor original, incluido "-")
  tipificacionTextoObligatorio, // skill
]);

const tipificacionCanalSchema = z.enum(['LLAMADAS', 'WHATSAPP'], { error: 'canal debe ser LLAMADAS o WHATSAPP' });

const tipificacionCargaBody = z.object({
  campana: campanaSchema,
  canal: tipificacionCanalSchema,
  archivoNombre: z.string().trim().max(200).optional().default(''),
  filas: z
    .array(tipificacionFilaArraySchema)
    .min(1, 'El archivo no tiene filas de datos')
    .max(50000, 'Demasiadas filas en un solo archivo'),
});

// Filtros compartidos (Mes/rango) + independientes (Agente/Skill) por
// mitad -- ver public/js/tipificacion.js. `canal` siempre obligatorio: el
// dashboard SIEMPRE pide un canal a la vez (las 2 mitades del panel hacen
// 2 llamadas independientes), nunca "ambos" en una sola consulta.
const tipificacionFiltrosQuery = z.object({
  campana: campanaSchema,
  canal: tipificacionCanalSchema,
  mes: mesSchema.optional(),
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
  agente: z.string().trim().max(200).optional(),
  skill: z.string().trim().max(200).optional(),
});

const tipificacionOpcionesQuery = z.object({
  campana: campanaSchema,
  canal: tipificacionCanalSchema,
});

// ── Dashboards de cliente: cargas de Excel (Fase 2) ─────────
const nombreClienteSeccionSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ _.\-/]+$/, 'Nombre con caracteres no permitidos');

const celdaSchema = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);

const cargaBody = z.object({
  cliente: nombreClienteSeccionSchema,
  seccion: nombreClienteSeccionSchema,
  cadencia: z.enum(['diaria', 'semanal', 'mensual']),
  periodo: z.string().trim().min(4).max(10),
  archivoNombre: z.string().trim().max(200).optional().default(''),
  // Si ya existe una carga para (cliente, seccion, periodo), el POST responde 409
  // y NO sobrescribe salvo que se reenvie con reemplazar:true (feedback Edwin 3.1).
  reemplazar: z.boolean().optional().default(false),
  filas: z
    .array(z.record(z.string().min(1).max(60), celdaSchema))
    .min(1, 'El archivo no tiene filas de datos')
    .max(500, 'Demasiadas filas en un solo archivo'),
});

// ── Configuracion de dashboards (Fase 3) ───────────────────
const columnaSchema = z.object({
  key: z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/, 'key: solo minusculas, numeros y _'),
  label: z.string().trim().min(1).max(120),
  tipo: z.enum(['entero', 'decimal', 'porcentaje', 'texto', 'fecha']),
  opcional: z.boolean().optional(),
});

// ── Modulo de Inventario ───────────────────────────────────

const inventarioItemBody = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  categoria: z.string().trim().min(1).max(100).default('General'),
  descripcion: z.string().trim().max(500).optional().default(''),
  cantidad: z.coerce.number().int().min(0, 'La cantidad no puede ser negativa').max(999999),
  unidad: z.string().trim().min(1).max(30).default('un'),
  ubicacion: z.string().trim().max(200).optional().default(''),
  estado: z.enum(['Disponible', 'En Uso', 'Mantenimiento', 'Dado de Baja']).default('Disponible'),
  proveedor: z.string().trim().max(200).optional().default(''),
  costoUnitario: z.coerce.number().min(0).max(999999999).optional().default(0),
  observaciones: z.string().trim().max(500).optional().default(''),
});

const inventarioItemUpdate = inventarioItemBody.partial().refine(
  (b) => Object.keys(b).length > 0,
  { message: 'Nada que actualizar' }
);

const inventarioMovimientoBody = z.object({
  itemId: z.coerce.number().int().positive({ message: 'itemId invalido' }),
  tipo: z.enum(['Entrada', 'Salida', 'Ajuste', 'Transferencia']),
  cantidad: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1').max(999999),
  fecha: fechaSchema,
  motivo: z.string().trim().max(300).optional().default(''),
  destino: z.string().trim().max(200).optional().default(''),
});

const inventarioCargaBody = z.object({
  items: z
    .array(inventarioItemBody)
    .min(1, 'El archivo no tiene items')
    .max(500, 'Demasiados items en un solo archivo'),
});

const inventarioMovCargaBody = z.object({
  movimientos: z
    .array(inventarioMovimientoBody)
    .min(1, 'El archivo no tiene movimientos')
    .max(500, 'Demasiados movimientos en un solo archivo'),
});

// ── Modulo de Gerencia ─────────────────────────────────────

const gerenciaKpiBody = z.object({
  periodo: z.string().trim().regex(/^\d{4}-\d{2}$/, 'El periodo debe tener formato AAAA-MM'),
  nombre: z.string().trim().min(1, 'El nombre del KPI es obligatorio').max(200),
  categoria: z.string().trim().min(1).max(100).default('General'),
  valor: z.coerce.number(),
  unidad: z.string().trim().max(30).optional().default(''),
  meta: z.coerce.number().nullable().optional().default(null),
  observaciones: z.string().trim().max(500).optional().default(''),
});

const gerenciaKpiUpdate = gerenciaKpiBody.partial().refine(
  (b) => Object.keys(b).length > 0,
  { message: 'Nada que actualizar' }
);

const gerenciaCargaBody = z.object({
  periodo: z.string().trim().regex(/^\d{4}-\d{2}$/, 'El periodo debe tener formato AAAA-MM'),
  kpis: z
    .array(
      z.object({
        nombre: z.string().trim().min(1).max(200),
        categoria: z.string().trim().min(1).max(100).default('General'),
        valor: z.coerce.number(),
        unidad: z.string().trim().max(30).optional().default(''),
        meta: z.coerce.number().nullable().optional().default(null),
        observaciones: z.string().trim().max(500).optional().default(''),
      })
    )
    .min(1, 'El archivo no tiene indicadores')
    .max(200, 'Demasiados indicadores en un solo archivo'),
});

// ── Modulo de Gestion Humana (Fase 10) ─────────────────────

const ghPersonalBody = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  documento: z.string().trim().max(40).optional().default(''),
  cargo: z.string().trim().max(120).optional().default(''),
  campana: z.string().trim().min(1).max(100).default('General'),
  supervisor: z.string().trim().max(200).optional().default(''),
  fecha_ingreso: fechaSchema,
  fecha_salida: z.union([fechaSchema, z.literal(''), z.null()]).optional().default(null),
  motivo_salida: z.string().trim().max(300).optional().default(''),
  costo_hora: z.coerce.number().min(0).max(9999999).optional().default(0),
  horas_mes: z.coerce.number().min(0).max(744).optional().default(192),
  salario: z.coerce.number().min(0).max(999999999).nullable().optional().default(null),
  observaciones: z.string().trim().max(500).optional().default(''),
}).refine(
  (b) => !b.fecha_salida || b.fecha_salida >= b.fecha_ingreso,
  { message: 'La fecha de salida no puede ser anterior a la de ingreso', path: ['fecha_salida'] }
);

const ghPersonalUpdate = z.object({
  nombre: z.string().trim().min(1).max(200).optional(),
  documento: z.string().trim().max(40).optional(),
  cargo: z.string().trim().max(120).optional(),
  campana: z.string().trim().min(1).max(100).optional(),
  supervisor: z.string().trim().max(200).optional(),
  fecha_ingreso: fechaSchema.optional(),
  fecha_salida: z.union([fechaSchema, z.literal(''), z.null()]).optional(),
  motivo_salida: z.string().trim().max(300).optional(),
  costo_hora: z.coerce.number().min(0).max(9999999).optional(),
  horas_mes: z.coerce.number().min(0).max(744).optional(),
  salario: z.coerce.number().min(0).max(999999999).nullable().optional(),
  observaciones: z.string().trim().max(500).optional(),
}).refine((b) => Object.keys(b).length > 0, { message: 'Nada que actualizar' });

const seccionSpecSchema = z.object({
  titulo: z.string().trim().min(1).max(160),
  descripcion: z.string().trim().max(400).optional().default(''),
  cadencia: z.enum(['diaria', 'semanal', 'mensual']),
  periodo: z.enum(['dia', 'semana', 'mes']),
  filaUnica: z.boolean(),
  columnas: z.array(columnaSchema).min(1, 'La seccion necesita al menos una columna').max(60),
});

const dashboardConfigBody = z.object({
  cliente: nombreClienteSeccionSchema,
  titulo: z.string().trim().min(1).max(160),
  vista: z
    .object({
      campo: z.string().trim().min(1).max(60),
      label: z.string().trim().min(1).max(60),
      opciones: z
        .array(z.object({ valor: z.string().trim().min(1).max(60), label: z.string().trim().min(1).max(60) }))
        .min(1)
        .max(12),
    })
    .nullish(),
  secciones: z.record(z.string().min(1).max(60), seccionSpecSchema).refine(
    (o) => Object.keys(o).length >= 1 && Object.keys(o).length <= 30,
    { message: 'El dashboard necesita entre 1 y 30 secciones' }
  ),
  layout: z.object({
    kpis: z.array(z.record(z.string(), z.any())).max(30).optional().default([]),
    tabs: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(40),
          label: z.string().trim().min(1).max(60),
          panels: z.array(z.record(z.string(), z.any())).max(30),
          // Fase 75 (hallazgo Fase 74): faltaban aqui -- Zod descarta por
          // defecto cualquier campo no declarado del objeto, asi que un PUT
          // real de config perdia `oculta`/`subtabs` de TODAS las pestanas
          // (ver dashboard-config-seed.js, p.ej. ORLANT: 7 pestanas ocultas
          // + subtabs en flujo/salida/agendamiento/inasistencia/sta).
          oculta: z.boolean().optional(),
          subtabs: z
            .array(
              z.object({
                key: z.string().trim().min(1).max(40),
                label: z.string().trim().min(1).max(60),
                indices: z.array(z.number().int().min(0)).min(1).max(30),
              })
            )
            .max(10)
            .optional(),
        })
      )
      .min(1, 'El dashboard necesita al menos una pestana')
      .max(20),
  }),
});

// Middleware factory: valida req[part] contra el schema; si falla -> 400.
function validate(schema, part = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const detalles = result.error.issues.map((i) => ({
        campo: i.path.join('.') || part,
        mensaje: i.message,
      }));
      return res.status(400).json({
        error: detalles[0] ? detalles[0].mensaje : 'Datos invalidos',
        detalles,
      });
    }
    // Reemplaza con la version parseada/normalizada (trim, defaults, coercion).
    req[part] = result.data;
    next();
  };
}

module.exports = {
  ROLES,
  PASSWORD_MIN,
  validate,
  schemas: {
    loginBody,
    createUserBody,
    updateUserBody,
    changePasswordBody,
    updatePermsBody,
    idParamSchema,
    createMonitoreoBody,
    updateMonitoreoBody,
    monitoreoBulkBody,
    metaBody,
    updateMetaBody,
    umbralBody,
    updateUmbralBody,
    nivelServicioBody,
    updateNivelServicioBody,
    nivelServicioCargaDiariaBody,
    traficoCargaBody,
    traficoSkillMapeoBody,
    traficoWppCargaBody,
    agendasCargaBody,
    agendasFiltrosQuery,
    tipificacionCargaBody,
    tipificacionFiltrosQuery,
    tipificacionOpcionesQuery,
    calidadQuery,
    cargaBody,
    dashboardConfigBody,
    inventarioItemBody,
    inventarioItemUpdate,
    inventarioMovimientoBody,
    inventarioCargaBody,
    inventarioMovCargaBody,
    gerenciaKpiBody,
    gerenciaKpiUpdate,
    gerenciaCargaBody,
    ghPersonalBody,
    ghPersonalUpdate,
  },
};
