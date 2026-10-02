# Guía de usuario — INCONEXION PLATFORM

Esta guía es para quien **usa** la plataforma día a día — Calidad, Gerencia,
Gestión Humana, administración de usuarios — no para desarrolladores. Si
buscas documentación técnica, mira [`README.md`](../README.md) (arquitectura
y cómo correr el proyecto) o [`ARQUITECTURA.md`](ARQUITECTURA.md) (detalle
técnico profundo). El historial completo de cada cambio, fase por fase, vive
en [`PROGRESS.md`](../PROGRESS.md).

---

## 1. Iniciar sesión y qué puede ver cada rol

Entra con el usuario y la contraseña que te dio el administrador de la
plataforma. Lo que ves después de iniciar sesión depende de tu **rol**:

| Rol | Para qué es |
|---|---|
| **ADMIN** | Administrador general. Ve y gestiona todo: usuarios, campañas, dashboards, historial, umbrales. |
| **CALIDAD** | Registra evaluaciones de calidad (monitoreos) en las campañas que tiene asignadas. |
| **SUPERVISOR** | Similar a Calidad: registra monitoreos en sus campañas asignadas. |
| **REPORTES** | Sube los archivos de datos que alimentan los dashboards (Tráfico/Wolkvox, Nivel de Servicio) y puede editar o eliminar monitoreos ya guardados en sus campañas. |
| **GERENCIA** | Ve los indicadores ejecutivos y los dashboards de las campañas asignadas, sin editar cargas operativas. |
| **GESTION_HUMANA** | Ve y registra la información de personal por campaña. |
| **INVENTARIO** | Ve y gestiona los ítems de stock y sus movimientos. |
| **CLIENTES_DASH** | Vista de cliente: solo el dashboard de su propia campaña. |
| **ASESOR** | Perfil individual de un asesor: solo ve sus propios resultados de Calidad ("Mis Resultados"), nunca los de toda la campaña. |
| **AUX_ADMIN** | Administrador auxiliar: los mismos permisos que un ADMIN le asigne uno por uno (no todo por defecto). |

Un mismo usuario solo ve las **campañas** que tiene explícitamente asignadas
(salvo ADMIN, que las ve todas). Si te falta acceso a algo que necesitas para
tu trabajo, pídeselo al administrador — es quien asigna campañas y permisos
desde "Gestión de Usuarios".

Si tu usuario aparece como "suspendido", no podrás entrar — contacta al
administrador para reactivarlo.

---

## 2. Cómo subir el archivo de Tráfico/Wolkvox

Hay **dos caminos válidos hoy**, según tu situación. Ninguno de los dos es
"el método viejo" — ambos están vigentes, cada uno sirve para un caso
distinto. (Lo que sí quedó como método anterior, y ya no es necesario
usarlo, es la carga manual antigua de "Nivel de Servicio" de una sola
campaña que había antes de que existiera el tráfico completo de Wolkvox —
esa pantalla se conserva solo como respaldo, marcada "Método anterior" en
la interfaz, para quien todavía no tenga el reporte completo de Wolkvox.)

### Paso 0 — Solo la primera vez que llega un skill nuevo de Wolkvox

Antes de subir el primer archivo de una campaña nueva (o si Wolkvox reporta
un nombre de skill que la plataforma todavía no conoce), alguien con rol
ADMIN debe registrar a qué campaña pertenece ese skill. Esto aplica sin
importar cuál de los dos caminos de abajo uses:

1. Entra a **Metas Calidad**.
2. Busca la tarjeta **"Registrar skill nuevo"** (arriba de la tabla de
   mapeos ya existentes).
3. Escribe el `SKILL_NAME` exactamente como aparece en Wolkvox Manager
   (Skills & Servicios), elige la campaña (y la sede, si la campaña tiene
   más de una) y pulsa **"Registrar skill"**.

Si el skill ya estaba registrado, no hace falta repetir este paso — la
plataforma reconocerá el archivo automáticamente.

### Camino A — Vía principal: un archivo por campaña, desde "Cargar Datos"

Es el camino recomendado para el uso normal, mes a mes, de **una campaña a
la vez** — y de paso trae en el mismo archivo las demás hojas que le
apliquen a esa campaña (resumen/KPIs, Monitoreos de Calidad si aplica).

1. Entra como administrador (o con el permiso **"Cargar Datos"**) → menú
   **"Cargar Datos"** → elige la campaña.
2. Botón **"Descargar plantilla (Excel)"** — el archivo trae, entre otras,
   una hoja **"DATA"** para el tráfico de Wolkvox.
3. Llena la hoja **DATA** con el export de Wolkvox de esa campaña (y las
   demás hojas que apliquen esta vez — las que no apliquen se pueden dejar
   vacías, no es un error).
