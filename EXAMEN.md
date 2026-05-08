# Examen — Reto F11: Salas WebSocket granulares y broadcast selectivo con confirmación

## Reto

F11 pide refinar el modelo pub/sub que ya existía en la API multi-tenant: hasta ahora cada socket sólo se unía a una sala por compañía y todos los miembros recibían los mismos eventos. El reto consiste en añadir una segunda granularidad — una sala personal `user:<id>` por socket — y usarla para enviar una confirmación dirigida (`deliverynote:signed:ack`) al usuario que dispara la acción, sin renunciar al broadcast a la compañía (`deliverynote:signed`).

El patrón aplicado es el clásico de pub/sub con dos canales superpuestos: un canal de novedad (broadcast a la "audiencia interesada", la compañía) y un canal de feedback (unicast al "actor", el firmante). La separación deja al cliente sin lógica de filtrado y mantiene el contrato del evento de novedad estable.

## Tarea técnica

- `ejercicios/practica/bildyapp-api/src/index.js:43-49` — En el handler `connection` mantengo el join a `company:<id>` (líneas 37-41) y añado un segundo `socket.join(\`user:${socket.user._id}\`)` con el mismo guard defensivo. Es el sitio correcto: el middleware `socketAuth` sólo controla admisión, los joins viven en el handler de conexión por separación de responsabilidades.
- `ejercicios/practica/bildyapp-api/src/middleware/socket-auth.js:38` — Tras `socket.user = user` y antes de `next()` añado un `socket.join(\`user:${user._id}\`)` defensivo. Cierra la race window entre el final del middleware y el handler `connection`: si una request HTTP emite a `user:<id>` justo en ese hueco, el socket ya está en la room. Es idempotente con el join canónico de `index.js` (Socket.IO deduplica memberships). El comentario de cabecera (líneas 8-15) queda actualizado para reflejar que el `user:<id>` vive en ambos sitios y que `company:<id>` se mantiene sólo en `index.js` por consistencia.
- `ejercicios/practica/bildyapp-api/src/controllers/deliverynote.controller.js:281-293` — Junto al `io.to(companyRoom).emit('deliverynote:signed', deliveryNote)` que ya existía añado un segundo emit `deliverynote:signed:ack` a la sala `user:<id>` con payload mínimo `{ deliveryNoteId, signedAt, signatureUrl }`. Mantengo el broadcast company-wide intacto.
- `ejercicios/practica/bildyapp-api/tests/socket.test.js` — Test integrador nuevo: levanta el server HTTP+Socket.IO en puerto libre, conecta dos clientes (A firmante, B observador) de la misma compañía, dispara `PATCH /api/deliverynote/:id/sign` desde A y verifica las tres aserciones (A recibe broadcast y ack, B recibe sólo broadcast). Mockea `storage.service.js` con `jest.unstable_mockModule` para que la firma se complete sin Supabase.
- `ejercicios/practica/bildyapp-api/package.json` — Añadido `socket.io-client` como devDependency para que el test pueda actuar como cliente real.

Bonus: arreglé también un commit previo que dejaba el árbol roto (`src/utils/{AppError,handleJwt,handlePassword}.js` y `src/middleware/{validate,role.middleware}.js` se importaban pero no existían en disco). Sin ellos los 101 tests no arrancaban.

## Respuestas socráticas

### 1. Socket join `company:<id>` con `socket.user.company._id` — usuario sin compañía

En `src/index.js:37-41` el join está protegido con `socket.user?.company?._id`. Si el usuario está autenticado pero no tiene compañía (estado real: en BildyApp un usuario se registra y verifica antes de crear compañía via `PATCH /api/user/company`), el optional chaining devuelve `undefined`, el `if` evalúa a falso y el socket queda **conectado pero sin joins** a `company:*`. El resultado es un socket "sordo" para los broadcasts de compañía: no recibirá `deliverynote:signed`, `deliverynote:new`, etc.

Hay dos caminos para mejorar esto:

