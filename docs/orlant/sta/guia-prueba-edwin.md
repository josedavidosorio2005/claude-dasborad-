# Guion de prueba — «Gestión STA» de ORLANT (lunes, con Edwin)

Guion corto para revisar la herramienta en la plataforma, con tres sesiones: **supervisor**, **asesora** y
**cliente de ORLANT**. Lleva unos 30 minutos. Este documento no tiene datos reales: los números de
ejemplo son ficticios.

> **Ojo:** en producción la base STA ya está cargada (base real del 21/11). Todo lo que se haga
> (asignar, devolver, pasar, codificar) **cambia la base de verdad** y queda en el Historial. Para la
> prueba, usar **pocos casos** (por ejemplo, 5) y una asesora que sepa que es una prueba. Al final, los
> casos de prueba se devuelven a «disponibles» (paso S7).

## Antes de empezar

- Tres ventanas: supervisor (o administrador), una asesora de ORLANT y el usuario cliente de ORLANT. Una
  ventana de incógnito por usuario, para que no se mezclen las sesiones.
- Tener a mano la versión (menú de usuario → número de versión).

## Supervisor

| Paso | Qué hacer | Qué debe pasar |
|---|---|---|
| S1 | Inicio → tarjeta **Gestión STA** (después de Calidad). | Abre «Visual de supervisor» con 5 pestañas: Cargar base, Agentes y asignación, Gráficas, Gestionados, Tipificaciones. |
| S2 | **Cargar base**: revisar el histórico de cargas. | Aparece la carga del 21/11 con sus conteos (nuevos / ya existían / actualizados) y el botón **Descargar**. **No** eliminar la carga. |
| S3 | **Agentes y asignación** → elegir una asesora → filtro **Entidad**: «Quitar todo» y marcar una sola entidad; filtro **Servicio**: buscar y dejar uno. | «Disponibles con estos filtros» baja al número de casos de esa entidad y ese servicio. |
| S4 | Cantidad **5** → **Asignar**. | Aviso «5 casos asignados a …». Todos son de la entidad y el servicio elegidos. |
| S5 | Cantidad mayor que los disponibles (por ejemplo, 9999) → **Asignar**. | Antes de asignar avisa «Pediste … pero solo hay …». Al pulsar sale la ventana «No hay suficientes casos». Pulsar **No, cambiar filtros** (no asignar). Después, **Limpiar filtros**. |
| S6 | **Casos pendientes por agente** → abrir la asesora → marcar 2 casos → **Pasar a…** otra asesora → **Pasar**. | Pide confirmación «¿Pasar 2 casos de … a …?». Los 2 casos quedan en la otra asesora. |
| S7 | En cada asesora de la prueba: **Seleccionar todos** → **Devolver a disponibles**. | Pide confirmación. La asesora queda con 0 pendientes y los casos vuelven a «Órdenes libres». (Así se quitan los pendientes de una asesora.) |
| S8 | **Gráficas** y **Gestionados**. | Indicadores y gráficas; los filtros por agente, entidad y fechas cambian los números. |
| S9 | **Tipificaciones**: revisar la lista (no cambiarla sin acuerdo). | Las que dan cita aparecen como «efectiva». |

Antes de S7, volver a asignar **3 casos** a la asesora de la prueba para la parte de la asesora.

## Asesora

| Paso | Qué hacer | Qué debe pasar |
|---|---|---|
| A1 | Portal de la asesora → menú → **Gestión STA**. | Abre «Mis casos» solo con sus casos (los 3 asignados). No ve la carga, la asignación ni a otras asesoras. |
| A2 | **Buscar** en la bandeja: parte de la entidad o del número de autorización. | Muestra «N de M» y solo los casos que coinciden. |
| A3 | **Codificar** un caso como **Agendado** con 1 cita y una observación → **Guardar gestión**. | «Gestión registrada». El caso pasa a **Gestionados**. |
| A4 | **Codificar** otro como **Volver a llamar** con la hora en **2 minutos**. | «Te avisaré el … para volver a llamar». Aparece en **Volver a llamar**. |
| A5 | Antes de que pasen los 2 minutos, abrir **Codificar** en el tercer caso y dejar la ventana abierta. | Al llegar la hora **no interrumpe**: sale arriba el aviso discreto «Tienes una llamada por devolver. Te la muestro al terminar esta gestión». |
| A6 | **Cancelar** esa gestión. | En pocos segundos sale «📞 Debes volver a llamar» (con sonido). Probar **Recordar en 10 min** y, en otra prueba, **Gestionar ahora**. |
| A7 | **Gestionados** → buscar por número de autorización. | «1 resultado». Un número que no existe da «No encontré gestiones con ese número». Con más de 50 gestiones muestra «Últimas 50 de …». |

## Cliente de ORLANT

| Paso | Qué hacer | Qué debe pasar |
|---|---|---|
| C1 | Inicio → **Dashboard Clientes** → ORLANT. | No ve la tarjeta Gestión STA ni Tickets. |
| C2 | Pestaña **Gestión de la base STA**. | 7 indicadores (casos en la base, gestionados, agendas, citas, efectividad, pendientes en bandejas, sin asignar) y las gráficas (avance de la base, gestiones y citas por día, tipificaciones, estado, entidad, servicio). Sin números de autorización ni nombres de asesoras. |
| C3 | Botón de exportar. | Descarga las mismas tablas. |

## En las tres sesiones

- **Tema oscuro**: botón de la luna (arriba). La herramienta STA y las gráficas cambian a oscuro y se leen bien.
- **Celular / tableta**: achicar la ventana (o abrir en el celular). La página no se corre de lado; las
  tablas anchas se desplazan dentro de su recuadro.

## Si algo falla

Anotar el paso, la hora, el usuario y una captura **sin datos de pacientes** (o tapándolos), y avisar
por el canal de siempre. No reintentar en bucle una acción que dio error.