4. Sube el archivo con **"Elegir archivo…"**, revisa la vista previa (te
   dice si cada hoja quedó OK, vacía, o con un error puntual) y confirma
   con **"Guardar carga"**.

### Camino B — Para un export completo de Wolkvox con varias campañas/skills a la vez

Útil cuando tu flujo es pegar el export completo de Wolkvox Manager (varias
skills, varias campañas, varios meses de una sola vez) en lugar de separar
la hoja DATA campaña por campaña.

1. Entra a **Metas Calidad** → tarjeta **"Tráfico de Llamadas — carga desde
   Wolkvox"**.
2. Selecciona el archivo exportado desde Wolkvox Manager con **"Elegir
   archivo…"** y confírmalo.
3. La plataforma asigna cada fila a su campaña automáticamente usando el
   mapeo de skills del Paso 0. Si algún skill del archivo no está mapeado
   todavía, esas filas quedan marcadas como **"(SIN ASIGNAR)"** — vuelve al
   Paso 0 para registrarlo y vuelve a cargar.

Puedes subir el mismo archivo las veces que quieras por cualquiera de los
dos caminos: si un período ya tenía datos, la plataforma te avisa antes de
sobrescribirlo para que lo confirmes.

### Paso final — Confirmar que quedó bien cargado

En **Metas Calidad**, la tarjeta **"Control de Cargas por Período"**
muestra, por skill, qué períodos ya tienen tráfico cargado — revísala
después de cada carga (por cualquiera de los dos caminos) para confirmar
que el período que acabas de subir aparece ahí.

---

## 3. Cómo leer los dashboards principales

Cada campaña tiene su propio dashboard, con indicadores agrupados por tema.
En términos generales (sin entrar en la fórmula exacta de cada uno):

- **Nivel de Servicio / Nivel de Atención**: qué porcentaje de las llamadas
  se contestó dentro del tiempo esperado (el estándar de la operación es 20
  segundos). Más alto es mejor.
- **Niveles de Servicio a 10s/30s**: la misma idea del Nivel de Servicio,
  pero medidos contra ventanas de tiempo más cortas o más largas, según lo
  que pida cada campaña.
- **ASA / ATA**: tiempo promedio de respuesta (cuánto espera en promedio un
  cliente antes de que le contesten) y tiempo promedio de abandono (cuánto
  aguantó esperando antes de colgar, en las llamadas que no se contestaron).
  Más bajo es mejor en ambos.
- **Wait Time**: el tiempo de espera de las llamadas, en general. Más bajo
  es mejor.
- **AHT**: el tiempo promedio que dura una llamada ya atendida. Ni muy
  alto (puede indicar procesos lentos) ni muy bajo (puede indicar que se
  está cortando la atención antes de tiempo) es necesariamente bueno —
  cada campaña tiene su propio rango esperado.
- **Llamadas abandonadas / Tasa de Abandono**: cuántas llamadas (o qué
  porcentaje) colgaron antes de que las contestaran. Más bajo es mejor.
- **Calidad (monitoreos)**: el resultado de las evaluaciones que registra
  Calidad/Supervisor sobre llamadas puntuales — refleja qué tan bien se
  siguió el protocolo de atención, no solo la velocidad de respuesta.
- **% de Efectividad (Gestión Humana)**: qué tan cerca está la producción de
  una campaña (ventas o recaudo del mes) de su propia meta. Se ve junto a la
  rentabilidad (ingresos menos costo de nómina) en el dashboard de Gestión
  Humana — es un indicador de negocio, no de la atención telefónica en sí.
- **Semáforo de colores**: muchos indicadores se pintan en verde, amarillo
  o rojo según qué tan cerca estén de la meta. Esos límites de color
  (umbrales) los define un ADMIN en la pantalla **Umbrales** y aplican
  igual para todos los que ven ese dato.

Si un número te parece raro (muy alto, muy bajo, o en blanco), lo primero
que hay que revisar es si el periodo correspondiente ya tiene datos
cargados (ver "Control de Cargas por Periodo" arriba) — un dashboard vacío
casi siempre es un periodo sin cargar, no un error del sistema.

---

## 4. Dónde reportar un problema o pedir un cambio

Esta plataforma no tiene todavía un canal formal de soporte (como un correo
o formulario dedicado). Si algo no funciona, un dato se ve mal, o necesitas
un cambio (una campaña nueva, un usuario nuevo, un permiso, un indicador
distinto): **avisa directamente al administrador de la plataforma**, con la
mayor cantidad de detalle posible (qué pantalla, qué esperabas ver, qué
viste en realidad) para que pueda revisarlo o escalarlo.

---

*Esta guía cubre el uso normal de la plataforma. Para detalle técnico o el
historial de cómo se construyó cada funcionalidad, consulta
[`README.md`](../README.md) y [`PROGRESS.md`](../PROGRESS.md).*
