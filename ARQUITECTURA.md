# Arquitectura: de una persona a varias

Plan técnico para convertir Cuentas y Cartera en una aplicación multiusuario
con cuentas propias, verificación en dos pasos y aislamiento real entre
perfiles.

Este documento explica **qué se va a construir y por qué**. El análisis de
amenazas y las contramedidas están en [`SEGURIDAD.md`](./SEGURIDAD.md).

Fecha: septiembre de 2026. Estado: **plan aprobado, sin ejecutar todavía.**

---

## 1 · De dónde partimos

Hoy la aplicación funciona así:

```
Navegador
   │  token compartido (APP_TOKEN), el mismo para todo el mundo
   ▼
Vercel  ──── clave service_role (poderes absolutos) ────►  Supabase
   │                                                        tabla estado
   └─── claves de API ───►  Twelve Data · Alpha Vantage · Crypto.com        1 fila
```

Funciona y es sólido para un solo usuario, pero tiene tres límites que
impiden crecer:

**Un único secreto para todo.** El `APP_TOKEN` no identifica a nadie: quien
lo tenga, lo puede todo. No se puede revocar a una persona sin revocárselo a
todas, no hay forma de saber quién hizo qué, y no caduca nunca.

**Una llave maestra en el camino de los datos.** El backend usa la clave
`service_role` de Supabase, que se salta todas las reglas de la base de
datos por diseño. Si esa clave se filtrara, se filtraría todo. Hoy la única
cosa que impide que un usuario vea los datos de otro es que **no hay otro
usuario**; en cuanto los haya, la separación dependería de que mi código
filtre bien en cada consulta. Eso es una garantía frágil: basta un `where`
olvidado en una función nueva.

**Una sola fila.** La tabla `estado` guarda un único registro con id
`principal`. No hay sitio donde poner a un segundo usuario.

---

## 2 · A dónde vamos

```
Navegador (PWA instalable)
   │
   ├──► Supabase Auth  ·  correo + contraseña + código TOTP
   │        devuelve un JWT que identifica a ESE usuario
   │
   ├──► Supabase (PostgREST) con ese JWT
   │        RLS: PostgreSQL solo devuelve las filas de ese usuario
   │
   └──► Vercel /api/mercado con ese mismo JWT
            valida quién eres, aplica tu límite de uso, y llama a las
            APIs de bolsa con las claves que siguen escondidas allí
```

Tres cambios de fondo, y conviene entender el porqué de cada uno.

### 2.1 · La autenticación no la escribimos nosotros

Se usa **Supabase Auth**, que ya trae contraseñas con hash, sesiones con
caducidad y refresco, recuperación por correo y
[verificación en dos pasos con TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp)
— el código de seis dígitos de Google Authenticator, con su QR y todo.

No es pereza: guardar contraseñas correctamente significa acertar a la vez
en el algoritmo de hash y su coste, en la resistencia a ataques de
temporización, en no filtrar por el mensaje de error si un correo existe, en
que el enlace de recuperación no se convierta en una puerta trasera, y en
limitar los intentos. Cada uno de esos problemas está resuelto desde hace
veinte años y cada uno es fácil de hacer sutilmente mal. Y en autenticación,
"sutilmente mal" significa que parece funcionar perfectamente hasta el día
que no.

### 2.2 · El aislamiento lo hace PostgreSQL, no mi código

Este es el punto importante del documento.

La separación entre usuarios **no** se implementa filtrando en el backend.
Se implementa con **Row Level Security**: unas políticas escritas en la base
de datos que comparan `auth.uid()` (el usuario del JWT, que PostgreSQL lee
por su cuenta) con la columna `user_id` de cada fila.

La diferencia práctica:

| | Filtrar en el código | RLS en la base de datos |
|---|---|---|
| Quién garantiza el aislamiento | El programador, en cada consulta | PostgreSQL, siempre |
| Si hay un fallo en una consulta nueva | Se filtran datos de otro usuario | La base de datos no devuelve nada |
| Si alguien ejecuta `select * from tabla` | Lo devuelve todo | Devuelve solo lo suyo |
| Tipo de garantía | "Hemos tenido cuidado" | "Es imposible" |

