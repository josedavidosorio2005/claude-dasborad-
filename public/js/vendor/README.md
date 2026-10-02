# public/js/vendor/

Librerias de terceros servidas por la propia app (nunca desde un CDN externo
en producción, salvo que `server/server.js` lo permita explícitamente en la
CSP).

## xlsx-0.20.3.full.min.js (SheetJS)

Fase 114 (Dependabot, alerta #1, `GHSA-4r6h-8v6p-xvw6` / `CVE-2023-30533`,
alta): la versión anterior (0.18.5, cargada antes desde
`cdnjs.cloudflare.com`) tiene una vulnerabilidad de prototype pollution al
leer un archivo `.xlsx` manipulado. SheetJS arregló esto en 0.19.3, pero
dejó de publicar versiones nuevas en el registro público de npm — la fuente
oficial de versiones nuevas es `https://cdn.sheetjs.com/`.

- Origen: `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`
- Verificado: el mismo archivo, byte a byte, viene dentro del tarball oficial
  de npm (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`,
  `package/dist/xlsx.full.min.js`) — mismo sha384 en ambas rutas de descarga.
- `sha384` (hex): `127c98d3f1921d0192c5280cc1a20fcd21126eaa0e2d27b17e748c37600ffb7f429269fddacb700016729ead49cb3753`
- `integrity` (el que usa `public/index.html`):
  `sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT`

Para actualizar en el futuro: descargar la nueva versión desde
`cdn.sheetjs.com`, confirmar que el mismo archivo viene dentro del tarball
oficial de npm (misma verificación cruzada de arriba), recalcular el hash
(`openssl dgst -sha384 -binary archivo.js | openssl base64 -A`), reemplazar
el archivo y el atributo `integrity` del `<script>` en `public/index.html`
en el mismo commit.
