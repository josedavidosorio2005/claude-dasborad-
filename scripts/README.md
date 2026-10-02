# scripts/

Herramientas de QA/producción que se siguen usando, ordenadas por tema
(Fase 112). Todo lo demás (verificaciones de una sola fase ya cerrada,
Fases 45–111) salió de `main` — queda completo en el tag
`archivo/scripts-fases-45-111`.

Ninguno de estos scripts está referenciado por un workflow de GitHub
Actions (eso vive en `.github/scripts/ci-pantallas-orlant.js`, el único
que corre en CI) — todos son de uso manual, corridos a mano desde la
raíz del repo. Todos esperan `server/node_modules` ya instalado
(`npm ci` dentro de `server/`) porque resuelven `playwright`/`xlsx` desde
ahí (`path.join(SERVER_DIR, 'node_modules', ...)`), nunca con un
`require()` plano.

## scripts/qa/ — auditoría local

- **`auditoria-amplia-local.js`** — recorrido completo contra
  `http://localhost:3000` con `npm run seed:demo` corriendo: cada rol de
  demo inicia sesión, el admin recorre ORLANT a fondo (todas las
  pestañas/sub-pestañas reales, claro/oscuro, escritorio/móvil, Exportar
  en cada una). Revisa errores de consola/página, peticiones fallidas
  (sin contar los 403 esperados), texto NaN/undefined/[object Object],
  scroll horizontal, que el Excel exportado sea válido, y que cada
  `<canvas>` tenga píxeles realmente pintados (no solo que el objeto
  Chart.js exista — ese fue el bug de la Fase 111 que se le escapó a las
  pruebas).

  ```
  cd server && npm run seed:demo
  node server.js &
  cd .. && node scripts/qa/auditoria-amplia-local.js
  ```

## scripts/produccion/ — solo lectura contra producción

- **`revision-final.js`** — recorrido de verificación en
  `https://informa.inconexion.com.co` con sesión real (navegador visible,
  "INICIA SESIÓN AHORA"), 0 escritura. Actualízalo cuando cambien las
  pestañas o los números de control a confirmar.
- **`carga-real-patron.js`** — patrón de referencia para una carga real en
  producción: siempre por la interfaz normal de la plataforma (nunca
  directo a la base de datos ni por un workflow — ver CLAUDE.md), con el
  archivo real de Edwin fuera del repo por ruta absoluta.

## scripts/guia/ — guía de uso

- **`generar-capturas.js`** — toma las capturas de pantalla que ilustran
  la guía de uso (`docs/guia-de-usuario.md` / `docs/guia-uso-orlant.md`).
- **`generar-pdf.js`** — arma el PDF final de la guía en
  `trabajo inconexion\entregables\` (fuera del repo).

## Convenciones

- Nunca escriben en producción salvo que el script sea explícitamente de
  carga (y aun así, solo por la interfaz normal — ver CLAUDE.md).
- Nunca imprimen datos reales de clientes individuales (nombres,
  teléfonos) — solo estructura/conteos/agregados.
- Si un script necesita una credencial de prueba local, la lee de
  `server/data/seed-demo-credenciales.txt` (gitignored) — nunca la pide
  por variable de entorno en texto plano.
