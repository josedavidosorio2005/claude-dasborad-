# ORLANT — mapa de skills a línea (propuesta para confirmar con Edwin)

Escrito el 23/11/2026 para la Fase N6 (`plan.md` §4, paso 3). **Es una propuesta:** nada de esto está en
el código ni en producción. Sin este mapa no hay sub-pestañas General / 3P en la entrada del tablero
nuevo.

## De dónde salen los nombres

- La única consulta autorizada (23/11, «Probar» `skill_1` del 20/11 en «ORLANT PRUEBAS API») confirmó
  **19 skills**.
- Por diseño, «Probar» muestra los nombres solo en la ventana: **no los guarda ni los escribe en el
  Historial**. La sesión de esa prueba ya se cerró.
- Para no gastar otra consulta, la tabla de abajo usa **solo los nombres que ya están documentados** en
  el repo y en la bitácora (cargas manuales de Tráfico de Llamadas de ORLANT, Fases 39, 115 y 208).
- Los demás quedan como filas por completar. Sus nombres salen de la respuesta de Postman del 20/11 (la
  misma prueba que dio 19 skills) o de la columna `SKILL_NAME` del próximo Flujo de ORLANT.

## Regla que la plataforma ya usa

`server/resumen-orlant-trafico.js` (`lineaDeNombre`) asigna la línea por el **final del nombre**:

- termina en « 3P» → 3P;
- termina en « GENERAL» → General;
- cualquier otro → no cuenta en ninguna de las dos.

La propuesta parte de esa regla. Lo que no calza queda en **«no sé»**: lo decide Edwin, no el nombre.

## Tabla para confirmar

| # | Skill (nombre en Wolkvox) | Línea propuesta | Por qué | Edwin confirma |
|---|---|---|---|---|
| 1 | CALL INBOUND ORLANT 3P | **3P** | Termina en «3P»; ya se usa así en el resumen de ORLANT | ☐ |
| 2 | CALL INBOUND ORLANT GENERAL | **General** | Termina en «GENERAL»; ya se usa así | ☐ |
| 3 | Régimen Especiales (nombre exacto por confirmar) | **no sé** | Entra en las 3 «de siempre» de la entrada (Fase 208), pero el nombre no dice la línea. ¿General? | ☐ |
| 4 | Confirmaciones | **no sé** | Llegó con el Flujo de octubre (Fase 208). Antes que la línea, hay que saber si cuenta como llamada ingresada (`docs/pendientes.md`) | ☐ |
| 5 | Cancelaciones y Reprogramación | **no sé** | Mismo caso que Confirmaciones | ☐ |
| 6 | Atención Tutelas | **no sé** | Mismo caso; volumen bajo (13 en septiembre) | ☐ |
| 7 | _(por completar)_ | | | ☐ |
| 8 | _(por completar)_ | | | ☐ |
| 9 | _(por completar)_ | | | ☐ |
| 10 | _(por completar)_ | | | ☐ |
| 11 | _(por completar)_ | | | ☐ |
| 12 | _(por completar)_ | | | ☐ |
| 13 | _(por completar)_ | | | ☐ |
| 14 | _(por completar)_ | | | ☐ |
| 15 | _(por completar)_ | | | ☐ |
| 16 | _(por completar)_ | | | ☐ |
| 17 | _(por completar)_ | | | ☐ |
| 18 | _(por completar)_ | | | ☐ |
| 19 | _(por completar)_ | | | ☐ |

Para cada skill nuevo (7 a 19), la propuesta se arma con la misma regla:
- si el nombre termina en «3P» o «GENERAL», esa línea;
- si es de salida, de pruebas o de otra operación, **«no cuenta»** (no es entrada de ORLANT);
- si no, **«no sé»**.

`skill_1` trae todos los skills de la operación, por eso pueden aparecer skills de salida o de pruebas.

## Preguntas para Edwin

1. ¿Las skills 3 a 6 son de la Línea General, de 3P o de las dos? Si son de las dos, no se pueden partir
   por nombre: hace falta otra fuente, como la entidad de la cita.
2. ¿Confirmaciones, Cancelaciones y Reprogramación y Atención Tutelas cuentan como llamadas ingresadas?
   La pregunta sigue abierta desde la Fase 208.
3. De los 19 skills, ¿cuáles son de salida o de pruebas y no deben contar en la entrada?
4. WhatsApp (aparte; la API de chats todavía no funciona):
   - Las colas «WHATSAPP ORLANT 3P» y «WHATSAPP ORLANT GENERAL» siguen la misma regla.
   - ¿Audífonos, Foniatría y Fonoaudiología van en General? Es una pregunta pendiente desde la Fase 71.

## Cómo se usará (N6, después de la confirmación)

- El mapa queda en la plataforma, no en Wolkvox: es configuración de ORLANT, editable por el
  administrador, con Historial. Nunca se infiere en silencio un skill nuevo: si aparece uno que no está
  en el mapa, va a «Sin línea» y se avisa.
- La réplica «ORLANT PRUEBAS API» lo usa primero, para comparar día por día con la carga manual. El
  ORLANT real lo usa solo después, con su propia autorización (N9).

## Propuesta de autorización escrita para la N6 (para `CLAUDE.md`, pendiente del OK del usuario)

> - **Excepción escrita (usuario, __/__/2026, réplica de ORLANT con la API, Fase N6):** la consulta
>   automática del servidor puede pedir a Wolkvox, de la operación `inconexion-orlant` (`wv0034`), y
>   GUARDAR, **solo en la réplica oculta «ORLANT PRUEBAS API»**:
>   - Flujo (`skill_1`, un día por consulta);
>   - Flujo por hora (`skill_7`);
>   - Tipificación (`cdr_1`): teléfonos, datos del cliente y comentarios se descartan en memoria antes
>     de guardar;
>   - No conectadas (`cdr_5`).
>
>   Reglas:
>   - Mismos horarios que la réplica de MOBILIZE (00:05, 7:00 y 13:00, hora de Colombia).
>   - Reemplaza el mes completo: respaldo antes, todo o nada por mes, sin reintentos en bucle.
>   - Tope de 2.800 consultas al día **por el token de ORLANT**, aparte del de MOBILIZE.
>   - «Ejecutar ahora» también vale en esa réplica, para un mes ya cerrado de los últimos 12, y solo
>     para meses que Wolkvox acepte.
>   - Arranca **APAGADA**: solo corre con `WOLKVOX_ORLANT_AUTO_ACTIVO=1` en SSM (se lee antes de cada
>     corrida; borrarlo o ponerle `0` la apaga sin redesplegar). Cada módulo se enciende aparte, en
>     `WOLKVOX_ORLANT_AUTO_MODULOS`. Crear esos parámetros necesita OK explícito del usuario.
>   - Nunca escribe en el **ORLANT real** ni en otro cliente, y no toca Calidad, Agendamiento, STA ni
>     WhatsApp.
>   - El mapa de skills a línea se guarda en la plataforma (configuración), no se pide a Wolkvox.
>   - Pasar al ORLANT real (N9), WhatsApp por API o asesores (`agent_*`) = autorización nueva por escrito.