Para el requisito de *"sin que los demás tengan acceso por ningún motivo"*,
solo la segunda columna lo cumple literalmente.

### 2.3 · El backend adelgaza

`api/estado.js` **desaparece**. El navegador habla directamente con Supabase
usando el JWT del usuario y la clave pública (`anon`), que no sirve para
nada por sí sola porque RLS la deja sin permisos.

Con eso, **la clave `service_role` sale del camino de los datos**. Ya no hay
ninguna credencial en circulación que pueda leerlo todo.

El backend de Vercel se queda con **un único trabajo**: llamar a las APIs de
mercado escondiendo sus claves. Que es la única razón por la que existía.

---

## 3 · El modelo de datos

Una fila por usuario, con la clave primaria apuntando al usuario de Supabase:

```sql
create table perfiles_estado (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  json        jsonb       not null,
  actualizado timestamptz not null default now()
);

alter table perfiles_estado enable row level security;
```

El `on delete cascade` es deliberado: si se borra la cuenta, se borran sus
datos automáticamente. Es lo que exige el RGPD y así no depende de que
alguien se acuerde.

### Las políticas

```sql
create policy "leer solo lo propio"
  on perfiles_estado for select
  using ( (select auth.uid()) = user_id );

create policy "crear solo lo propio"
  on perfiles_estado for insert
  with check ( (select auth.uid()) = user_id );

create policy "actualizar solo lo propio"
  on perfiles_estado for update
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );
```

Fíjate en que la de actualizar lleva las dos cláusulas: `using` decide qué
filas puedes tocar, y `with check` impide que, al actualizar, cambies el
`user_id` para regalarle tu fila a otro. Sin la segunda, la política tendría
un agujero.

### Y los permisos, que ya nos mordieron una vez

```sql
grant select, insert, update on public.perfiles_estado to authenticated;
```

Esta línea es la que faltó en el despliegue de septiembre y costó media
tarde de diagnóstico (ver [`AVERIAS.md`](./AVERIAS.md), avería nº 4).
Supabase ya no concede permisos automáticamente a los roles del sistema
sobre las tablas nuevas. **Sin esto, RLS da igual: PostgreSQL rechaza antes
de llegar a mirar las políticas.**

### Exigir el segundo factor desde la propia base de datos

