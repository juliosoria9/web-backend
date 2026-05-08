# Examen — Reto F11: salas WebSocket granulares y broadcast selectivo con confirmación

## Reto

El reto va sobre afinar el modelo pub/sub que ya teníamos montado en BildyApp. Hasta ahora cada socket se unía sólo a la sala de su compañía y todos los del equipo recibían los mismos eventos. F11 pide añadir una segunda granularidad — una sala personal `user:<id>` por usuario — y usarla para confirmaciones dirigidas (`deliverynote:signed:ack`) al que dispara la acción, sin tocar el broadcast a toda la compañía (`deliverynote:signed`).

La idea de fondo es separar dos cosas que antes iban por el mismo canal: el "evento de novedad" (todos los del equipo se enteran de que algo cambió) y el "evento de feedback" (sólo el que hizo la acción recibe la confirmación). Así el frontend no tiene que filtrar nada en el cliente y los dos contratos quedan independientes.

## Tarea técnica

- **`ejercicios/practica/bildyapp-api/src/index.js:43-49`** — En el handler `connection` mantengo el join a `company:<id>` que ya existía (líneas 37-41) y añado un segundo `socket.join(\`user:${socket.user._id}\`)` con el mismo guard defensivo. Es el sitio canónico: cuando el socket termina su handshake, queda registrado en sus dos salas.

- **`ejercicios/practica/bildyapp-api/src/middleware/socket-auth.js:38`** — Justo después de `socket.user = user` y antes del `next()` final añado también `socket.join(\`user:${user._id}\`)`. Lo pongo aquí porque el criterio del enunciado lo pide explícitamente en este archivo, y de paso me sirve para cerrar la race window entre que el middleware termina y el `connection` se dispara: si una request HTTP emitiese a `user:<id>` justo en ese hueco, el socket ya está en la sala. El doble join es idempotente — Socket.IO deduplica memberships por socket, así que no hay coste real.

- **`ejercicios/practica/bildyapp-api/src/controllers/deliverynote.controller.js:281-293`** — Junto al `io.to(companyRoom).emit('deliverynote:signed', deliveryNote)` que ya estaba, añado un segundo emit `deliverynote:signed:ack` a la sala `user:<id>` con payload mínimo: `{ deliveryNoteId, signedAt, signatureUrl }`. El broadcast company-wide se queda tal cual.

- **`ejercicios/practica/bildyapp-api/tests/socket.test.js`** — Test integrador nuevo. Levanto el server HTTP+Socket.IO en un puerto libre, conecto dos clientes (A firmante, B observador) en la misma compañía, disparo `PATCH /api/deliverynote/:id/sign` desde A y verifico las tres aserciones que pide el criterio: A recibe broadcast y ack, B recibe sólo broadcast, B nunca recibe el ack. Como el flujo de firma real toca Supabase y Sharp, mockeo `storage.service.js` con `jest.unstable_mockModule` para que el test corra en cualquier entorno.

- **`ejercicios/practica/bildyapp-api/package.json`** — Añadido `socket.io-client` como devDependency (no estaba; hace falta para que el test pueda actuar como cliente real).

Bonus: en el camino arreglé un commit previo que dejaba el árbol roto (`src/utils/{AppError,handleJwt,handlePassword}.js` y `src/middleware/{validate,role.middleware}.js` se referenciaban con imports pero no existían en disco). Sin esos ficheros ni los 101 tests originales arrancaban, así que era pre-condición para validar que mi cambio no rompía nada.

## Respuestas socráticas

### 1. `src/index.js:35` — usuario sin compañía

El join que hacemos en `index.js:37-41` está protegido con `socket.user?.company?._id`. Si llega un usuario autenticado pero sin compañía (caso real: en BildyApp uno se registra y verifica el email antes de crear/unirse a una empresa vía `PATCH /api/user/company`), el optional chaining devuelve `undefined`, el `if` evalúa a falso y el socket queda **conectado pero sin sala de compañía**. En la práctica eso es un socket "sordo" para los broadcasts company-wide: no le llegará `deliverynote:signed`, ni `deliverynote:new`, ni nada de lo que se emita a `company:*`.

Cómo lo mejoraría — se me ocurren dos caminos:

1. **Rechazar la conexión en `socketAuth`**. Ya tenemos el usuario populado en `socket-auth.js:33` con su company; bastaría un `if (!user.company) return next(new Error('Usuario sin compañía'))`. Lo bueno: el cliente recibe `connect_error` y se entera de que aún no puede colaborar. Lo malo: si más adelante quisiéramos mandarle notificaciones genéricas (bienvenida, recordatorios) por su sala personal, se las cargaríamos.

