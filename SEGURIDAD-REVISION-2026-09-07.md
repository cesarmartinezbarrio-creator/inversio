# Revisión de seguridad · 7 de septiembre de 2026

Ataque real, no repaso teórico. Lo que lleva un ✓ **se ha comprobado en
producción** (ahorrainvierte.es + Supabase + Vercel) o contra el código real,
no supuesto. Lo que lleva ⚠️ hay que arreglarlo o confirmarlo.

---

## Veredicto en una línea

**No hay ninguna brecha de datos.** Nadie puede leer ni escribir la cartera o
la economía de otra persona: lo probé desde fuera y la base de datos lo niega
todo. Quedan **dos cosas de riesgo medio** que no filtran datos pero sí pueden
costarte cuota o dejar una puerta entornada, y un par de detalles menores.

---

## Lo que aguantó el ataque (la parte tranquilizadora)

Todo esto lo lancé de verdad, desde tu propio navegador contra el servidor de
producción, usando solo la clave pública (la que cualquiera ve en el código de
la página):

- ✓ **Leer los datos de todos** (`perfiles_estado`) sin sesión → `401 permiso denegado`.
- ✓ **Leer quién tiene acceso** (`miembros`) → `401`.
- ✓ **Leer los códigos de invitación** (`invitaciones`) → `401`. No se pueden listar.
- ✓ **Leer o envenenar la caché de precios** (`precios_cache`, `uso_diario`) → `401`.
- ✓ **Escribir en la ficha de otro usuario** (INSERT con un `user_id` ajeno) → `401`.
- ✓ **Llamar a las funciones internas** (`canjear_invitacion`, `consume_peticion`, `limpia_cache`) como anónimo → `401`.
- ✓ **La puerta vieja está cerrada**: la tabla `estado` ya no existe (`404`), y su copia de seguridad está bajo llave.
- ✓ **La API de mercado** (Vercel) sin token → `401`; con un token basura → `401`. No deja pasar a nadie sin sesión válida.
- ✓ **XSS**: metí `<script>`, `<img onerror>` y seis payloads más en nombres de
  categoría, conceptos de tique y en un JSON de carga entero. **Ninguno se
  ejecutó**; todos salen como texto. Cada dato de usuario pasa por `esc()`.
- ✓ **Estrés**: 5.000 apuntes en una categoría (se pinta en 123 ms), importes
  gigantes e infinitos, un nombre de 20.000 letras, 10 JSON malformados y un
  intento de *prototype pollution* → la app no se cae ni se envenena.
- ✓ **Cabeceras en producción**: CSP, HSTS, X-Frame-Options DENY, nosniff,
  Referrer-Policy y Permissions-Policy, todas presentes y correctas.
- ✓ **CORS**: pedí permiso desde un origen falso (`evil.example.com`) → el
  servidor no lo reconoce, el navegador lo bloquea.
- ✓ **El correo hay que confirmarlo** antes de que la cuenta sirva
  (`mailer_autoconfirm` desactivado).
- ✓ **En el frontend no hay ningún secreto de servidor** (ni service_role, ni
  claves de las APIs de mercado). Solo la clave pública, que es pública a propósito.

El diseño de fondo es el correcto: **la seguridad vive en PostgreSQL (RLS con
`auth.uid()`), no en la página**. Aunque alguien reescriba el JavaScript del
navegador, la base de datos sigue diciendo que no.

---

## ⚠️ Lo que hay que arreglar o confirmar

### 1 · [MEDIA] Los códigos de invitación son adivinables y no hay límite de intentos

**El problema.** El registro está abierto a cualquiera (`disable_signup: false`).
Con confirmar un correo —cualquiera vale— ya tienes una sesión válida, y con
ella se puede llamar a `canjear_invitacion` **tantas veces como quieras, sin
freno**. Y los códigos son del tipo `CESAR-2026`, `FAMILIA-2026`: se adivinan.
Alguien podría probar códigos hasta colarse.

**Qué gana el atacante si acierta:** se hace miembro. **No** ve datos de nadie
(eso lo sigue impidiendo RLS), pero sí puede gastar tu cuota diaria de las APIs
de mercado (300 consultas/día que pagas tú) y ocupar sitio.

**Arreglo:**
- Genera códigos **aleatorios**, no memorizables. Por ejemplo:
  `select 'INV-' || upper(substr(md5(gen_random_uuid()::text),1,10));`
- Baja `usos_max` a 1 y ponles caducidad (`caduca`) a todos.
- Si la app es solo por invitación, valora **cerrar el registro abierto** en
  Supabase (Auth → Providers → desactivar signups) y dar de alta tú las cuentas.
- Opcional pero bueno: un límite de intentos de canje por usuario/día.

### 2 · [MEDIA · CONFIRMAR] La puerta de servicio `APP_TOKEN` puede seguir abierta

**El problema.** La API de mercado todavía reconoce un **token único compartido**
(`APP_TOKEN`, modo «legado» en `api/_common.js`) que salta la comprobación de
membresía. Ese token se ha pegado en conversaciones y navegadores: hay que darlo
por conocido. El paso 4 de `cerrar-puerta-vieja.sql` (borrarlo en Vercel) era
**manual**; no puedo verificar desde aquí si se hizo.

**Qué gana quien lo tenga:** consumir tu cuota de las APIs de mercado sin cuenta.
Ya no puede leer datos (la tabla `estado` no existe), pero sí gastarte dinero.

**Arreglo:**
- En Vercel → Settings → Environment Variables → **borrar `APP_TOKEN`** y
  redesplegar. (Si ya lo hiciste, este punto queda cerrado.)
- En el código: quitar la rama «legado» de `identifica()` y la función muerta
  `compruebaToken()` de `api/_common.js` (ya no la usa nadie), para que la puerta
  no exista ni en el código.

### 3 · [BAJA] El contador de cuota se abre si falla (fail-open)

`consumePeticion` deja pasar la petición si el contador da error («un contador
roto no debe dejar la app inservible»). Es una decisión razonable para la
comodidad, pero significa que si alguien tumba esa función, el límite diario
desaparece. No es una brecha; es un matiz. Al contrario, `esMiembro` falla al
revés (si hay error, te deja fuera): correcto para seguridad, pero un hipo de la
base de datos puede echar a un usuario legítimo. Déjalo documentado y decide con
los ojos abiertos.

### 4 · [BAJA] `'unsafe-inline'` en la CSP

Es inevitable con la app en un solo fichero, y está asumido. El riesgo real es
bajo **porque** todo dato de usuario pasa por `esc()`. La consecuencia: la CSP no
te salvaría si una edición futura colara un dato sin escapar en el HTML. Mantén
la disciplina de `esc()` como hasta ahora; es tu verdadera defensa contra XSS.

### 5 · [INFO] Sin doble factor todavía

El TOTP es la etapa 6, pendiente. Para el modelo de amenaza actual está bien;
apúntalo para más adelante.

---

## Cómo confirmar el estado tú mismo

En el editor SQL de Supabase, ejecuta `supabase/revision-seguridad.sql`: te dice
tabla por tabla si tiene el candado echado y si `anon` aparece donde no debe
(no debe aparecer en ninguna). Es solo lectura, no cambia nada.
