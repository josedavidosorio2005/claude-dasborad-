# Nuevo dashboard de ORLANT — plan (propuesta de Teleacción, plan de acción 20/11, sección C)

Escrito el 21/11/2026. **Es solo diseño:** todavía no hay código ni cambios en producción.
La propuesta original vive fuera del repo; aquí se resume lo pedido en C1, C3–C6, E2 y E3.

> **Actualización (21/11/2026, usuario):** la API de ORLANT **funciona**:
> - operación `inconexion-orlant`, servidor `wv0034`, misma ruta `/api/v2/reports_manager.php`;
> - `skill_1` del 20/11 respondió 200 con 19 skills (prueba del usuario en Postman, desde su PC);
> - el token **no está en el repo**: el lunes 23/11 va a SSM como `/inconexion/prod/WOLKVOX_ORLANT_TOKEN`
>   (SecureString), junto con `/inconexion/prod/WOLKVOX_ORLANT_SERVIDOR` (`wv0034`).
>
> Falta comprobar que **el servidor de producción** llega a `wv0034` (ver §7): con MOBILIZE, Postman desde
> el PC funcionaba y el servidor no, hasta que Wolkvox autorizó su IP.

**Convenciones:**
- ✔ = sale de algo que ya tenemos probado con MOBILIZE.
- ◐ = el reporte existe, pero falta confirmarlo con el token de ORLANT.
- ✖ = hoy no se puede sacar.

## 1. Qué es

Un **tablero aparte** de ORLANT, distinto al actual: el de hoy (Tráfico de Llamadas, WhatsApp, Total
tráfico, Salida, Agendamiento, Efectividad de Citas, Calidad, STA) sigue igual mientras el nuevo se
valida.

La idea es que se llene **solo con la API de Wolkvox** (E3), igual que MOBILIZE. Lo que la API no trae
(agendas del aplicativo, back office) sigue por carga manual.

## 2. Estructura y pantallas (C1)

- **Menú vertical** (igual al de los dashboards de clientes de hoy) con 4 pestañas:
  - **Tráfico inbound**
  - **Tráfico outbound**
  - **Back office**
  - **Asesores**
- **Sub-pestañas por línea** en cada pestaña: **General**, **3P** y **Total**.
- **Vista gerencial:**
  - arriba, 4–5 tarjetas por pestaña (las que se usan para decidir);
  - un botón **«Ver más indicadores»** despliega el resto (tarjetas y gráficas de detalle);
  - el estado abierto o cerrado se recuerda por usuario en el navegador.
- **Barra de filtros fija:**
  - **Línea:** General / 3P / Total; reemplaza a las sub-pestañas en el celular.
  - **Fechas:** desde y hasta, con atajos (hoy, ayer, semana, mes, mes anterior).
  - **Granularidad:** día, semana, mes, y franja de 30 min donde exista.
- **Botones:**
  - **Excel:** mismo motor de exportación de hoy, una hoja por bloque.
  - **PDF:** reporte PDF actual, con las tarjetas gerenciales y las gráficas visibles.
  - **Pantalla completa:** ya existe en los dashboards.
- **Tema claro y oscuro, y AA:**
  - con los tokens de `docs/sistema-de-diseno.md`;
  - revisión a 375, 768 y 1440 px.
- **Quién lo ve:**
  - al principio, solo el administrador (pestañas ocultas, como Aurora y HLM);
  - después, el cliente ORLANT, con OK del usuario y de Edwin.

### Pantallas

| Pestaña | Tarjetas gerenciales | «Ver más indicadores» |
|---|---|---|
| Tráfico inbound · Llamadas | Recibidas, NS 20 s, Nivel de atención, % Abandono, TMO | ASA, participación por skill, tendencia por día/hora, comparativo vs. mes anterior, tipificación |
| Tráfico inbound · WhatsApp | Recibidos, atendidos, % atendidos en 0–3 min, % Abandono, TMO | 0–3 / 3–5 / >5 min, ASA, tendencia, por cola |
| Tráfico inbound · Citas | Citas asignadas, efectividad de agendamiento | Citas por canal (C5), por línea |
| Tráfico outbound | Realizadas, contactabilidad, intentos por registro, citas | Por día, por asesor, por tipificación |
| Back office | (según el archivo; ver «Back office» en §3) | — |
| Asesores | Ocupación, horas logueadas, TMO | Talk / Hold / ACW, intervalos de 30 min, por asesor |