2. **Asignar a una sala default tipo `users:no-company`**. El socket queda admitido y la política de qué le mandamos pasa a ser explícita. Es menos restrictivo y se lleva bien con la sala `user:<id>` que ya añadimos.

Como con el cambio de F11 ahora `user:<id>` se hace tanto en `socket-auth.js` (defensivo) como en `index.js:43-49` (canónico), un usuario sin compañía sigue recibiendo sus `:ack` privados — sólo se queda fuera del feed compartido. A mí me parece un compromiso aceptable mientras la UI le explique que para colaborar tiene que crear o unirse a una empresa.

### 2. `:signed` a toda la compañía vs `:ack` al `user:<id>`

Son dos eventos porque hacen cosas distintas. `deliverynote:signed` notifica una novedad de dominio — "el albarán X ha pasado a estado firmado" — y le interesa a todos los del equipo para que sus listas, contadores y dashboards se actualicen. `deliverynote:signed:ack` confirma una acción concreta — "tu petición de firmar X ha terminado bien" — y sólo le interesa al que firmó: cerrar el modal, mostrar un toast, redirigir al PDF.

¿Podría el frontend filtrar el broadcast por `deliveryNote.user` y prescindir del `:ack`? Técnicamente sí, el modelo lo lleva populado en el sign handler. Pero tiene dos pegas: el contrato del broadcast pasa a depender de un campo (`user`) que sólo le sirve al firmante (acoplas el evento a un caso de uso del cliente), y cada cliente del equipo repite la misma lógica de filtrado. Con el `:ack` separado el server hace el routing y cada cliente recibe sólo lo que le incumbe. El payload del broadcast también queda más limpio, sin metadatos cuya única función es discriminar destinatarios.

El precio es duplicar un emit en el server, pero los emits a sala son baratos (Socket.IO indexa rooms en O(1)) y la simplificación en el cliente compensa.

### 3. ACKs (callbacks en emit) — escenario en `signDeliveryNote` y contrato

Socket.IO ofrece otra forma de confirmar acciones: el último argumento de un `emit` puede ser una función y el server la invoca con la respuesta. Aplicado al firmado quedaría tal que así:

```js
// Cliente
socket.emit('deliverynote:request-sign', { id: noteId, signature: blob }, (response) => {
  if (response.ok) {
    showToast(`Firmado el ${response.signedAt}`)
  } else {
    showError(response.error)
  }
})

// Server (handler en index.js, no en controller HTTP)
socket.on('deliverynote:request-sign', async ({ id, signature }, ack) => {
  try {
    const note = await signService(socket.user, id, signature)
    ack({ ok: true, deliveryNoteId: note._id, signedAt: note.signedAt })
    io.to(`company:${socket.user.company._id}`).emit('deliverynote:signed', note)
  } catch (err) {
    ack({ ok: false, error: err.message })
  }
})
```

Es útil cuando el cliente necesita confirmación inmediata atada a *su* request, sin tener que volver a pedir el estado por HTTP. La diferencia clave con un `:ack` como evento separado es que el callback está vinculado 1:1 al `emit` que lo originó: aunque lleguen otros eventos similares mientras esperamos, sólo se dispara para esa petición concreta. Eso evita race conditions cuando hay varias firmas concurrentes. Con un evento separado tipo `:ack` hay que correlacionarlo a la petición original a mano (típicamente con un `requestId` que el cliente manda y el server devuelve).

En BildyApp esto no se aplica directamente porque la firma se hace por HTTP (`PATCH /api/deliverynote/:id/sign`) con `multipart/form-data` para subir la imagen, así que el callback de Socket.IO no encaja sin rehacer el flujo. Por eso el `:ack` separado tiene sentido aquí: el frontend refresca la UI cuando le responde el HTTP **y** cuando le llega la confirmación por sockets.

### 4. `verifyToken` devuelve null vs throw — `next(err)` vs no llamar `next()`

En `src/utils/handleJwt.js:21-27` `verifyToken` devuelve `null` cuando el token es inválido (captura `JsonWebTokenError`/`TokenExpiredError` internamente). Por eso en `socket-auth.js:19-22` la comprobación es `if (!decoded?._id) return next(new Error('Token inválido'))` y no un `try/catch` envolviendo el `verifyToken`. Es la convención del repo: simplifica los call-sites pero tiene el coste de perder detalle del error — token expirado y token forjado colapsan al mismo `null`, no los distinguimos en logs.

Sobre las tres opciones de `next` en un middleware Socket.IO:

