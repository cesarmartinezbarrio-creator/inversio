# Cómo invitar a alguien

Cualquiera puede crear una cuenta en `ahorrainvierte.es/acceso.html`, pero
sin un código de invitación válido esa cuenta **no puede ni leer ni escribir
nada**. El candado está en PostgreSQL, no en la página: no se salta tocando
el navegador.

Así que invitar a alguien es exactamente esto: **crear un código y dárselo**.

---

## Crear un código

Supabase → **SQL Editor** → `Ctrl+A`, `Supr` → pegar → **Run**.

> **Códigos al azar, siempre.** Un código como `MARIA-2026` se adivina: el
> freno de 5 intentos por hora es por cuenta, y crear cuentas es gratis.
> Por eso el código lo inventa PostgreSQL (`INV-` + 8 caracteres al azar,
> unos 4.000 millones de combinaciones) y la nota es lo que te recuerda
> para quién era. Auditoría del 01/10/2026.

### Para una persona

```sql
insert into invitaciones (codigo, nota, caduca)
values ('INV-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)),
        'mi hermana', now() + interval '30 days')
returning codigo;
```

Un solo uso. **Copia el código que sale abajo** y dáselo. Cuando lo canjee,
queda gastado y ya no sirve para nadie más. Si a los 30 días no lo ha
usado, caduca solo.

### Para un grupo

```sql
insert into invitaciones (codigo, nota, usos_max, caduca)
values ('INV-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)),
        'los del grupo de senderismo', 5, now() + interval '30 days')
returning codigo;
```

Cinco altas como mucho, y deja de valer al mes aunque sobren usos. Poner
caducidad es buena costumbre: un código que circula por WhatsApp durante
años acaba en manos de cualquiera.

### Varios de golpe

```sql
insert into invitaciones (codigo, nota, caduca)
select 'INV-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)), n, now() + interval '30 days'
from unnest(array['mi padre', 'mi madre', 'el cuñado']) as n
returning codigo, nota;
```

**Los códigos no distinguen mayúsculas ni espacios sobrantes**: quien
escriba `inv-3f9a12bc` entra igual. Solo llevan números y las letras de la
A a la F, así que se dictan bien por teléfono.

---

## Ver cómo van

```sql
select codigo, nota, usos || '/' || usos_max as gastados, caduca, creado
  from invitaciones
 order by creado desc;
```

## Quién está dentro

```sql
select u.email, m.alta, m.codigo
  from miembros m
  join auth.users u on u.id = m.user_id
 order by m.alta desc;
```

---

## Retirar el acceso a alguien

```sql
delete from miembros where user_id = (
  select id from auth.users where email = 'quien-sea@ejemplo.com'
);
```

Deja de ver la aplicación **en el acto**, pero **sus datos siguen ahí**.
Si vuelve a entrar en gracia, se le añade otra vez a `miembros` y se
encuentra su cartera intacta. Es la diferencia entre cerrarle la puerta y
tirarle las cosas a la calle.

## Borrar una cuenta del todo (y sus datos)

```sql
delete from auth.users where email = 'quien-sea@ejemplo.com';
```

Esto sí es irreversible: el `on delete cascade` se lleva por delante su
perfil, sus datos y su membresía. Es lo que exige el RGPD cuando alguien
pide que le borres, y por eso está automatizado en vez de depender de que
alguien se acuerde.

## Anular un código que se ha escapado

```sql
update invitaciones set caduca = now() where codigo = 'INV-3F9A12BC';   -- el código que quieras anular
```

Los que ya lo canjearon siguen dentro; el código deja de servir a partir
de ese momento.

---

## Antes de invitar a nadie de verdad

Queda una cosa por hacer, y no es opcional: **configurar un SMTP propio en
Supabase y volver a activar la confirmación por correo**. Mientras esté
apagada, cualquiera puede registrarse con un correo que no es suyo, y la
recuperación de contraseña no funciona de forma fiable. Para tus pruebas da
igual; para tu familia, no.