## 3. De dónde sale cada indicador

Reportes según `docs/plan-api-wolkvox.md` §10.

### C3 — Inbound llamadas

| Indicador | Fuente | Estado |
|---|---|---|
| Recibidas, contestadas, abandonadas | `skill_1` (un día por consulta) o `skill_7` (mes por hora) | ✔ igual que MOBILIZE |
| Nivel de servicio a 20 s | `skill_1`/`skill_7` `service_level_20sec` | ✔ |
| Nivel de atención | contestadas ÷ recibidas (`skill_1`) | ✔ |
| % Abandono | `skill_1` `abandon` | ✔ |
| TMO (AHT) | `skill_7` `aht` (o `skill_3` por día) | ✔ |
| ASA | `skill_1` `asa` | ✔ (MOBILIZE lo trae; hoy no se muestra) |
| Participación por skill | `skill_1` por `skill_name` | ✔, falta el mapa skill → línea |
| Tendencia y comparativo | lo guardado por día (`calidad_nivel_servicio_diario`) | ✔ cálculo en pantalla |
| Tipificación | `cdr_1` `cod_act` (sin teléfonos: se descartan en memoria) | ✔ igual que MOBILIZE |
| Abandonadas por tiempo de espera (extra) | `skill_9` | ◐ (solo conteo por skill) |

### C4 — WhatsApp

| Indicador | Fuente | Estado |
|---|---|---|
| Recibidos, atendidos, abandonados | `chat_1` / `chat_13` | ✖ **hoy la API los rechaza** («Validate dates entered», probado con MOBILIZE). Mientras tanto, la carga manual actual (Tráfico de WhatsApp + `whatsapp_tiempos`, Fase 142). |
| Atendidos en 0–3 / 3–5 / >5 min | `chat_1` `first_response_time`, o manual `whatsapp_tiempos` (ya calcula rangos de minutos) | ◐ por API; ✔ por archivo |
| TMO | `chat_1` `chat_duration` / `time_on_agent` | ◐ |
| ASA | `chat_1` `first_response_time` (promedio) | ◐ |

`chat_1` trae nombre, correo y teléfono del cliente: se descartan en memoria, igual que en `cdr_1`.
La «meta de WhatsApp» (¿3 min?) hay que pedirla (§5).

### C5 — Citas por canal

