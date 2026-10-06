# Checklist de verificación — para Edwin (aceptación manual)

> Documento de aceptación manual: marca cada casilla después de revisarla
> tú mismo en la plataforma real, no es algo que se marque solo. En
> español simple, sin nada técnico. Si algo no coincide con lo que
> esperabas, avisa antes de seguir usando esa parte.

Plataforma: **https://informa.inconexion.com.co** — versión **1.14.0**.

> Desde la Fase 126, la plataforma solo tiene datos oficiales de
> **agosto y septiembre 2026** (más el cruce de julio de Tipificación de
> WhatsApp, real). Los meses de prueba que venían en las plantillas
> (Enero-Julio 2026 y Abril 2025, según la base) ya se borraron.

## 1. Entrar y ver el dashboard

- [ ] Puedo entrar con mi usuario y contraseña.
- [ ] Al entrar veo el dashboard de **ORLANT** con las **8 pestañas**:
      Tráfico de Llamadas, Tráfico de WhatsApp, Agendamiento, Inasistencia,
      Efectividad de Citas, Tipificación, Salida, Calidad.
- [ ] El botón de **pantalla completa** agranda el dashboard y lo
      achica de vuelta.
- [ ] Puedo cambiar entre **tema claro y oscuro**.

## 2. Los números coinciden

Compara estos números contra lo que ves en pantalla (`PROGRESS.md` del
repositorio tiene siempre la versión más reciente de esta tabla):

| Indicador | Valor esperado |
|---|---|
| Tipificación de Llamadas (Ago-26 + Sep-26) | 14.940 + 19.721 = 34.661 |
| Tipificación de WhatsApp (Jul-26 + Ago-26 + Sep-26) | 71 + 12.061 + 13.048 = 25.180 |
| Tráfico de Llamadas | Ago 8.908/7.961/947 · Sep 9.043/8.883/160 |
| Tráfico de WhatsApp | Ago 7.390/7.370/20, SL20 36,05 % · Sep 7.968/7.953/15, SL20 39,88 % |
| Agendas (ago-sep/2026, único período — Abril 2025 ya se borró) | 24.186 (Ago 11.040 / Sep 13.146) |
| Inasistencia | Ago-26 7,45 %, período (ago-sep) 7,34 % |
| Efectividad de agendamiento | Ago 41,17 % (11.040 / 26.814) · Sep 40,00 % (13.146 / 32.868) |
| Efectividad de Citas (ago-sep/2026, único período — Ene-Mar ya se borró) | Ago 11.189 agendas / 7.896 atendidas · Sep 12.194 / 8.968 · período 72,12 % |

- [ ] Los números de arriba coinciden con lo que muestra cada pestaña.
- [ ] Si algún número no coincide, lo escribo aquí y aviso antes de
      seguir: ____________________________________________

## 3. Agendamiento → Ranking de asesores (por EFECTIVIDAD)

- [ ] La 4ª vista de Agendamiento ("Ranking de asesores") ordena a los
      asesores por **% de efectividad** (agendas ÷ gestiones), no por
      cantidad de agendas.
- [ ] La tarjeta "Efectividad del equipo" muestra un % ponderado (no el
      promedio simple de cada asesor).
- [ ] Veo el **nombre real de cada asesor** en la tabla de Agendas y en
      este Ranking (ya no un código ni un número).
- [ ] Algunos asesores aparecen por encima del 100 % de efectividad — es
      normal (ver `docs/pendientes.md` §2), no un error de carga.
- [ ] Si ves al mismo asesor repetido 2 veces con el nombre escrito un
      poco distinto, es un alias que falta crear — avísale a InCo (ver
      `docs/guia-uso-orlant.md` sección 4, "Alias de nombre de asesor").

## 4. Inasistencia

