# Preguntas para Edwin — Hospital La María y Clínica Aurora

Noviembre de 2026 (Fases 229 y 230). Hospital La María y Clínica Aurora ya
tienen las mismas pestañas que ORLANT: Tipificación, Llamadas y WhatsApp de
salida, Total tráfico y WhatsApp por rangos de tiempo. Por ahora usan **las
mismas reglas de ORLANT**, que son provisionales. Con estas respuestas se
dejan como deben quedar.

## Salida (llamadas y WhatsApp)

1. En el Wolkvox de Hospital La María y de Clínica Aurora, ¿la salida de
   llamadas se marca igual que en ORLANT (skill "-")? Si no, ¿cómo se marca?
2. ¿Hospital La María y Clínica Aurora reparten la salida en línea
   **General** y **3P**, como ORLANT? Si es así, ¿quién clasifica a los
   asesores? (Mientras nadie los clasifique, la salida sale como "Sin
   clasificar" y sí suma en el total).
3. ¿El WhatsApp de salida también es **SKILL_ID 0** en los dos?

## Cómo se mide

4. Hospital La María: ¿se mide por sede (Sede 33 / Castilla) o como un solo
   cliente? Si es por sede, ¿qué skills van a cada sede?
5. ¿Cuáles son los nombres exactos de las skills de llamadas de cada uno,
   como salen en Wolkvox? Hay que asignarlas antes de cargar.

## Qué hay que cargar

6. ¿Qué meses hay que cargar de cada uno?
   - CDR de llamadas (Tipificación),
   - CDR de WhatsApp (Tipificación),
   - tiempos de respuesta de WhatsApp por rango.

   (Hoy Hospital La María solo tiene el Flujo de agosto. Clínica Aurora
   tiene Tráfico de Llamadas y de WhatsApp).

## Lo demás

7. ¿Quién ve cada cliente? Hoy solo los ve el administrador (y Jairo).
   ¿Hay que crear usuarios para ellos?
8. Hospital La María: ¿se prenden Agendamiento, Inasistencia y Efectividad
   de Citas, como en ORLANT? ¿De dónde salen esos datos?
9. Calidad: ¿cuál es la plantilla de monitoreo de cada uno? Mientras no
   esté, la pestaña Calidad sigue oculta.
10. ¿Hay registros de prueba en sus CDR que haya que dejar por fuera? Si los
    hay, ¿cómo se reconocen?

---

Dónde está cada regla, para quien haga el cambio: la regla de salida está en
`SALIDA_POR_CLIENTE` (`server/tipificaciones.js`). Las migraciones son
`fase220_aurora_salida_v1`, `fase229_hlm_como_orlant_v1` y
`fase230_aurora_whatsapp_tiempos_v1` (`server/db.js`). Lo que sigue abierto
también está en `docs/pendientes.md`.
