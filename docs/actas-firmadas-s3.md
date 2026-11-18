# Actas firmadas en S3 privado (Fase 371, E3)

Las actas de entrega y devolución del **Inventario de sistemas** se imprimen desde la plataforma
(«Imprimir / PDF»). La versión **firmada** (escaneada en PDF, hasta 5 MB) se sube en
Inventario de sistemas → Agentes → (agente) → Actas, y la plataforma la guarda en un bucket S3
**privado**: nadie la descarga por un enlace; solo ADMIN y SISTEMAS, desde la plataforma.

Mientras no exista el parámetro `ACTAS_S3_BUCKET`, la subida está **apagada** (la pantalla lo
dice y el servidor responde 503). Nada de esto se ha creado en AWS: cada paso lo hace el usuario,
guiado, y con su OK.

## Pasos (en la consola de AWS, misma región de la instancia)

1. **Crear el bucket** (S3 → Crear bucket):
   - Nombre: por ejemplo `inconexion-actas-<algo-único>` (solo minúsculas, números y guiones).
   - **Bloquear todo el acceso público: activado** (las 4 casillas).
   - Propiedad de objetos: «ACL deshabilitadas».
   - Cifrado predeterminado: SSE-S3 (la plataforma además pide `AES256` en cada subida).
   - Control de versiones: **activado** (si se reemplaza una firmada, la anterior no se pierde).
2. **Dar permiso al servidor** (IAM → Users → usuario `inconexion-instance` → Add permissions → Create inline policy; Lightsail no usa roles de instancia, el servidor entra con la access key de ese usuario):
   agregar la declaración `ActasFirmadasS3` de `deploy/iam-policy-instance.json`, cambiando
   `inconexion-actas-tuempresa` por el nombre real (hoy `inconexion-actas-2026`, ya en el JSON del repo). Solo `s3:PutObject` y `s3:GetObject`, solo
   sobre `actas/*`. No se agrega `s3:DeleteObject` ni `s3:ListBucket`.
3. **Crear el parámetro** (Systems Manager → Parameter Store → Crear):
   `/inconexion/prod/ACTAS_S3_BUCKET`, tipo **String**, valor = el nombre del bucket.
4. **Reiniciar la app** para que lo lea (el arranque carga los parámetros del prefijo): volver a
   correr el deploy (Actions → «Deploy a AWS» → Re-run) o esperar el siguiente.
5. **Probar**: en la plataforma, un acta de prueba con un agente y un elemento INVENTADOS →
   «Subir firmada» con un PDF cualquiera → «Ver firmada» lo descarga. En S3 el objeto aparece
   en `actas/` con cifrado AES256.

## Para apagarlo

Borrar el parámetro `/inconexion/prod/ACTAS_S3_BUCKET` y reiniciar la app. Las actas firmadas
ya guardadas siguen en el bucket.
