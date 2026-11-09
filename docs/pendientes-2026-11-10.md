# Pendientes que dependen del supervisor — 10/11/2026 (antes de la reunión con clientes)

Producción en `1.154.0`. Lista corta de lo que falta y **solo puede resolver o decidir el
supervisor**. El resto sigue en [`pendientes.md`](pendientes.md). Sin nombres reales.

## Revisión de hoy (solo lectura en producción)

- **Recorrido de demo** (Aurora con todas sus pestañas, HLM, Mobilize y SURA; 1440 px y 375 px):
  0 errores de consola, 0 respuestas de más de 3 s, ninguna pantalla vacía sin aviso, nada
  cortado ni desbordado. Se recorrió con la cuenta de **administrador**: no se entró con una
  cuenta SUPERVISOR (ver punto 1).
- **Errores de consola al cargar Inasistencia y Encuestas de Aurora (21):** todos de la
  librería de Excel al leer el `.xls` viejo («Missing Info for XLS Record 0x27d»). Ninguno de
  la plataforma; los datos se leyeron completos. No requiere arreglo.
- **Un asesor de Aurora:** existe y está activo, pero en el bloc de notas de credenciales de Aurora
  (fuera del repo) su usuario está escrito en mayúsculas, y el inicio de sesión **distingue
  mayúsculas**: con esa forma no entra. Hay que entregarle el usuario tal como está en la
  plataforma (corregir el bloc).

## Lo que falta y depende del supervisor

1. **Una cuenta SUPERVISOR para probar la vista de supervisor.** Hoy el recorrido se hizo como
   administrador. Con una cuenta SUPERVISOR de Aurora/HLM/Mobilize se confirma que ve lo mismo.
2. **Mobilize › Llamadas Únicas y de Salida: no hay botones «abandonadas / no conectadas».**
   Esos datos se muestran como tarjetas (Abandonadas únicas, Llamadas de salida no conectadas) y
   el filtro «Tipo» es una lista desplegable. Los botones que sí hay («Aplicar filtros», «Ver
   datos») se ven resaltados (fondo negro, letra blanca). Si el supervisor quiere botones para
   alternar entre esas vistas, con el activo marcado, es una función nueva: decidir si se hace.
3. **Matriz de Calidad de ORLANT.** ORLANT califica con la plantilla que ya estaba en la
   plataforma (17 ítems), no con una matriz del supervisor. Si hay matriz propia de ORLANT, se
   importa en Calidad › Plantillas y se marca como principal.
4. **Permisos de los líderes que van a evaluar.** Para calificar, el líder (SUPERVISOR o CALIDAD)
   necesita el acceso de **campaña** de esa campaña (no solo «supervisa»). Decir quiénes son
   para revisarlos en Usuarios.
5. **Calidad de Aurora sin monitoreos.** La pestaña aparece sola con el primer monitoreo. Para la
   reunión, se verá solo si algún líder califica antes.
6. **Hospital La María: meses que faltan.** Tráfico de Llamadas y Tráfico de WhatsApp muestran
   «Información pendiente» porque faltan meses. Faltan las bases de esos meses (por Cargar datos).
7. **Encuestas de Aurora:** el compilado trae fecha, entidad y datos del paciente, pero **no trae
   respuestas ni puntajes**; hoy la pestaña cuenta encuestas por entidad y por fecha. Si se quiere
   ver satisfacción, hace falta el archivo con las respuestas.
8. **Inasistencia de Aurora: confirmar el denominador.** El % se calcula sobre todas las citas de
   la especialidad (incluye canceladas y las que vienen sin estado), como en el ejemplo del
   pedido. Si debe ser solo sobre citas no canceladas, el % cambia.
9. **Errores de Aurora:** no hay errores registrados; la pestaña muestra su aviso. Se llenan con
   «Agregar errores».
10. **Asesores de ORLANT (19 cuentas nuevas):** al primer ingreso la plataforma les pide cambiar la
    contraseña. Entregar las credenciales por un canal privado (el bloc de notas quedó fuera del
    repo).