1. **Rechazar la conexión en `socketAuth`**: en `src/middleware/socket-auth.js:26` ya populamos `company`. Bastaría añadir tras el chequeo de usuario un `if (!user.company) return next(new Error('Usuario sin compañía'))`. Lo bueno: el cliente recibe `connect_error` y sabe que aún no puede usar features colaborativas. Lo malo: rompe casos donde un usuario recién verificado quiere recibir push genéricos (notificaciones de bienvenida, p.ej. en su sala `user:<id>`).
2. **Asignar a una sala default `users:no-company`**: el socket queda admitido y puede recibir mensajes que no dependen de la compañía. La política de qué eventos viajan ahí pasa a ser explícita. Es menos restrictivo y compatible con la sala `user:<id>` que añadimos.

En la práctica, dado que ya añadimos `user:<id>` tanto en `src/middleware/socket-auth.js` (defensivo) como en `src/index.js:43-49` (canónico), el usuario sin compañía aún recibe sus `:ack` privados — sólo se pierde el feed compartido. Es un comportamiento aceptable mientras la UI explique que para colaborar hay que crear/unirse a una compañía.

### 2. `deliverynote:signed` a toda la compañía vs `:ack` al `user:<id>`

El broadcast a `company:<id>` y el ack al `user:<id>` cumplen funciones distintas y por eso son dos eventos:

- **`deliverynote:signed`** notifica una novedad de dominio: "el albarán X pasó a firmado". Llega a todos los miembros de la compañía para que sus listas, contadores y dashboards reaccionen. Es el equivalente a "alguien acaba de hacer algo que te interesa porque comparten contexto".
- **`deliverynote:signed:ack`** confirma una acción: "tu petición de firmar X terminó bien". Es feedback dirigido al actor: cierra spinners, muestra toast de éxito, redirige.

El frontend **podría** filtrar el broadcast por `event.user === self.id` para emular el ack, pero tiene dos costes: (a) el payload del broadcast tiene que llevar siempre el campo `user` (acopla el contrato del evento a un caso de uso del cliente), y (b) cada cliente repite la misma lógica de filtrado. Con el `:ack` en sala personal el server hace el routing y el cliente recibe sólo lo que le incumbe. El payload del broadcast queda libre de "metadatos para discriminar destinatarios" y sigue describiendo sólo el cambio de estado.

Trade-off: duplicas un emit en el server. Pero ese emit es barato (Socket.IO indexa rooms en O(1)) y el ahorro de complejidad en el cliente compensa.

### 3. Socket.IO acknowledgements (callbacks en emit). Escenario en `signDeliveryNote` y contrato