Supabase permite escribir políticas que
[comprueban el nivel de autenticación](https://supabase.com/blog/mfa-auth-via-rls):
`aal1` es una sesión con contraseña, `aal2` una que además pasó el código de
seis dígitos.

```sql
create policy "leer solo lo propio y con 2FA si lo tiene activado"
  on perfiles_estado for select
  using (
    (select auth.uid()) = user_id
    and array[(select auth.jwt()->>'aal')] <@ (
      select case
        when count(id) > 0 then array['aal2']          -- tiene 2FA: exígelo
        else array['aal1','aal2']                       -- no lo tiene: pasa
      end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );
```

Se lee así: *puedes leer tus filas; y si has activado el 2FA, solo si esta
sesión lo ha superado*. La parte del `case` evita dejar fuera a quien
todavía no lo ha configurado.

Esto tiene una consecuencia que parece menor y no lo es. Cuando alguien usa
"he olvidado mi contraseña", Supabase le da una sesión `aal1`. Con esta
política, **esa sesión sigue sin poder leer nada** hasta que meta el código
del móvil. Es decir: quien controle el correo de un usuario **no** puede
llegar a sus datos. En la mayoría de las aplicaciones, el 2FA es decorativo
precisamente porque el "he olvidado mi contraseña" lo puentea. Aquí no,
porque la comprobación no está en la pantalla de login: está dentro de la
base de datos.

---

## 4 · El proxy de mercado

`api/mcp-proxy.js` se conserva, pero cambia en tres cosas.

**Pasa a validar identidades en vez de un secreto compartido.** Recibe el
JWT del usuario y lo verifica llamando a `GET {SUPABASE_URL}/auth/v1/user`
con ese token. Si contesta 200, el token es bueno y de paso devuelve quién
es. Existe la alternativa de verificar la firma localmente con el secreto
JWT del proyecto —más rápida, sin viaje de red— pero obliga a comprobar a
mano el algoritmo, la caducidad y el emisor, que son tres formas más de
equivocarse. Para el volumen de esta app, la llamada de red sale a cuenta.

**Cachea los precios en común.** Un detalle que multiplica la cuota
gratuita: el precio de Apple es el mismo para todos los usuarios. Guardando
cada símbolo con su hora en una tabla y sirviendo de ahí lo que tenga menos
de X minutos, cinco personas mirando las mismas acciones consumen **una**
petición, no cinco. Esta tabla es la excepción a todo lo demás: **no es
dato personal, es dato público de mercado**, y por eso puede ser común.

```sql
create table precios_cache (
  simbolo     text primary key,
  precio      numeric not null,
  moneda      text,
  actualizado timestamptz not null default now()
);
```

**Lleva la cuenta por usuario.** Alpha Vantage da unas 25 peticiones al día
en total. Sin un límite por persona, el primero que abra la app se las come
y los demás se quedan sin tipo de cambio. Hace falta una tabla de contadores
diarios y un tope por usuario.

---

## 5 · Registro de usuarios

Para el alcance decidido —familia y amigos, sin descartar abrirlo— la
recomendación es **registro cerrado**: el registro público desactivado en
Supabase, y las cuentas creadas a mano desde el panel.

Ventajas: nadie puede darse de alta solo, no hace falta verificación de
correo ni protección contra registros automáticos, y no hay riesgo de que
alguien te llene la base de datos. Se revierte en cualquier momento si algún
día se abre al público, y entonces habrá que añadir verificación por correo,
límites por IP y una política de privacidad publicada.

---

## 6 · Plan de migración

Siete etapas. Cada una deja la aplicación **funcionando**: no hay ningún
momento en que esté a medias y rota.

| # | Etapa | Qué se hace | Riesgo |
|---|---|---|---|
| **0** | Preparar | 2FA en las cuentas de Supabase, Vercel y GitHub. Exportar la fila actual de `estado` como copia de seguridad | Ninguno |
| **1** | Tabla nueva | Crear `perfiles_estado` con sus políticas y permisos, **junto a** la vieja. Nada la usa todavía | Ninguno |
| **2** | Pantalla de login | Añadir el cliente de Supabase al frontend y construir el login. La app sigue funcionando con el token viejo mientras tanto | Bajo |
| **3** | Mudanza | Crear tu usuario y copiar tus datos de la fila `principal` a tu fila | Bajo, con copia hecha |
| **4** | Cambiar el grifo | El frontend pasa a leer y escribir contra Supabase directamente. Se borra `api/estado.js` | Medio |
| **5** | Proxy con identidad | `mcp-proxy` valida JWT, cachea precios y limita por usuario. Se elimina `APP_TOKEN` | Medio |
| **6** | Segundo factor | Pantalla de alta de TOTP, y cambiar las políticas a la versión que exige `aal2` | Bajo |
| **7** | Cierre | Cabecera CSP, repaso de seguridad completo, alta del resto de usuarios | Bajo |

Las etapas 4 y 5 son las delicadas porque cambian por dónde van los datos.
En ambas conviene desplegar, comprobar de punta a punta con la consola del
navegador (como en `AVERIAS.md`) y solo entonces borrar el camino viejo.

---

## 7 · Qué desaparece por el camino

Vale la pena verlo junto, porque el resultado es **menos** piezas que ahora:

- ~~`APP_TOKEN`~~ — lo sustituyen las cuentas de verdad.
- ~~`api/estado.js`~~ — el navegador habla con Supabase directamente.
- ~~La clave `service_role` en el camino de los datos~~ — deja de existir el
  secreto que lo abre todo.
- ~~La contraseña de directorio de Hostinger~~ — ya retirada en septiembre;
  además impedía instalar la PWA.
- ~~El `window.prompt()` de la contraseña~~ — lo sustituye una pantalla de
  entrada con el estilo de la app.

Queda una sola contraseña, la del usuario, más el código del móvil.
