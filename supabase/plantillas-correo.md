# Plantillas de correo

Las de fábrica de Supabase están en inglés, no dicen quién escribe ni por
qué, y eso es justo lo que hace que Gmail las mire con recelo y que la
gente no las abra. Estas están en español, con tu marca, y dicen en la
primera línea qué hay que hacer.

**Dónde se ponen:** Supabase → **Authentication** → **Emails** →
**Templates**. Hay una pestaña por cada tipo de correo. Para cada una:
cambia el **Subject** y pega el HTML en el cuadro de abajo. **Save**.

Lo que va entre `{{ ... }}` lo rellena Supabase al enviar. No lo toques ni
lo traduzcas: `{{ .ConfirmationURL }}` es el enlace de verdad.

---

## 1 · Confirm signup (confirmar la cuenta)

**Subject:**

```
Confirma tu cuenta de Cuentas y Cartera
```

**Message body:**

```html
<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0B2E29;max-width:520px;margin:0 auto;padding:8px">
  <p style="font-size:18px;font-weight:600;margin:0 0 18px">Ya casi está</p>

  <p style="margin:0 0 16px">
    Alguien —esperamos que tú— ha creado una cuenta en
    <strong>Cuentas y Cartera</strong>, la aplicación de ahorro e inversión
    de ahorrainvierte.es. Para terminar, confirma que este correo es tuyo:
  </p>

  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;
              padding:13px 26px;border-radius:100px;font-weight:600">
      Confirmar mi correo
    </a>
  </p>

  <p style="margin:0 0 16px">
    Después podrás entrar con tu correo y tu contraseña. Ten a mano el
    código de invitación: te lo pediremos una vez más al entrar.
  </p>

  <p style="margin:0 0 16px;color:#586D64;font-size:13px">
    Si el botón no funciona, copia esta dirección en tu navegador:<br>
    <span style="word-break:break-all">{{ .ConfirmationURL }}</span>
  </p>

  <hr style="border:none;border-top:1px solid #E2D8C9;margin:26px 0">

  <p style="margin:0;color:#586D64;font-size:13px">
    Si no has sido tú, no hagas nada: sin confirmar este correo, la cuenta
    no sirve para nada y se queda vacía.
  </p>
</div>
```

---

## 2 · Reset password (recuperar la contraseña)

**Subject:**

```
Recupera tu contraseña de Cuentas y Cartera
```

**Message body:**

```html
<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0B2E29;max-width:520px;margin:0 auto;padding:8px">
  <p style="font-size:18px;font-weight:600;margin:0 0 18px">Cambiar la contraseña</p>

  <p style="margin:0 0 16px">
    Has pedido cambiar la contraseña de tu cuenta de
    <strong>Cuentas y Cartera</strong>. Pulsa aquí y elige una nueva:
  </p>

  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;
              padding:13px 26px;border-radius:100px;font-weight:600">
      Elegir una contraseña nueva
    </a>
  </p>

  <p style="margin:0 0 16px;color:#586D64;font-size:13px">
    Este enlace caduca en una hora y solo se puede usar una vez.
  </p>

  <p style="margin:0 0 16px;color:#586D64;font-size:13px">
    Si el botón no funciona, copia esta dirección en tu navegador:<br>
    <span style="word-break:break-all">{{ .ConfirmationURL }}</span>
  </p>

  <hr style="border:none;border-top:1px solid #E2D8C9;margin:26px 0">

  <p style="margin:0;color:#586D64;font-size:13px">
    <strong>Si no has sido tú</strong>, ignora este mensaje: tu contraseña
    actual sigue funcionando y nadie ha entrado en tu cuenta. Nadie puede
    cambiarla sin abrir este correo.
  </p>
</div>
```

---

## 3 · Change Email Address (cambiar el correo de la cuenta)

**Subject:**

```
Confirma tu nuevo correo en Cuentas y Cartera
```

**Message body:**

```html
<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0B2E29;max-width:520px;margin:0 auto;padding:8px">
  <p style="font-size:18px;font-weight:600;margin:0 0 18px">Confirma tu nuevo correo</p>

  <p style="margin:0 0 16px">
    Has pedido cambiar la dirección de correo de tu cuenta de
    <strong>Cuentas y Cartera</strong> a <strong>{{ .Email }}</strong>.
    Confirma que es tuya:
  </p>

  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}"
       style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;
              padding:13px 26px;border-radius:100px;font-weight:600">
      Confirmar este correo
    </a>
  </p>

  <p style="margin:0;color:#586D64;font-size:13px">
    Hasta que no lo confirmes, se sigue usando la dirección anterior. Si no
    has pedido este cambio, ignora el mensaje y avisa a quien te invitó.
  </p>
</div>
```

---

## Por qué están escritos así

- **En español y con el nombre de la aplicación en la primera línea.** Un
  correo que no dice quién escribe parece un fraude, y tanto Gmail como las
  personas lo tratan como tal.
- **Un solo botón, y el enlace también en texto.** Hay clientes de correo
  que no pintan botones; el enlace suelto siempre funciona.
- **Sin imágenes ni logotipos.** Cada imagen es una petición a un servidor
  externo y un motivo más para acabar en spam. Con texto y color sobra.
- **Explican qué hacer si no has sido tú.** Es lo que distingue un correo
  legítimo de uno sospechoso, y lo que evita sustos.
- **Nada de mayúsculas, urgencias ni exclamaciones.** Es el vocabulario de
  los correos basura y los filtros lo tienen bien aprendido.

## Y un aviso para cuando invites

Los primeros correos a Gmail o a Outlook pueden caer en spam: el dominio es
nuevo y aún no se ha ganado la confianza. Avisa a quien invites de que mire
ahí y marque **"No es spam"** — cada vez que alguien lo hace, el siguiente
correo lo tiene más fácil. En unas semanas de uso normal deja de pasar.