Socket.IO ofrece otro mecanismo además del evento separado: el **callback en el `emit`**. El cliente puede mandar el último argumento como función y el server la invoca con la respuesta. Diseño aplicable al firmado:

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
    // y aparte broadcast a la sala
    io.to(`company:${socket.user.company._id}`).emit('deliverynote:signed', note)
  } catch (err) {
    ack({ ok: false, error: err.message })
  }
})
```

Útil cuando el cliente **necesita confirmación inmediata atada a su request específico** sin re-leer estado por HTTP. Diferencia clave con un evento broadcast separado:

- El **callback** está vinculado 1:1 al emit que lo originó. Aunque lleguen otros eventos `deliverynote:signed` mientras esperamos, el callback sólo se dispara para *esta* petición. Evita race conditions cuando varias firmas concurren.
- Un **evento separado** (`:ack`) es genérico: cualquier `:ack` que llegue a la sala personal hay que correlacionarlo a la petición original (con un `requestId`, normalmente).

En BildyApp la firma se hace por HTTP (`PATCH /api/deliverynote/:id/sign`) con `multipart/form-data` por la subida de imagen, así que el ack como callback de Socket.IO no aplica directamente. Por eso el `:ack` separado encaja mejor: el actor refresca la UI cuando el HTTP responde **y** cuando Socket.IO le confirma que el broadcast partió.

### 4. `verifyToken` devuelve null vs throw — `next(new Error())` vs no llamar `next()`

En `src/utils/handleJwt.js:21-27` la convención del repo es que `verifyToken` devuelve `null` ante token inválido (atrapa el `JsonWebTokenError`/`TokenExpiredError` internamente). Por eso en `src/middleware/socket-auth.js:19-22` el chequeo es `if (!decoded?._id) return next(new Error('Token inválido'))` y no un `try/catch` alrededor de `verifyToken`.

En Socket.IO los middlewares funcionan así:

- `next()` sin argumentos → la conexión se acepta, el handler `connection` se ejecuta.
- `next(new Error('msg'))` → la conexión se rechaza. El cliente recibe un evento `connect_error` cuyo `err.message` es el `msg` que pasamos. El server libera el handshake inmediatamente.
- **No llamar `next()`** → desastre. El handshake queda colgado: el cliente sigue esperando indefinidamente (hasta su timeout interno), el server mantiene la transacción TCP abierta y el slot del middleware ocupado. Memory leak de baja intensidad si pasa repetidamente.

Comparado con Express: en Express `next(err)` salta al error handler global que devuelve un 4xx/5xx; en Socket.IO `next(err)` es el equivalente directo a "rechaza esta conexión con esta razón". No hay error handler global de sockets, el `err.message` se serializa tal cual al cliente, así que las cadenas tienen que ser informativas pero no filtrar internals.

### 5. `socket.to(room)` vs `io.to(room)` — ¿el creador recibe su propio evento?

Diferencia exacta:

- `socket.to(room).emit(...)` — emite a todos los sockets de `room` **excepto** al socket que ejecuta la llamada. Útil cuando estás dentro de un handler de evento del propio socket y no quieres devolverle el eco.
- `io.to(room).emit(...)` — emite a todos los sockets de `room` **incluido** el emisor si pertenece a la sala. No tiene noción de "quién originó" porque `io` es global.

En BildyApp el `createClient` haría `req.app.locals.io.to(\`company:${req.user.company}\`).emit('client:new', ...)`. El usuario que crea el cliente, si tiene un socket abierto, **sí recibe su propio `client:new`** (su socket está en la sala). Hipótesis de UI:

- Si la UI inserta el cliente optimísticamente al recibir el 201 HTTP, recibir además el `client:new` por sockets duplica la entrada en la lista. Soluciones:
  - El cliente filtra por algún id (ej. `event.createdBy === currentUser._id`).
  - El cliente envía un `requestId` opaco con el POST y el server lo incluye en el evento; el cliente ignora eventos cuyo `requestId` ya tiene en su cola optimística.
  - En general, idempotencia por `_id` de Mongo: si el item ya existe en el estado local, ignora el evento.

¿Por qué este repo usa `io.to(...)` desde controllers HTTP en vez de `socket.to(...)`? Porque los controllers HTTP **no tienen acceso al socket originador** (la petición no viaja por Socket.IO). Sólo conocen `req.user` y `req.app.locals.io`. `socket.to(...)` requiere estar dentro de un handler de un evento de socket. Si quisiéramos excluir al actor del broadcast, una opción es pasar el id del usuario al evento y filtrar en el cliente; otra es no emitir desde el controller HTTP y hacerlo en respuesta a un evento de socket (cambiar arquitectura). En BildyApp se asume "el frontend deduplica si hace falta", que es lo más simple para una API REST con eventos colaborativos opcionales.

## Proceso

Empecé leyendo `index.js`, `socket-auth.js` y `deliverynote.controller.js` enteros para alinearme con la convención (joins en `connection`, emits desde controllers vía `req.app.locals.io`, payloads que son el documento entero o un subset según necesidad). La línea ~145 del enunciado del profesor era aproximada: el emit real está en la 282 del controller. Detecté que el árbol del repo estaba roto — `src/utils/*.js` y dos middlewares no existían pese a estar importados, ningún test podía arrancar — así que primero hice un commit `fix(bildyapp-api):` restaurando esos ficheros desde la versión anterior del proyecto (los tests originales pasan, 101/101). En una primera iteración dejé el join sólo en `index.js` argumentando separación de responsabilidades; tras revisar el criterio explícito ("Sala `user:<id>` en `index.js` y `socket-auth.js`") decidí poner el join también en el middleware para cumplirlo y, de paso, cerrar la race window entre middleware y `connection` event. Es idempotente, así que el doble join no introduce regresión. El test multi-cliente fue lo que más cuidado requirió: monté el server en un puerto libre, mockeé Supabase con `jest.unstable_mockModule` (necesario por el ESM puro del proyecto), y forcé el flujo de firma vía HTTP real con supertest, esperando 200ms tras el response para que el bucle de Socket.IO entregara los eventos antes de assertar.
