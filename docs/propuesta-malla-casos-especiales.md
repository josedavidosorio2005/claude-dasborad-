# Malla de turnos: «Casos especiales». Propuesta y estimación

Pedido 6 de Edwin (reunión del 23/11/2026). **Solo propuesta, sin código.** Antes de empezar hay que
confirmar con Edwin cuáles de estos casos son los que quiere, porque en la reunión solo quedó el nombre
«Casos especiales».

## Lo que la malla ya resuelve (no hace falta construirlo)

| Situación | Cómo se hace hoy |
|---|---|
| Sábado con otro horario | Horario por día en cada grupo (Fase 358). |
| Una asesora entra a otra hora un día (cita médica, estudio) | «Horario especial» de esa asesora, por día, o descanso (Fase 373). |
| Avisarle algo a la asesora | «Novedades», que ella ve en «Mi malla» (Fase 373). |
| Incapacidad, vacaciones o permiso | Excepción por día o rango; no cuenta como tarde ni «Sin ingreso» (Fase 363). |
| Sale antes de tiempo | La puntualidad lo marca aparte (Fase 363). |

## Lo que la malla NO resuelve hoy (candidatos a «casos especiales»)

Están ordenados por lo que creo que más se usa en un call center. La estimación es en días de trabajo de
una fase normal (código, pruebas, revisión visual a 375/768/1440, PR y deploy).

### A. Más tipos de excepción (incluye que el supervisor los cree)
- **Qué es:** hoy solo hay 3 tipos fijos. Faltan: licencia (maternidad, paternidad, luto), calamidad,
  capacitación, compensatorio, suspensión y día de la familia. Propuesta: lista editable por ADMIN, como los
  tipos de ticket (Fase 364), y que cada tipo diga si cuenta como «día trabajado» en los resúmenes.
- **Riesgo:** bajo. Solo agrega una tabla de tipos; las excepciones guardadas no cambian.
- **Estimación: 0,5–1 día.**

### B. Festivos de Colombia
- **Qué es:** hoy un festivo se trata como un día normal: si el grupo tiene turno el lunes festivo, la
  asesora sale «Sin ingreso». Propuesta: calendario de festivos (ya calculado para el año, editable por
  ADMIN) y, por grupo, «el festivo descansa» o «el festivo trabaja con este horario».
- **Riesgo:** bajo-medio. Cambia el estado del día en la puntualidad (menos «Sin ingreso» falsos).
- **Estimación: 1–1,5 días.**

### C. Horario especial que se repite
- **Qué es:** hoy el horario especial es por semana. Una asesora que estudia y todos los martes entra a
  las 10:00 hay que cargarla semana por semana. Propuesta: «repetir hasta» (fecha) al guardar el horario
  especial; se crea en cada semana donde ella esté en un grupo.
- **Riesgo:** bajo. Reutiliza la tabla de la Fase 373.
- **Estimación: 1 día.**

### D. Cambio de turno entre dos asesoras
- **Qué es:** hoy hay que hacer 2 horarios especiales a mano. Propuesta: un botón «Cambiar turno» que elige
  2 asesoras y un día, intercambia sus horarios y deja una novedad para las dos y un registro en el
  Historial.
- **Riesgo:** bajo. Por debajo son los mismos horarios especiales.
- **Estimación: 1 día.**

### E. Turno partido (dos tramos en el día)
- **Qué es:** por ejemplo de 7:00 a 11:00 y de 14:00 a 18:00. Hoy solo se admite un tramo por día
  (decisión del 17/11). La puntualidad tendría que revisar la entrada de cada tramo (el 2.º login del día).
- **Riesgo:** medio. Cambia el formato del horario y la lógica de puntualidad, que ya está en uso.
- **Estimación: 2–3 días.**

### F. Turno nocturno (cruza la medianoche)
- **Qué es:** por ejemplo de 22:00 a 6:00. Hoy está prohibido a propósito (17/11), porque la puntualidad
  toma el día del login. Hay que decidir a qué día pertenece el turno y cómo se cuenta un login de las
  23:58.
- **Riesgo:** medio-alto. Toca la base del cálculo de puntualidad y la carga de «Horarios».
- **Estimación: 2–3 días.** Solo si alguna campaña tiene turnos nocturnos (hoy ninguna los tiene).

### G. Asesora en dos campañas
- **Qué es:** hoy cada asesora pertenece a una sola campaña (`asesorCampana`). Si alguien trabaja en
  MOBILIZE por la mañana y en SURA por la tarde, no se puede poner en las dos mallas.
- **Riesgo:** alto. El usuario de la asesora con una sola campaña se usa en toda la plataforma (Calidad,
  STA, «Mi malla», portal asesor).
- **Estimación: 4–6 días.** Recomiendo dejarlo afuera, salvo que sea un caso real hoy.

## Recomendación

1. **Confirmar con Edwin** cuáles son sus «casos especiales». Se le puede mostrar esta lista tal cual.
2. Si no hay más información, empezar por **A + B + C**: unos **3 días**, bajo riesgo y lo que más
   «Sin ingreso» falsos quita. Después **D** (1 día).
3. **E y F** solo si hay una campaña que los use hoy (preguntar cuál y desde cuándo).
4. **G** queda afuera salvo un caso real.

Cada uno va en su propia fase y PR, con su versión y su entrada en el CHANGELOG. Ninguno es destructivo:
solo agregan tablas o columnas, sin borrar ni cambiar lo ya guardado.