| Indicador | Fuente | Estado |
|---|---|---|
| Citas asignadas (General / 3P) | carga manual de Agendamiento (`agendas`, base del aplicativo) | ✔ (B1, PR #902) |
| Citas **por canal** (llamada / WhatsApp / salida) | — | ✖ la base de agendas no trae el canal |

Opciones para C5:
- que el aplicativo agregue el canal;
- o cruzar la tipificación de «cita asignada» de `cdr_1` (llamadas) y de `chat_1` (WhatsApp) por día y
  asesor. Es una aproximación y hay que acordarla con Edwin.

### C6 — Salida

| Indicador | Fuente | Estado |
|---|---|---|
| Llamadas realizadas | `cdr_1` (`type_interaction` de salida), conectadas + `cdr_5` no conectadas | ✔ (A13–A16 en MOBILIZE: conectadas = real) |
| Contactabilidad | conectadas ÷ realizadas | ✔ con `cdr_1` + `cdr_5` |
| Intentos por registro | realizadas ÷ registros distintos (`customer_id` o teléfono **hasheado en memoria**) | ◐: hay que decidir si se permite el hash (§6). Sin el hash: ✖ |
| Citas de salida | tipificación de salida «cita» en `cdr_1` | ◐ (depende de los códigos de ORLANT) |
| WhatsApp de salida | — | ✖ por API (mismo problema de `chat_1`); manual como hoy (`salida_mensual`) |

### E2 — Asesores

| Indicador | Fuente | Estado |
|---|---|---|
| Ocupación | `agent_1` `occupancy` | ◐ columnas confirmadas con MOBILIZE (18/11); no se guarda todavía |
| Horas logueadas | `agent_1` `login_time` / `agent_7` (sesiones) | ✔ `agent_7` ya se guarda (malla) |
| Talk / Hold / ACW | `agent_1` `inbound_time`, `outbound_time`, `acw_time` | ◐ **Hold no aparece** en las columnas de `agent_1`: ✖ hasta encontrar el reporte que lo trae |
| Intervalos de 30 min | `agent_5` / `agent_8` son **por hora** | ✖ a 30 min (la API da hora); ✔ por hora. Las llamadas por 30 min sí salen de `cdr_1` (hora exacta) |

### Back office

No hay ningún reporte de Wolkvox para esto. **Hace falta saber qué es**: ¿gestiones fuera de línea,
STA, correos? Si es la gestión STA, ya está en la plataforma (`Gestión STA`) y la pestaña lo reusa. Si
es otra cosa, va por carga manual.

### No se puede sacar hoy

- WhatsApp por API (`chat_1`/`chat_13` rechazan las fechas). Se queda la carga manual.
- Citas por canal: la base de agendas no lo trae.
- Hold de los asesores.
- Intervalos de 30 min de estados del asesor: la API los da por hora.
- Línea (General / 3P) de la entrada sin el mapa de skills.
- Back office sin definición.

## 4. Cómo reusar el motor de MOBILIZE (E3)

Hoy el motor (`server/wolkvox.js`, `wolkvox-auto.js`, `wolkvox-modulos.js`, `wolkvox-destinos.js`)
está **cerrado a MOBILIZE a propósito**:
- `OPERACION_DE_CAMPANA` solo tiene la réplica;
- `OPERACION = 'MOBILIZE'` está fijo en los módulos;
- la lista de destinos es cerrada.

El plan:

1. **Generalizar sin cambiar el comportamiento:**
   - la operación sale del destino y no de una constante;
   - un token por operación (`WOLKVOX_ORLANT_TOKEN` / `_SERVIDOR` en SSM; la lectura ya es por operación);
   - tope de consultas **por token** (3.000 por día por licencia; dejamos el mismo margen de 2.800);
   - pruebas que demuestren que MOBILIZE sigue igual.
2. **Réplica primero:** crear «ORLANT PRUEBAS API», oculta y solo para el administrador, como la de
   MOBILIZE, con su interruptor `WOLKVOX_ORLANT_AUTO_ACTIVO` apagado.
   - Encender módulo por módulo: Flujo → Flujo por hora → cdr_1 → no conectadas → agentes.
   - Comparar contra la carga manual de ORLANT día por día (como se hizo con MOBILIZE, `docs/plan-api-wolkvox.md` §10) hasta que
     cuadre.
3. **Mapa de skills → línea:** cada skill de ORLANT se marca General o 3P (tabla propia o en
   `skillsMapeadas`). Sin ese mapa no hay sub-pestañas por línea.
4. **Luego el real:** pasar a la campaña ORLANT real desde un mes de corte, con:
   - respaldo antes de reemplazar;
   - todo o nada por mes;
   - sin reintentos;
   - los meses anteriores al corte, intactos.

   Igual que la excepción A24 de MOBILIZE. Necesita autorización escrita nueva en `CLAUDE.md`.
5. **Datos sensibles:** `cdr_1` y `chat_1` descartan teléfono, nombre, correo y comentarios en memoria
   antes de guardar. Nada crudo en logs.

## 5. Qué falta pedir

- ~~Token de ORLANT~~ **Listo (21/11):** la operación `inconexion-orlant` en `wv0034` responde. El usuario
  lo carga en SSM el lunes 23/11. La IP 3.85.54.96 ya quedó como permanente en el firewall del Manager de
  `wv0034` (21/11); falta comprobarlo desde el servidor (§7).
- **OK de Jairo** para consultar la operación de ORLANT, y del usuario para cada interruptor.
- **Skills de 3P:** lista de skills (y colas de WhatsApp) que son 3P y las que son General.
- **Meta de WhatsApp:** ¿«atendido a tiempo» es 0–3 min? ¿Qué % se espera? ¿Hay meta de abandono?
- **Metas de llamadas:** NS 20 s (¿80/20?), abandono, TMO y ocupación, para los semáforos.
- **Back office:** qué es, qué archivo lo trae y quién lo carga.
- **Citas por canal:** si el aplicativo puede agregar el canal, o si vale la aproximación por tipificación.
- **Intentos por registro:** si se permite identificar el registro con un hash del teléfono, calculado en
  memoria y sin guardar el número.
- **Tipificaciones de ORLANT:** códigos que significan «cita asignada» en entrada y en salida.
- **WhatsApp por API:** pedir a Wolkvox el formato de fechas de `chat_1`/`chat_13`, o confirmar que no
  hay API de chats para la licencia.
- **Hold:** en qué reporte de Wolkvox viene.

## 6. Fases y horas (estimado)

| Fase | Qué | Horas | Depende de |
|---|---|---|---|
| N1 | Tablero aparte: estructura, menú, sub-pestañas de línea, filtros (línea, fechas, granularidad), «Ver más», Excel/PDF/pantalla completa, con los datos manuales que ya hay. Oculto, solo admin | 16–20 | **empezada el 21/11** (rama `faseN1-orlant-tablero-nuevo`, PR sin mergear) |
| N2 | Inbound llamadas (C3) con los datos manuales de hoy + ASA y participación por skill. **24/11: hecho en el PR de N2** (fuentes confirmadas por Edwin: flujo de llamadas y CDR; primera gráfica, TMO, ASA, variación, tipificación). General/3P queda «Pendiente de Edwin» (mapa de skills) | 8–10 | mapa de skills para la línea |
| N3 | WhatsApp (C4) con la carga manual (`whatsapp_tiempos`: 0–3 / 3–5 / >5, TMO, ASA) | 6–8 | meta de WhatsApp |
| N4 | Citas (C5): General/3P ya; por canal según lo que decida Edwin | 4–10 | definición del canal |
| N5 | Motor Wolkvox generalizado por operación (sin cambiar MOBILIZE) + réplica «ORLANT PRUEBAS API» + «Diagnóstico de red» para `wv0034` | 12–16 | token en SSM (lunes 23/11) + OK de Jairo (IP ya autorizada el 21/11, §7) |
| N6 | Réplica ORLANT: Flujo, Flujo por hora, cdr_1, no conectadas; comparación día por día contra lo manual | 10–14 | N5 |
| N7 | Salida (C6): realizadas, contactabilidad, intentos, citas | 8–10 | N6 + decisión del hash |
| N8 | Asesores (E2): guardar `agent_1`/`agent_5` (ocupación, horas, Talk/ACW, por hora) | 10–12 | N6 |
| N9 | Pasar al ORLANT real desde el mes de corte (autorización escrita, respaldo, todo o nada) | 4–6 | N6–N8 cuadrando + OK |
| N10 | Back office | 4–12 | definición |
| — | Revisión visual, AA, pruebas, documentación y bitácora (repartido en cada fase) | incluido | — |

**Total aproximado:** 82–118 horas.

Lo que se puede empezar ya, sin esperar a nadie, es **N1** (con los datos manuales).
**N5** en adelante espera el token en SSM (lunes 23/11) y el OK de Jairo; la IP ya quedó autorizada en `wv0034` (21/11, §7).

## 7. IP del servidor y firewall de Wolkvox (cómo se resolvió con MOBILIZE y qué hacer con ORLANT)

### Qué pasó con MOBILIZE

Fuentes: Fases W2, W3, A1 y A2 de `docs/historico/progress-fases.md`, `docs/plan-api-wolkvox.md` §3 y
§10, y `docs/pendientes.md`.

1. **17/11:** los parámetros SSM de MOBILIZE ya existían, pero «Probar conexión» desde producción fallaba
   a los ~10 s («No se pudo conectar»). No era un rechazo del token: eso daría 401 o 403.
2. **El token no tenía lista de IP:** el usuario lo confirmó en Wolkvox Manager. Por eso **no se registró
   ninguna IP en el Manager**; no hacía falta, porque el token no filtraba por IP.
3. **«Diagnóstico de red» (Fase W3, sin token y sin gastar consultas):**
   - el DNS de `wv0072.wolkvox.com` resolvía bien;
   - **la conexión TCP al 443 no respondía** desde el servidor;
   - la salida a internet del servidor funcionaba;
   - desde el PC del usuario, el mismo nombre conectaba en 77 ms.
4. **Causa:** un bloqueo de red **del lado de Wolkvox** (su firewall) hacia la IP de salida del servidor.
5. **Solución:** el 17/11 el usuario escribió al **soporte de Wolkvox** con la IP, el puerto 443, las horas
   de las pruebas y el síntoma, y pidió autorizar la IP. **El 18/11 Wolkvox la agregó a su firewall**: el
   diagnóstico salió en Sí (DNS, TCP y TLS por IPv4) y desde ahí la API responde (Fase A2).

   Lo hizo Wolkvox en su infraestructura, no nosotros en el Manager. El repo no dice qué pantalla usaron.

**IP de salida del servidor de producción (Lightsail):** **3.85.54.96**. Es la IP estática de la
instancia (el usuario lo confirmó en Lightsail el 17/11) y es a la que resuelve `sinco.inconexion.com.co`.
La 100.51.93.1 de bitácoras viejas era de la cuenta anterior, ya retirada. La IP no cambia mientras la IP
estática siga pegada a la instancia.

### Qué hacer con ORLANT (`inconexion-orlant`, `wv0034`)

> **Hecho (usuario, 21/11/2026):** la IP **3.85.54.96** quedó agregada **como permanente** en el
> firewall del Manager de `wv0034`. Los pasos 1 y 2 de abajo ya no hacen falta, salvo que la comprobación
> (diagnóstico de red) salga mal. Sigue pendiente cargar el token en SSM (paso 3) y comprobarlo después de N5.

`wv0034` es **otro servidor de Wolkvox** (MOBILIZE está en `wv0072`). No sabemos si el firewall que
autorizó 3.85.54.96 es común a todos los servidores o va por servidor. Hay que suponer que no y
comprobarlo.

Pasos (los del Manager son los mismos que hizo el usuario con MOBILIZE; el repo no guarda los nombres
exactos de los menús del Manager, así que se describen por lo que hay que mirar):

1. **Revisar el token de ORLANT en Wolkvox Manager** (operación `inconexion-orlant`):
   - entrar con el usuario administrador de la operación;
   - abrir la pantalla donde se creó el token de la API;
   - mirar si tiene un campo de **IP permitidas / lista blanca**;
   - si está vacío (como el de MOBILIZE), no se toca nada;
   - si tiene IPs, agregar **3.85.54.96** y guardar.
2. **Escribir al soporte de Wolkvox**, con el mismo mensaje del 17/11:
   - «Pedimos autorizar la IP **3.85.54.96** (servidor de InConexión en AWS) para consultar la API
     `https://wv0034.wolkvox.com/api/v2/reports_manager.php` (puerto 443, HTTPS) de la operación
     `inconexion-orlant`, igual que ya está autorizada para `wv0072` (operación de MOBILIZE).»
   - Nunca mandar el token por correo ni por chat.
3. **Cargar en SSM** (lunes 23/11, consola de AWS, región de siempre):
   - Systems Manager → Parameter Store → *Create parameter*;
   - `/inconexion/prod/WOLKVOX_ORLANT_TOKEN`, tipo **SecureString**, valor = el token;
   - `/inconexion/prod/WOLKVOX_ORLANT_SERVIDOR`, tipo String, valor = `wv0034`;
   - el proceso los lee al arrancar: hace falta un deploy (o relanzar el último) después de crearlos;
   - `server/secrets.js` ya copia todo lo que empieza por `WOLKVOX_`.
4. **Nada más en AWS:** no hay que abrir puertos ni cambiar el Lightsail. La salida a internet ya funciona;
   lo único que filtra es Wolkvox.

### Cómo comprobarlo después (máximo 1 consulta)

Hoy el «Diagnóstico de red» y «Probar» solo funcionan con la réplica de MOBILIZE: el motor está cerrado a
esa operación (`OPERACION_DE_CAMPANA`). Para ORLANT hace falta **N5** (operación por destino y réplica
«ORLANT PRUEBAS API»). Después:

1. **«Diagnóstico de red» en «ORLANT PRUEBAS API» (0 consultas):** no manda token ni petición HTTP; solo
   DNS, TCP 443 y TLS hacia `wv0034.wolkvox.com`.
   - Debe salir **Sí** en DNS, TCP y TLS por IPv4.
   - Si TCP sale «sin respuesta en 5 s», la IP no está autorizada: volver al paso 2 y **no** gastar consultas.
2. **Solo si el diagnóstico sale en Sí, una sola «Probar» (1 consulta):** `skill_1` de un día ya cerrado
   (por ejemplo, el 20/11, el mismo que dio 200 en Postman).
   - Debe dar 200 con las mismas 19 skills.
   - Un 401 o 403 es el token; un 404 «sin registros» es el día.
   - Queda en el Historial (`WOLKVOX_PRUEBA`) y suma 1 al uso del día.
3. Anotar el resultado en la bitácora. Antes de encender cualquier módulo de ORLANT, OK del usuario.

