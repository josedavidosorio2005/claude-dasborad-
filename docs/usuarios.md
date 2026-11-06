# Usuarios — reglas para crearlos

Administración › Usuarios › **+ Nuevo Usuario**. Fase 280 (06/11/2026).

## Nombre completo

- Es lo que se ve en el **encabezado** de cada página (junto al rol) y en el saludo
  («Bienvenido, …», solo el primer nombre).
- Va con nombre y apellido, como se escribe normalmente, con tildes si las tiene:
  por ejemplo «María González».
- Si al entrar el encabezado muestra solo el usuario, es porque en «Nombre completo»
  quedó escrito el usuario: se corrige editando el usuario (Editar › Nombre completo).

## Usuario (para iniciar sesión)

- De **3 a 32 caracteres**.
- Solo **letras sin tilde ni ñ**, **números**, **punto (.)**, **guion (-)** y **guion
  bajo (_)**. Sin espacios. Ejemplo: «maria_gonzalez».
- El formulario muestra esta regla debajo del campo y no deja escribir más de 32.
  Si algo no sirve, el aviso dice qué es y cómo dejarlo (por ejemplo «gonzález» →
  «gonzalez»). La regla es la misma en el navegador y en el servidor
  (`public/js/usuario-regla-logic.js` y `userSchema` en `server/validation.js`).

## Regla de Edwin para los usuarios de cliente (rol Dashboard Clientes)

- El **usuario** va con la **primera letra en mayúscula y el resto en minúscula**,
  como «Orlant».
- Es una convención para crearlos (la plataforma no la exige ni la cambia sola: el
  inicio de sesión respeta mayúsculas y minúsculas tal como se crearon).
