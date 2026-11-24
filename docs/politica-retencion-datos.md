# Política de retención de datos — BORRADOR (B6)

> **Borrador del 24/11/2026 para revisar con Edwin y Jairo.** Todavía no se aplica.
> Hoy la plataforma **guarda todo** (pedido de Edwin: comparativos anuales desde 2022).
> No contiene datos reales; las cifras son de configuración o estimadas.

## 1. Qué se guarda hoy y por cuánto tiempo

| Qué | Ejemplos | Cuánto tiempo hoy | Propuesta |
|---|---|---|---|
| Datos de la operación (cargas mensuales y API de Wolkvox) | Flujo, tipificación, salida, encuestas, citas, efectividad | Sin límite | **Sin límite** en el agregado (es lo que alimenta los comparativos anuales). Revisar cada año. |
| Detalle por llamada o por persona | CDR, STA (unas 20.000 órdenes al mes), agendas, bases de Aurora/HLM | Sin límite | **24 meses**, después se borra el detalle y se conserva el total por mes (por decidir). |
| Versiones anteriores de una carga («Deshacer») | La versión que se reemplazó al recargar un mes | **30 días** (se borran solas) | Igual. |
| Calidad (monitoreos, encuestas calificadas) | Calificación, ítems, observaciones | Sin límite | **24 meses** con nombre del asesor; después, solo promedios. |
| Talento humano e Inventario | Empleados, ausentismos, equipos, actas firmadas | Sin límite | Mientras la persona trabaje + el tiempo que exija la ley laboral (lo define Gestión humana). |
| Tickets y adjuntos | Sugerencias, capturas | Sin límite | **12 meses** después de cerrado. |
| Historial de la plataforma (quién hizo qué) | Cargas, borrados, cambios de permisos | Sin límite | **24 meses** (auditoría). |
| Respaldos de la base | Copia diaria | 14 copias en el servidor; en S3 todas las versiones | 14 en el servidor; en S3, **90 días** de versiones anteriores. |
| Registros técnicos (logs) | Errores, arranques, respaldos | 30 días (app) y 90 días (respaldo) | Igual. |

Lo que **nunca** se guarda (ya es regla): teléfonos, comentarios y datos del cliente que trae la API de Wolkvox
(se descartan en memoria), contraseñas en claro, tokens.

## 2. Quién lo ve

- Cada cliente ve **solo su campaña** (y el cliente de ORLANT, sin Tickets).
- El asesor ve solo lo suyo (Portal Asesor, su malla, sus monitoreos).
- El supervisor ve las campañas que tiene asignadas.
- Administración e InConexión ven todo; las pestañas en prueba quedan ocultas para el cliente.
- Los respaldos y logs solo los ve el administrador de la infraestructura (AWS).

## 3. Cómo se borra

1. Nada se borra a mano en la base: **siempre** con un cambio revisado (PR) que haga primero
   un **inventario y un ensayo con cifras**, con respaldo de menos de 24 h y el **«OK borrar» por escrito**
   del responsable (regla vigente desde la Fase 134).
2. Lo que tenga plazo (punto 1) se borraría con una tarea automática mensual, que deja en el Historial
   cuántas filas borró por tabla y mes (sin datos).
3. Un cliente que se retira: se respalda, se le entrega su información si la pide, y se borra su campaña
   completa con el mismo procedimiento del paso 1.
4. Una persona que pide borrar sus datos (habeas data): se ubica por usuario y se borra o anonimiza su
   detalle; los totales por mes no cambian.

## 4. Preguntas para Edwin y Jairo

1. ¿24 meses de detalle alcanzan, si los comparativos anuales se hacen con totales por mes?
2. ¿El STA necesita el detalle de órdenes viejas, o basta el total por mes y especialidad?
3. ¿Qué plazo pide la ley o el contrato con cada cliente (ORLANT, MOBILIZE, SURA, Aurora, HLM)?
4. ¿Quién da el «OK borrar» por cliente: Jairo, Edwin o el cliente?
5. ¿Talento humano: cuánto tiempo después del retiro? (Gestión humana)
