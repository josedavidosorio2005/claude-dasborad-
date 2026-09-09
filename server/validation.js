// validation.js — Esquemas de validacion de entrada (zod) para cada endpoint.
//
// Regla: nada llega a la base de datos sin pasar por aqui. Si algo no cumple
// (tipo, longitud, formato, rol desconocido, etc.) respondemos 400 con un
// mensaje claro y NO ejecutamos la operacion.
const { z } = require('zod');

// Roles validos: deben coincidir con ALL_ROLES en public/index.html
const ROLES = [
  'ADMIN',
  'CALIDAD',
  'INVENTARIO',
  'GERENCIA',
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
  .string({ required_error: 'La contrasena es obligatoria', invalid_type_error: 'La contrasena debe ser texto' })
  .min(PASSWORD_MIN, `La contrasena debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX, `La contrasena no puede superar ${PASSWORD_MAX} caracteres`);

const userSchema = z
  .string({ required_error: 'El usuario es obligatorio', invalid_type_error: 'El usuario debe ser texto' })
  .trim()
  .min(3, 'El usuario debe tener al menos 3 caracteres')
  .max(32, 'El usuario no puede superar 32 caracteres')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'El usuario solo puede tener letras, numeros, punto, guion y guion bajo (sin espacios)'
  );

const nombreSchema = z
  .string({ required_error: 'El nombre es obligatorio', invalid_type_error: 'El nombre debe ser texto' })
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(120, 'El nombre no puede superar 120 caracteres');

const rolSchema = z.enum(ROLES, {
  errorMap: () => ({ message: `Rol invalido. Debe ser uno de: ${ROLES.join(', ')}` }),
});

const asesorCampanaSchema = z
  .string()
  .trim()
  .max(120, 'asesorCampana no puede superar 120 caracteres')
  .nullish();

// perms: objeto plano de claves conocidas/dinamicas -> booleano.
// Las claves dinamicas (role_*, cliente_*, campana_*) las genera el frontend.
const permsSchema = z
  .record(
    z.string().min(1).max(80).regex(/^[a-zA-Z0-9_]+$/, 'Clave de permiso invalida'),
    z.boolean({ invalid_type_error: 'Los permisos deben ser true/false' })
  )
  .refine((obj) => Object.keys(obj).length <= 200, {
    message: 'Demasiadas claves de permisos',
  });

const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'id invalido' })
    .int('id invalido')
    .positive('id invalido'),
});

// ── Esquemas por endpoint ───────────────────────────────────

const loginBody = z.object({
  user: z.string({ required_error: 'Usuario y contrasena requeridos' }).min(1, 'Usuario y contrasena requeridos'),
  password: z.string({ required_error: 'Usuario y contrasena requeridos' }).min(1, 'Usuario y contrasena requeridos'),
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
  },
};
