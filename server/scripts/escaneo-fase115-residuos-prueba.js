#!/usr/bin/env node
// scripts/escaneo-fase115-residuos-prueba.js — Fase 115 (autorizado
// explicitamente, 2026-10-04): inventario SOLO LECTURA de posibles residuos
// de prueba en las tablas de carga real (Trafico de Llamadas, Trafico de
// WhatsApp, Agendas, Tipificacion, Inasistencia, Efectividad de
// Agendamiento, Efectividad de Citas, cargas generales) -- nunca toca ni
// borra nada, es un inventario, no una herramienta de limpieza (ver
// limpieza-fase115-residuo-trafico.js para el UNICO residuo ya confirmado
// y borrado).
//
// Calidad (monitoreos) queda fuera a proposito: sus datos de prueba
// conocidos (Asesor 01-05) son aceptados por el usuario, no un residuo a
// investigar.
//
// 2 reportes, ambos agregados (nunca una fila individual completa, igual
// que el resto de scripts de solo lectura contra produccion):
//   1. Grupos (archivoNombre, cargadoPorNombre) cuyo texto calza con un
//      patron sospechoso (prueba, qa, llenado, temporal, borrar
//      automatico), con su conteo de filas.
//   2. Todos los cargadoPorNombre distintos de cada tabla (con conteo) +
//      la lista de usuarios activos actuales -- para comparar a mano y
//      notar una cuenta que ya no existe (la decision de que es o no un
//      residuo la toma el usuario, este script solo junta los datos).
//
// Uso (dentro del contenedor ya corriendo, ver
// .github/workflows/limpieza-fase115-residuo-trafico.yml, modo escanear):
//   docker compose exec -T app node scripts/escaneo-fase115-residuos-prueba.js
'use strict';
const { hydrateEnv } = require('../secrets');

const PATRON = /prueba|\bqa\b|llenado|temporal|borrar.?autom[aá]tico/i;

const TABLAS = [
  { tabla: 'calidad_nivel_servicio_diario', label: 'Trafico de Llamadas' },
  { tabla: 'trafico_whatsapp', label: 'Trafico de WhatsApp' },
  { tabla: 'agendas', label: 'Agendas' },
  { tabla: 'tipificaciones', label: 'Tipificacion' },
  { tabla: 'inasistencias', label: 'Inasistencia' },
  { tabla: 'efectividad_agendamiento', label: 'Efectividad de Agendamiento' },
  { tabla: 'efectividad_citas', label: 'Efectividad de Citas' },
  { tabla: 'dashboard_cargas', label: 'Cargas generales (Gestion de base / resumen / etc.)' },
];

async function main() {
  await hydrateEnv();
  const db = require('../db');

  console.log('[escaneo-fase115] === 1) Grupos archivo/cargadoPor que calzan con un patron sospechoso ===');
  let totalSospechosas = 0;
  for (const { tabla, label } of TABLAS) {
    const grupos = db
      .prepare(`SELECT archivoNombre, cargadoPorNombre, COUNT(*) AS filas FROM ${tabla} GROUP BY archivoNombre, cargadoPorNombre ORDER BY filas DESC`)
      .all();
    const sospechosos = grupos.filter((g) => PATRON.test(g.archivoNombre || '') || PATRON.test(g.cargadoPorNombre || ''));
    if (!sospechosos.length) {
      console.log(`  ${label}: ninguno`);
      continue;
    }
    console.log(`  ${label}:`);
    sospechosos.forEach((g) => {
      console.log(`    - archivoNombre="${g.archivoNombre}" cargadoPorNombre="${g.cargadoPorNombre}" filas=${g.filas}`);
      totalSospechosas += g.filas;
    });
  }
  console.log(`[escaneo-fase115] Total de filas en grupos sospechosos: ${totalSospechosas}`);

  console.log('\n[escaneo-fase115] === 2) cargadoPorNombre distintos por tabla ===');
  for (const { tabla, label } of TABLAS) {
    const nombres = db
      .prepare(`SELECT cargadoPorNombre, COUNT(*) AS filas FROM ${tabla} GROUP BY cargadoPorNombre ORDER BY filas DESC`)
      .all();
    console.log(`  ${label}: ${nombres.map((n) => `"${n.cargadoPorNombre}" (${n.filas})`).join(', ') || '(sin filas)'}`);
  }

  console.log('\n[escaneo-fase115] === 3) Usuarios actuales (para comparar a mano con lo de arriba) ===');
  const usuarios = db.prepare('SELECT nombre, user, active FROM users ORDER BY active DESC, nombre').all();
  usuarios.forEach((u) => console.log(`  ${u.active ? 'activo  ' : 'inactivo'} - "${u.nombre}" (user: ${u.user})`));
}

main().catch((err) => {
  console.error('[escaneo-fase115] ERROR:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