- [ ] La vista que abre por defecto es **"Por mes"** (no "Por
      especialidad").
- [ ] Puedo filtrar por Sede, Especialidad y Entidad.
- [ ] Si un mes trae menos datos que el resto, sale un aviso explicándolo
      (no un error raro ni una gráfica vacía sin explicación) — el texto
      es simple ("todavía está incompleto..."), sin palabras técnicas
      como "sede" o "entidad".

## 4.1 Selector de mes y Efectividad de Citas

- [ ] El selector de mes muestra el nombre completo de cada mes (ej.
      "Septiembre 2026"), nunca una abreviatura ni un número solo.
- [ ] "Julio 2026" aparece marcado como mes parcial (solo trae
      Tipificación de WhatsApp) — es esperado, no un error.
- [ ] El selector de mes solo ofrece Agosto y Septiembre 2026 (más Julio
      2026 parcial) — ningún mes de 2025 ni Enero-Julio 2026, que ya se
      borraron por ser datos de prueba.
- [ ] En **Tráfico de WhatsApp**, ya no aparece ninguna mención a "Nivel
      de servicio a 5 minutos" ni a "aún no hay datos para este
      período" — el Nivel de Servicio a 20 segundos es el único que se
      muestra (el de 5 minutos vuelve solo cuando Wolkvox lo entregue).

## 4.2 Salida (Llamadas y WhatsApp)

- [ ] Veo una pestaña **"Salida"** con 2 tarjetas (total de llamadas y
      total de WhatsApp de salida del mes elegido) y 2 gráficas de
      barras (Llamadas, WhatsApp), con Línea 3P y Línea General por mes.
- [ ] Al subir el archivo mensual de Salida, antes de guardar la
      plataforma me pregunta si el año que infirió para cada mes es
      correcto (ej. "AGOSTO → Agosto 2026") — si no lo es, puedo
      corregirlo ahí mismo, nunca se adivina en silencio.
- [ ] Los números que veo en pantalla coinciden con los del archivo que
      subí.

## 5. Carga de un archivo de prueba

- [ ] Al subir un archivo a cualquier base, la plataforma muestra
      **antes de guardar** cuántas filas se van a reemplazar.
- [ ] Si subo un archivo con un dato inválido, me dice **exactamente qué
      fila y qué columna** tiene el problema (esa fila se omite, el resto
      del archivo sí se carga).
- [ ] Si subo un archivo de Tipificación de WhatsApp (export "HistChat"
      de Wolkvox), la plataforma lo reconoce aunque la hoja tenga un
      nombre distinto cada vez — no hace falta renombrarla.
- [ ] Si intento subir un archivo que junta demasiados meses de una sola
      vez, la plataforma avisa ANTES de guardar nada (en vez de quedarse
      pensando y fallar al final) — si pasa, subo el archivo por meses.
- [ ] (Ver `docs/procedimiento-carga-mensual.md` para el procedimiento
      completo de carga mensual, paso a paso.)

## 6. Mi contraseña

- [ ] En el menú de mi usuario (arriba a la derecha) veo la opción
      **"Cambiar mi contraseña"**.
- [ ] Si escribo mi contraseña actual mal, me rechaza el cambio (no deja
      pasar una contraseña actual incorrecta).
- [ ] Puedo cambiarla por una nueva sin tener que pedírselo a un
      administrador.

## 7. Dominio

- [ ] La plataforma solo responde en **https://informa.inconexion.com.co**
      — el dominio viejo (`duckdns`) ya no funciona ni redirige a ningún
      lado.

## 8. Calidad (si aplica a tu usuario)

- [ ] Veo mis propios monitoreos de calidad si soy asesor ("Mis
      Resultados"), o los de mi campaña si soy evaluador/supervisor.
- [ ] El catálogo de codificaciones y los monitoreos que aparecen
      cargados son los que esperamos — si ves algo que parece un dato de
      prueba, avisa antes de dar por buena esta casilla.

## 9. Algo no cuadra

Si cualquier casilla de arriba no se puede marcar, escribe aquí qué viste
y en qué pantalla, y avisa al equipo antes de dar por cerrada la
verificación:

```
(espacio para notas)
```
