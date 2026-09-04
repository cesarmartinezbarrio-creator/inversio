# Cómo invitar a alguien

Cualquiera puede crear una cuenta en `ahorrainvierte.es/acceso.html`, pero
sin un código de invitación válido esa cuenta **no puede ni leer ni escribir
nada**. El candado está en PostgreSQL, no en la página: no se salta tocando
el navegador.

Así que invitar a alguien es exactamente esto: **crear un código y dárselo**.

---

## Crear un código

Supabase → **SQL Editor** → `Ctrl+A`, `Supr` → pegar → **Run**.

### Para una persona

```sql
insert into invitaciones (codigo, nota)
values ('MARIA-2026', 'mi hermana');
```

Un solo uso. Cuando María lo canjee, el código queda gastado y ya no sirve
para nadie más.

### Para un grupo, y con fecha de caducidad

```sql
insert into invitaciones (codigo, nota, usos_max, caduca)
values ('AMIGOS-OCT', 'los del grupo de senderismo', 5, now() + interval '30 days');
```

Cinco altas como mucho, y deja de valer al mes aunque sobren usos. Poner
caducidad es buena costumbre: un código que circula por WhatsApp durante
años acaba en manos de cualquiera.

### Varios de golpe

```sql
insert into invitaciones (codigo, nota) values
  ('PADRE-2026',  'mi padre'),
  ('MADRE-2026',  'mi madre'),
  ('CUNADO-2026', 'el cuñado, que pregunta mucho');
```

**Los códigos no distinguen mayúsculas ni espacios sobrantes**: quien
escriba `maria-2026` o ` MARIA-2026 ` entra igual. Elige códigos fáciles de
dictar por teléfono y sin caracteres raros.

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
update invitaciones set caduca = now() where codigo = 'AMIGOS-OCT';
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
