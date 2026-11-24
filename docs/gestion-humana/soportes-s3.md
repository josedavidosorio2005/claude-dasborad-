# Soportes de Talento humano en S3 privado (Fase GH3)

Los soportes adjuntos de **Talento humano** (incapacidades, licencias, cartas de retiro… en PDF,
imagen o Word, hasta 8 MB) se guardan en un bucket S3 **privado**, igual que las actas firmadas del
Inventario de sistemas (`docs/actas-firmadas-s3.md`):

- el servidor sube y entrega el archivo; nunca hay un enlace público;
- solo entran quienes entran a Talento humano (el administrador; GESTION_HUMANA solo con
  `GH_ROL_ACTIVO=1`);
- el tipo se revisa por el contenido del archivo, no por la extensión;
- la clave en S3 es `talento-humano/soportes/<id>-<fecha>.<ext>`, sin el nombre del archivo (que
  puede llevar el nombre de la persona). El nombre queda solo en la base (`gh_archivos`);
- la bitácora (`gh_bitacora`) registra quién subió o borró y cuándo, sin nombre ni contenido;
- «borrar» marca el soporte como borrado y no se vuelve a entregar; el objeto queda en S3 (el
  servidor no tiene `s3:DeleteObject`).

Mientras no exista el parámetro `GH_SOPORTES_S3_BUCKET`, los soportes **siguen en el navegador**
(IndexedDB, como antes de GH3) y la barra de Talento humano lo dice. Encendido, los nuevos van a S3;
los guardados antes en un navegador se siguen abriendo desde ese navegador.

Es un bucket **aparte** del de las actas: son datos de salud y de personal, con su propio permiso.
Nada de esto se crea en AWS sin el usuario: cada paso lo hace él, guiado, y con su OK.

## Pasos (consola de AWS en español, región Norte de Virginia, `us-east-1`)

1. **Crear el bucket** (S3 → «Crear bucket»):
   - Nombre: `inconexion-talento-humano-2026` (si AWS dice que ya existe, otro nombre con solo
     minúsculas, números y guiones).
   - «Propiedad de objetos»: «ACL deshabilitadas».
   - «Bloquear todo el acceso público»: **activado** (las 4 casillas).
   - «Control de versiones de buckets»: **Habilitar**.
   - «Cifrado predeterminado»: SSE-S3.
2. **Dar permiso al servidor** (IAM → «Usuarios» → `inconexion-instance` → «Agregar permisos» →
   «Crear política insertada» → JSON): pegar la declaración `TalentoHumanoSoportesS3` de
   `deploy/iam-policy-instance.json`. Solo `s3:PutObject` y `s3:GetObject`, solo sobre
   `talento-humano/*` de ese bucket. Sin `s3:DeleteObject` ni `s3:ListBucket`.
3. **Crear el parámetro** (Systems Manager → «Almacén de parámetros» → «Crear parámetro»):
   `/inconexion/prod/GH_SOPORTES_S3_BUCKET`, tipo **String**, valor = el nombre del bucket.
4. **Reiniciar la app** para que lo lea: volver a correr el deploy o esperar el siguiente.
5. **Probar** con un archivo inventado (como administrador): en Talento humano, un soporte de prueba
   → abrirlo → borrarlo. En S3 aparece en `talento-humano/soportes/` con cifrado AES256.

## Para apagarlo

Borrar el parámetro `/inconexion/prod/GH_SOPORTES_S3_BUCKET` y reiniciar la app. Los soportes ya
guardados siguen en el bucket, pero no se pueden abrir hasta volver a encenderlo.