- `next()` sin argumento → la conexión se acepta y el handler `connection` se ejecuta.
- `next(new Error('msg'))` → la conexión se rechaza. El cliente recibe un evento `connect_error` con `err.message` igual al string que pasamos, y el server libera el handshake inmediatamente.
- **No llamar `next()`** → bug. El handshake queda colgado: el cliente espera hasta su timeout interno (~20s por defecto) y luego se rinde, mientras el server mantiene la conexión TCP a medias y el slot del middleware ocupado. Si pasa repetidamente es una fuga de memoria de baja intensidad.

Comparado con Express: ahí `next(err)` salta al error handler global que devuelve un 4xx/5xx por HTTP. En Socket.IO no hay error handler en cadena, `next(err)` es directamente "rechaza esta conexión con este motivo" y el `err.message` viaja tal cual al cliente. Conviene que sea informativo pero sin filtrar detalles internos.

### 5. `socket.to(room)` vs `io.to(room)` — ¿el creador recibe su propio evento?

`socket.to(room).emit(...)` emite a todos los sockets de la sala **excepto** al que llama (el `socket` desde el que se invoca). `io.to(room).emit(...)` emite a todos los sockets de la sala **incluido** el emisor si está dentro, porque `io` es la referencia global y no tiene noción de "quién originó".

En BildyApp `createClient` hace `req.app.locals.io.to(\`company:${req.user.company}\`).emit('client:new', ...)`. Como el usuario A que crea el cliente ya está en la sala `company:<id>` (lo metimos en el `connection` handler al conectarse), **A sí recibe su propio `client:new`**. Y si tiene varias pestañas o dispositivos abiertos, todos lo reciben.

¿Por qué se usa `io.to(...)` en vez de `socket.to(...)` en este repo? Porque los controllers HTTP no tienen acceso al socket originador — la petición entra por Express, no por Socket.IO. Sólo conocen `req.user` y `req.app.locals.io`. `socket.to(...)` exige estar dentro del handler de un evento de socket (`socket.on(...)`).

Lo que pasa en la práctica es que la UI puede recibir el evento por dos caminos para la misma acción: la respuesta HTTP 201 y el `client:new` por sockets. Si la UI añadió el cliente optimísticamente al recibir el HTTP, el broadcast lo duplica. Lo arreglas en el cliente:

- Idempotencia por `_id` de Mongo: si ya tienes ese item en el estado local, ignora el evento. Es la solución más robusta y de paso protege contra reconexiones que reentregan eventos.
- Pasar un `requestId` opaco con el POST y devolverlo en el evento, para que el cliente que originó la acción lo ignore.
- Filtrar por `event.createdBy === currentUser._id`.

La asunción implícita del proyecto es "el frontend deduplica si hace falta", que es lo más simple para una API REST con eventos colaborativos opcionales por encima.

## Proceso

Lo primero fue leerme `index.js`, `socket-auth.js` y el sign handler entero de `deliverynote.controller.js` para alinearme con cómo está hecho el repo: los joins en el `connection`, los emits salen desde controllers vía `req.app.locals.io`, los payloads son el documento populado o un subset según el caso. La línea ~145 que menciona el enunciado era aproximada — el emit real está en la 282 — así que ahí fue donde añadí el `:ack`.

Antes de tocar nada me di cuenta de que el árbol del proyecto estaba roto: `src/utils/*.js` y dos middlewares se importaban pero no existían en disco. Sin ellos ni los 101 tests originales arrancaban, así que el primer commit fue restaurarlos (`fix(bildyapp-api): restaurar utils y middlewares ausentes en el árbol`). A partir de ahí ya pude validar que mis cambios no introducían regresión.

Donde tropecé fue al decidir dónde poner el join a `user:<id>`. En la primera iteración lo dejé sólo en `index.js` argumentando que el middleware sólo controla admisión y los rooms se gestionan post-`connection`. Cuando releí el criterio explícito ("Sala `user:<id>` en `index.js` y `socket-auth.js`") cambié de opinión y lo añadí también en el middleware. Ya que estaba, lo justifiqué como cierre de la race window entre el final del middleware y el `connection` event — si hubiese un emit a `user:<id>` en ese microhueco, ahora el socket ya está en la sala. El doble join es idempotente, así que sin coste.

El test multi-cliente fue lo que más me llevó. Monté el server en un puerto libre, mockeé `storage.service.js` con `jest.unstable_mockModule` (necesario porque el proyecto es ESM puro y los mocks tradicionales no aplican), y forcé el flujo de firma vía HTTP real con supertest. El truco para evitar flake fue esperar 200ms tras la respuesta del PATCH para que el bucle de Socket.IO entregara los eventos antes de las aserciones. Para asegurar que B no recibe el `:ack` registré una flag `bReceivedAck` y la verifico al final tras la ventana de espera. Funcionó al primer intento; los 102 tests pasan en ~26 s.
