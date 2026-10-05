# Checklist de verificación — para Edwin (aceptación manual)

> Documento de aceptación manual: marca cada casilla después de revisarla
> tú mismo en la plataforma real, no es algo que se marque solo. En
> español simple, sin nada técnico. Si algo no coincide con lo que
> esperabas, avisa antes de seguir usando esa parte.

Plataforma: **https://informa.inconexion.com.co** — versión **1.11.2**.

## 1. Entrar y ver el dashboard

- [ ] Puedo entrar con mi usuario y contraseña.
- [ ] Al entrar veo el dashboard de **ORLANT** con las **7 pestañas**:
      Tráfico de Llamadas, Tráfico de WhatsApp, Agendamiento, Inasistencia,
      Efectividad de Citas, Tipificación, Calidad.
- [ ] El botón de **pantalla completa** agranda el dashboard y lo
      achica de vuelta.
- [ ] Puedo cambiar entre **tema claro y oscuro**.

## 2. Los números coinciden

Compara estos números contra lo que ves en pantalla (`PROGRESS.md` del
repositorio tiene siempre la versión más reciente de esta tabla):

| Indicador | Valor esperado |
|---|---|
| Tipificación (Ago-26 + Sep-26) | 14.940 + 19.721 = 34.661 |
| Tráfico de Llamadas | Ago 8.908/7.961/947 · Sep 9.043/8.883/160 |
| Tráfico de WhatsApp | Ago 7.390/7.370/20, SL20 36,05 % · Sep 7.968/7.953/15, SL20 39,88 % |
| Agendas (abr-25) | 7.426 (General 4.643 / 3P 2.783) |
| Inasistencia | Ago-26 7,45 %, período 6,87 % |
| Efectividad de agendamiento | Sep-26 44,81 % (18.566 / 8.319) |
| Efectividad de Citas | Ene 93,67 %, Feb 84,32 %, Mar 85,54 %, período 86,01 % |

- [ ] Los números de arriba coinciden con lo que muestra cada pestaña.
- [ ] Si algún número no coincide, lo escribo aquí y aviso antes de
      seguir: ____________________________________________

## 3. Agendamiento → Ranking de asesores (por EFECTIVIDAD)

- [ ] La 4ª vista de Agendamiento ("Ranking de asesores") ordena a los
      asesores por **% de efectividad** (agendas ÷ gestiones), no por
      cantidad de agendas.
- [ ] La tarjeta "Efectividad del equipo" muestra un % ponderado (no el
      promedio simple de cada asesor).

## 4. Inasistencia

- [ ] La vista que abre por defecto es **"Por mes"** (no "Por
      especialidad").
- [ ] Puedo filtrar por Sede, Especialidad y Entidad.
- [ ] Si un mes trae menos datos que el resto, sale un aviso explicándolo
      (no un error raro ni una gráfica vacía sin explicación).

## 5. Carga de un archivo de prueba

- [ ] Al subir un archivo a cualquier base, la plataforma muestra
      **antes de guardar** cuántas filas se van a reemplazar.
- [ ] Si subo un archivo con un dato inválido, me dice **exactamente qué
      fila y qué columna** tiene el problema (esa fila se omite, el resto
      del archivo sí se carga).
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
