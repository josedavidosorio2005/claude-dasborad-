// Equidad de profesionales (ORLANT, plan de acción 20/11, punto A6) — PROPUESTA.
// Genera docs/orlant/equidad/PLANTILLA_EQUIDAD_PROFESIONALES_PROPUESTA.xlsx con DATOS INVENTADOS
// (profesionales «Profesional A…F», sedes y entidades ficticias; ningún dato de pacientes).
// No es una plantilla del catálogo de Cargar Datos: los encabezados son una propuesta hasta que
// Isa entregue su matriz real. Uso: node scripts/orlant/equidad-plantilla-propuesta.js
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');

const COLUMNAS = [
  ['FECHA', 'Día de la agenda (AAAA-MM-DD).', '2026-11-16'],
  ['SEDE', 'Sede donde atiende el profesional, tal como la llama ORLANT.', 'Sede 1'],
  ['ESPECIALIDAD', 'Especialidad del profesional en esa agenda.', 'Otorrinolaringología'],
  ['PROFESIONAL', 'Nombre del profesional (o su código, si Isa prefiere no usar el nombre).', 'Profesional A'],
  ['GRUPO_ENTIDAD', 'Uno de: PARTICULAR, POLIZA SURA, OTRAS ENTIDADES (los 3 archivos de hoy).', 'POLIZA SURA'],
  ['ENTIDAD', 'Entidad o plan exacto dentro del grupo (vacío para PARTICULAR).', 'Entidad X'],
  ['CUPOS_OFERTADOS', 'Cupos que el profesional abrió ese día para ese grupo/entidad.', 12],
  ['CITAS_ASIGNADAS', 'Citas que se asignaron en esos cupos.', 10],
  ['CITAS_ATENDIDAS', 'Citas a las que el paciente asistió (opcional si Isa no lo tiene).', 9],
];

// Datos inventados: 2 semanas, 2 sedes, 6 profesionales, 3 grupos.
function filas() {
  const profesionales = [
    ['Profesional A', 'Sede 1', 'Otorrinolaringología'], ['Profesional B', 'Sede 1', 'Otorrinolaringología'],
    ['Profesional C', 'Sede 2', 'Otorrinolaringología'], ['Profesional D', 'Sede 1', 'Audiología'],
    ['Profesional E', 'Sede 2', 'Audiología'], ['Profesional F', 'Sede 2', 'Fonoaudiología'],
  ];
  const grupos = [['PARTICULAR', ''], ['POLIZA SURA', 'Póliza SURA'], ['OTRAS ENTIDADES', 'Entidad X'], ['OTRAS ENTIDADES', 'Entidad Y']];
  const dias = ['2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16', '2026-11-18', '2026-11-20'];
  const out = [];
  let semilla = 7;
  const azar = (n) => { semilla = (semilla * 9301 + 49297) % 233280; return Math.floor((semilla / 233280) * n); };
  for (const fecha of dias) for (const [prof, sede, esp] of profesionales) for (const [grupo, entidad] of grupos) {
    const cupos = 3 + azar(8);
    const asignadas = Math.max(0, cupos - azar(4));
    const atendidas = Math.max(0, asignadas - azar(3));
    out.push([fecha, sede, esp, prof, grupo, entidad, cupos, asignadas, atendidas]);
  }
  return out;
}

const wb = XLSX.utils.book_new();
const datos = XLSX.utils.aoa_to_sheet([COLUMNAS.map((c) => c[0])].concat(filas()));
datos['!cols'] = COLUMNAS.map((c) => ({ wch: Math.max(12, c[0].length + 2) }));
XLSX.utils.book_append_sheet(wb, datos, 'EQUIDAD');
const ayuda = XLSX.utils.aoa_to_sheet([['COLUMNA', 'QUÉ VA', 'EJEMPLO (inventado)']].concat(COLUMNAS)
  .concat([[], ['PROPUESTA: estos encabezados se ajustan a la matriz real de Isa. Datos 100 % inventados.']]));
ayuda['!cols'] = [{ wch: 18 }, { wch: 80 }, { wch: 22 }];
XLSX.utils.book_append_sheet(wb, ayuda, 'INSTRUCCIONES');
const destino = path.join(__dirname, '..', '..', 'docs', 'orlant', 'equidad', 'PLANTILLA_EQUIDAD_PROFESIONALES_PROPUESTA.xlsx');
require('fs').writeFileSync(destino, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }));
console.log('Plantilla generada:', path.relative(process.cwd(), destino), '·', filas().length, 'filas inventadas');
