// helpers-activos.js — Fase INV2: desde que registrar un elemento exige TODOS los campos (como el HTML de Edwin),
// las pruebas que crean elementos solo para tenerlos (asignar, actas, panel...) los completan con esto. Solo llena lo
// que el cuerpo NO trae (lo que la prueba escribe se respeta, también '' o un valor malo), con datos INVENTADOS válidos:
// el primer valor de cada lista (o uno inventado si la lista está vacía) y, por tipo de campo, texto, 1 o la primera
// opción. El precio va si el propietario es InConexion; la renta, si es otro (igual que el servidor).
'use strict';
const { db } = require('./helpers');
const A = require('../activos');

function _valorLista(nombre, inventado) {
  const l = A.lista(db, nombre);
  if (l.length) return l[0];
  db.prepare('INSERT OR IGNORE INTO activos_listas (lista, valor, orden) VALUES (?, ?, 0)').run(nombre, inventado);
  return inventado;
}

let _n = 0; // IPs distintas para que no salte el aviso de IP repetida
function completar(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
  const t = A.tipo(db, b.tipo, { todos: true });
  if (!t) return b;
  const o = Object.assign({}, b);
  for (const [k, v] of [['marca', 'Marca inventada'], ['modelo', 'Modelo inventado'], ['serial', 'SER-' + String(b.codigo || 'X')], ['observaciones', 'Prueba con datos inventados']]) if (o[k] === undefined) o[k] = v;
  if (o.sede === undefined) o.sede = _valorLista('sedes', 'Sede inventada');
  if (o.operacion === undefined) o.operacion = _valorLista('operaciones', 'Operación inventada');
  if (o.proveedor === undefined) o.proveedor = _valorLista('proveedores', 'InConexion');
  const propio = A.esPropio(o.proveedor);
  const d = Object.assign({}, o.datos && typeof o.datos === 'object' ? o.datos : {});
  for (const c of t.campos) {
    if (c.oculto || d[c.k] !== undefined) continue;
    if ((c.k === 'precio' && !propio) || (c.k === 'renta_mensual' && propio)) continue;
    if (c.k === 'ip') d.ip = '10.250.' + Math.floor(_n / 250) + '.' + (1 + (_n++ % 250));
    else d[c.k] = c.t === 'numero' ? 1 : c.t === 'lista' ? c.o[0] : 'Dato inventado';
  }
  o.datos = d;
  return o;
}

// Edición (PUT, cuerpo completo): lo mismo, para el tipo del elemento (la ruta no acepta «tipo» en el cuerpo).
function completarEdicion(tipo, b) { const o = completar(Object.assign({ tipo }, b)); delete o.tipo; return o; }

// Un elemento con datos incompletos, como los que deja la importación desde Excel (que no exige todo): para las
// pruebas de «datos pendientes», calidad de los datos o RAM sin dato. Devuelve la misma forma que la respuesta HTTP.
function crearIncompleto(b, quien) {
  const v = A.validar(db, b, { nuevo: true });
  if (v.error) return { status: 400, body: { error: v.error } };
  const r = A.crear(db, v.valores, quien || 'Prueba (importación)');
  return r.error ? { status: r.status || 400, body: { error: r.error } } : { status: 201, body: r };
}

module.exports = { completar, completarEdicion, crearIncompleto };
