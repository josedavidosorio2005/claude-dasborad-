# Revisión de Clínica Aurora y Hospital La María — 09/11/2026

Revisión antes de la reunión con los clientes de Aurora y HLM (martes 10/11).
Sin nombres reales, sin valores de pacientes ni de asesores: solo estructura,
conteos y tiempos.

## Cómo se revisó

- **Producción, solo lectura** (`https://sinco.inconexion.com.co`, v1.144.8
  al revisar): Playwright con Brave visible, sesión iniciada a mano por el
  usuario (el script no ve ni guarda la contraseña ni la sesión), toda
  petición que no fuera GET quedó bloqueada. Perfil revisado: **SUPERVISOR
  (id 56, ve Aurora y HLM)**, 1440 px. Cada pestaña y sub-pestaña: errores de
  consola, respuestas HTTP ≥ 400, peticiones > 3 s, textos `NaN`/`undefined`/
  `null`/`Infinity`, textos en inglés, skills sin nombre, logos e imágenes
  rotas, filtro de meses.
- **Local** (copia de la base demo, datos sintéticos): perfiles **CLIENTE**
  (CLIENTES_DASH con Aurora y HLM) y **SUPERVISOR** (perfil nuevo,
  `supervisa_`), 375, 768 y 1440 px, antes y después de cada arreglo.
- El perfil **CLIENTE en producción** quedó pendiente: en la ventana del
  cliente se volvió a iniciar con la cuenta del supervisor (ver
  «Pendiente»).

## Resultado en producción (SUPERVISOR #56)

| | Aurora | HLM |
|---|---|---|
| Pestañas visibles | Tráfico de Llamadas · Tráfico de WhatsApp · Llamadas y WhatsApp de salida · Total tráfico · Agendas por usuaria (3 vistas) · Errores · Tipificación | Tráfico de Llamadas · Tráfico de WhatsApp · Total tráfico |
| Errores de consola / HTTP ≥ 400 | 0 / 0 | 0 / 0 |
| Abrir el tablero | 1,5–1,6 s | 1,4 s |
| Cambiar de pestaña | 0,65–0,80 s | 0,75–0,80 s |
| Peticiones > 3 s | 0 | 0 |
| `NaN` / `undefined` / inglés | 0 | 0 |
| Meses en el filtro | 4 | 1 (agosto) |
| Logo | sí | no (pendiente de Edwin) |

## Hallazgos

| Cliente | Pestaña | Perfil | Problema | Severidad | Arreglado |
|---|---|---|---|---|---|
| Aurora y HLM | Tráfico de Llamadas, Tráfico de WhatsApp, Tipificación, Llamadas y WhatsApp de salida, Total tráfico, tiempos de WhatsApp (también Agendas, Inasistencia, Efectividad de citas y el aviso general del tablero) | CLIENTE | Sin datos, el cliente veía la instrucción interna «Un usuario con permiso de administrador debe subir … desde Cargar Datos» (y «todavia» sin tilde) | Media | **Sí** — «Información pendiente» (#722, v1.145.0). Quien carga datos sigue viendo la instrucción |
| HLM | Tráfico de Llamadas, Tráfico de WhatsApp | CLIENTE y SUPERVISOR | Solo agosto cargado; septiembre y octubre no aparecían y nada lo decía | Media | **Sí** — línea «Información pendiente: el tráfico de … de septiembre y octubre de 2026 todavía no se ha cargado» (#722). Los datos los debe enviar Edwin |
| Aurora | Tipificación (filtro Skill/Cola) | CLIENTE y SUPERVISOR | «Skill 4166» y «Skill 4169» sin nombre | Baja | **Sí** el texto — «Skill 4166 (nombre pendiente)» (#724, v1.146.1). El nombre real lo debe confirmar Edwin |
| HLM | Encabezado | CLIENTE y SUPERVISOR | Sin logo (no hay imagen rota: solo el nombre) | Baja | No — falta el archivo del logo (Edwin) |
| HLM | Tipificación, salida, tiempos de WhatsApp | CLIENTE y SUPERVISOR | Ocultas: falta el CDR (HistCDR/HistChat) y los tiempos de Wolkvox | — | No aplica — cuando se carguen y se enciendan, ya muestran «Información pendiente» en vez de una pantalla vacía |
| Aurora | Errores | SUPERVISOR | Vacía («Todavía no hay errores registrados. Usa «Agregar errores»…») | Info | No hace falta — mensaje correcto |
| Aurora | Agendas por usuaria | SUPERVISOR | El detector marcó «100 %» (fila Total) | — | Falso positivo |
| Aurora y HLM | Todas | CLIENTE | No verificado en producción con la cuenta real del cliente | — | Pendiente (ver abajo) |

## Pedido aparte del supervisor (mismo día)

Fase 297 (#723, v1.146.0), Aurora y HLM: Total tráfico en 3 líneas de ingreso,
salida en líneas con la variación mes a mes y el orden de pestañas Total tráfico →
Tráfico de Llamadas → Tráfico de WhatsApp → Llamadas y WhatsApp de salida →
Agendas por usuaria → Errores → Tipificación. Ver `CHANGELOG.md`.

## Verificación después del deploy (v1.146.1, SUPERVISOR #56, 1440 px)

- Aurora: pestañas en el orden nuevo; Total tráfico con las 3 líneas y su título; Llamadas y
  WhatsApp de salida en línea con ▲/▼ y la nota; Tipificación con «Skill 4166 (nombre
  pendiente)».
- HLM: Total tráfico → Tráfico de Llamadas → Tráfico de WhatsApp; en Tráfico de Llamadas, la
  línea «Información pendiente» de septiembre y octubre de 2026.
- 0 errores de la app en consola, 0 HTTP ≥ 400 de la app, 0 peticiones > 3 s; abrir 1,3–1,5 s.
- La tarjeta «Total ingresados» de Total tráfico sigue sumando la salida (cálculo de siempre);
  la línea «Total» de la gráfica es solo el ingreso (llamadas + WhatsApp), como pidió el
  supervisor.

## Pendiente

- **Verificar con la cuenta del cliente** (CLIENTES_DASH con Aurora/HLM) en
  producción: que vea «Información pendiente» y las mismas pestañas.
- **Edwin**: tráfico de HLM de septiembre y octubre, CDR HistCDR/HistChat de
  HLM, tiempos de Wolkvox, logo de HLM (y de SURA), nombres de los skills
  4166 y 4169 de Aurora.
- **Decisión**: qué pestañas de HLM se encienden para el cliente (la revisión del 07/11, #1, anotó que el
  cliente de HLM solo veía Total tráfico; confirmarlo con la cuenta del cliente).
