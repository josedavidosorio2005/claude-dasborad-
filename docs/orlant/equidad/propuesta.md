# Equidad profesionales (ORLANT)

> Plan de acción ORLANT del 20/11/2026, punto **A6**. Entrega: **viernes 27/11/2026**.
> **24/11/2026, llamada con Edwin a las 3:30 p. m.:** Edwin hizo su propio diseño (HTML y 3 bases). Ese diseño
> **reemplaza** la propuesta anterior con el formato de Isa (que sigue en el historial de git de este archivo).
> Las bases reales y el HTML de Edwin (que trae las bases pegadas adentro) **no están en el repo**: viven fuera y
> solo se leyeron en local, estructura y conteos.

## 1. Qué es

Si las citas se reparten parejo entre los profesionales, en 3 bases, cada una con su pestaña:

- **Pólizas**;
- **Medicina prepagada**;
- **Particulares**.

La visual es la del HTML de Edwin, como con STA. No se edita a mano: la genera
`scripts/orlant/generar-equidad.js` (`public/js/orlant-equidad-app.js` y `public/css/orlant-equidad-app.css`).

## 2. Qué no cuadraba con la propuesta anterior (#937, formato de Isa)

| Tema | Propuesta anterior | Diseño de Edwin (lo que se hizo) |
|---|---|---|
| Visual | Colores de la plataforma | La de su HTML (tema oscuro), generada |
| Nombre y pestañas | «Equidad de agendamiento»: Prepagadas / Particulares / Póliza SURA | «Equidad profesionales»: Pólizas / Medicina prepagada / Particulares |
| Formato del Excel | 17 o 6 columnas | **5** (`CODIGO_SEDE, ESPNOM, MEDNOM, FECHA_CITA, NOMBRE_ENTIDAD`); Particulares, **4** (sin entidad). La tabla dinámica de Pólizas se ignora |
| Cálculos | Citas, médicos, promedio, sedes, citas por fecha | Índice de equidad (1 − Gini), sobreasignado / equitativo / baja asignación con **±20 %** del promedio, mapa de calor profesional × día, dona, tarjetas por sede y citas por entidad |
| Filtros | Sede, médico, fechas | Sede, especialidad, entidad (no en Particulares), **profesional** (pedido de Edwin), fechas y «Limpiar filtros» |
| Carga | Reemplaza los meses de cada grupo | **Cada base reemplaza toda su base** (como el HTML de Edwin) |
| Entidades | — | Lista **configurable** de qué entidades son pólizas y cuáles prepagadas (Isa se la pasa a Edwin) |
| Preguntas de Isa | 5 (margen), 9 (visual) y E (formato), abiertas | Respondidas por el diseño de Edwin |

## 3. Dónde está

- **Tablero de ORLANT**, pestaña **«Equidad profesionales»**, justo debajo de «Gestión STA».
  - Migración idempotente `faseEQ_orlant_equidad_tab_v1`.
  - El usuario autorizó la excepción del tablero congelado el 24/11/2026 (solo esta pestaña nueva).
  - Está oculta y se destapa en memoria cuando hay citas cargadas y quien mira tiene acceso.
- **Carga:** en «Cargar bases» (Centro de cargas) → ORLANT, la sección «Equidad profesionales».
  - Hay 3 tarjetas, una por base, cada una con «Subir base» / «Reemplazar base».
  - Debajo está la lista de entidades: pólizas y prepagadas, una por renglón.

## 4. Datos

- El Excel se lee en el navegador (`public/js/equidad-logic.js`, mismas columnas que el HTML de Edwin).
- Solo se guardan sede, especialidad, profesional, fecha de la cita y, en Pólizas y Medicina prepagada, la entidad.
- **Particulares nunca guarda la entidad**: si el archivo trae esa columna (ahí iría el paciente), se descarta en memoria.
- El servidor vuelve a revisar cada fila (`server/orlant-equidad.js`), y la carga es todo o nada.
- El Historial solo guarda la base y los conteos.
- La lista de entidades por ahora **solo avisa** al cargar cuando una base trae entidades de la otra lista. No mueve
  ni borra citas.

## 5. Quién la ve y quién carga

| Quién | Ve la pestaña | Carga |
|---|---|---|
| Administrador | Sí | Sí |
| Supervisor de ORLANT | Sí | Sí |
| Gerencia | Sí | No |
| Cuenta cliente ORLANT | **Solo si el administrador enciende la opción** «La cuenta cliente de ORLANT ve…» en «Cargar bases» (apagada por defecto; pregunta abierta a Edwin: ¿con el nombre de los profesionales?) | No |
| Asesor | No | No |

## 6. Verificación del 24/11 (local)

- Con las 3 bases reales de Edwin (solo conteos):
  - Pólizas: 403 citas y 15 profesionales; índice 44,7 %.
  - Medicina prepagada: 305 citas y 15 profesionales; 39,6 %.
  - Particulares: 256 citas y 12 profesionales; 53,7 %.
  - Son **las mismas cifras** que da su HTML con los datos que trae pegados.
  - 0 avisos; Particulares sin entidad.
- Con bases **inventadas**, cargadas por la interfaz en «Cargar bases»:
  - pestaña a 375, 768 y 1440 px, sin desborde ni errores de consola;
  - Particulares sin el filtro de entidad;
  - el filtro de profesional funciona.
- Pruebas: `server/tests/faseEQ2-equidad-profesionales.test.js`.

## 7. Pendiente

- La lista de entidades de Isa (pólizas / prepagadas): se carga desde la interfaz cuando llegue.
- ¿La ve la cuenta cliente de ORLANT, y con los nombres de los profesionales?
- Destapar en producción: la pestaña aparece sola cuando se cargue la primera base, y el administrador, el
  supervisor y gerencia la ven.
