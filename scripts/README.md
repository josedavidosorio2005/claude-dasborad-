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
  teléfonos) — solo estructura/conteos/agregados. **Por construcción**
  (Fase 129, tras un incidente real: un script que SÍ traía
  `opciones.entidades` crudo hasta Node y confiaba en un `delete` manual
  justo antes del dump final — fragil, una línea nueva en medio lo habría
  vuelto a exponer): la selección de campos seguros de cualquier endpoint
  `.../opciones` (u otro que pueda traer texto por registro —
  entidad/asesor/examen/profesional/usuario) va **dentro** del
  `page.evaluate`, nunca después — el valor crudo no debe cruzar nunca al
  lado de Node, ni siquiera un instante (mismo criterio que
  `veredictoSubvista`, `revision-final.js`: nunca un objeto crudo del
  servidor/DOM, siempre uno ya reducido a conteos/números/estados de una
  lista fija). `server/tests/fase129-scripts-produccion-sin-texto-crudo.test.js`
  falla en CI si un script (nuevo o existente) tiene un `page.evaluate`
  cuyo cuerpo completo es, sin ningún otro paso, un reenvío crudo de un
  endpoint `.../opciones` — alcance acotado a esa forma exacta, no un
  linter general; sigue pendiente auditar otros endpoints con el mismo
  riesgo (`.../ranking`, `/users`, `/historial`) en los scripts que no
  tocó esa fase.
- Un script que hace un dry-run (preview sin guardar) usa
  `scripts/produccion/lib/dry-run-seguro.js` (Fase 129, mismo incidente):
  nunca `page.exposeFunction` para forzar `window.confirm` — siempre
  envuelve el retorno en una Promise (truthy), así que el guard real de
  la app nunca corta. 2 defensas independientes: confirm síncrono vía
  `page.evaluate` + bloqueo de red (`page.route`) de cualquier escritura
  real, con el script fallando ruidosamente si una llega a intentarse.
- Si un script necesita una credencial de prueba local, la lee de
  `server/data/seed-demo-credenciales.txt` (gitignored) — nunca la pide
  por variable de entorno en texto plano.
