# Plantillas de correo

Las de fábrica de Supabase están en inglés, sin marca y sin explicar quién
escribe: es justo lo que hace que Gmail desconfíe y que la gente no las
abra. Estas llevan cabecera con el nombre, cuerpo en tarjeta y pie con el
dominio, en los colores de la aplicación.

**Dónde se ponen:** Supabase → **Authentication** → **Emails** →
**Templates**. Una pestaña por tipo de correo: cambia el **Subject**, pega
el HTML en el cuadro grande, **Save**. Tres veces y listo.

Lo que va entre `{{ ... }}` lo rellena Supabase al enviar. **No lo toques
ni lo traduzcas**: `{{ .ConfirmationURL }}` es el enlace de verdad.

> ⚠️ Antes de nada: Supabase → **Authentication** → **URL Configuration** →
> **Site URL** = `https://ahorrainvierte.es`. Si ahí sigue el `localhost:3000`
> de fábrica, los enlaces de estos correos no llevan a ninguna parte.

---

## 1 · Confirm signup

**Subject:**

```
Confirma tu cuenta · Cuentas y Cartera
```

**Message body:**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EAE0;margin:0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F4EC;border-radius:16px;overflow:hidden;border:1px solid #E2D8C9">

    <tr><td style="background:#0B322D;padding:22px 28px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:10px;vertical-align:middle">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:4px;height:10px;background:#E4622A;font-size:0">&nbsp;</td>
            <td style="width:3px">&nbsp;</td>
            <td style="width:4px;height:16px;background:#E4622A;font-size:0">&nbsp;</td>
            <td style="width:3px">&nbsp;</td>
            <td style="width:4px;height:22px;background:#E4622A;font-size:0">&nbsp;</td>
          </tr></table>
        </td>
        <td style="vertical-align:middle">
          <div style="color:#F2EDE3;font-size:18px;font-weight:700;letter-spacing:-.3px">Cuentas y Cartera</div>
          <div style="color:#8CA69D;font-size:12px;margin-top:2px">Tu economía y tu cartera, en un sitio que es tuyo</div>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:32px 28px 8px">
      <div style="font-size:21px;font-weight:700;color:#0B2E29;margin-bottom:14px">Ya casi está</div>
      <div style="font-size:15px;line-height:1.6;color:#3D5C56">
        Has creado una cuenta en <strong>Cuentas y Cartera</strong>. Solo falta
        confirmar que este correo es tuyo:
      </div>
    </td></tr>

    <tr><td align="center" style="padding:26px 28px 22px">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;
                padding:14px 34px;border-radius:100px;font-size:15px;font-weight:700">
        Confirmar mi correo
      </a>
    </td></tr>

    <tr><td style="padding:0 28px 24px">
      <div style="background:#EAE1D4;border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.55;color:#3D5C56">
        Después entra con tu correo y tu contraseña. <strong>Ten a mano el código
        de invitación</strong>: te lo pediremos una vez más al entrar.
      </div>
    </td></tr>

    <tr><td style="padding:0 28px 26px;font-size:12.5px;line-height:1.55;color:#586D64">
      Si el botón no funciona, copia esta dirección en tu navegador:<br>
      <span style="word-break:break-all;color:#B84400">{{ .ConfirmationURL }}</span>
    </td></tr>

    <tr><td style="border-top:1px solid #E2D8C9;padding:18px 28px 24px;font-size:12px;line-height:1.55;color:#586D64">
      Si no has sido tú, no hagas nada: sin confirmar este correo la cuenta
      no sirve para nada y se queda vacía.<br><br>
      <span style="color:#8CA69D">ahorrainvierte.es · Correo automático, no hace falta responder</span>
    </td></tr>

  </table>
</td></tr>
</table>
```

---

## 2 · Reset password

**Subject:**

```
Recupera tu contraseña · Cuentas y Cartera
```

**Message body:**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EAE0;margin:0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F4EC;border-radius:16px;overflow:hidden;border:1px solid #E2D8C9">

    <tr><td style="background:#0B322D;padding:22px 28px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:10px;vertical-align:middle">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:4px;height:10px;background:#E4622A;font-size:0">&nbsp;</td>
            <td style="width:3px">&nbsp;</td>
            <td style="width:4px;height:16px;background:#E4622A;font-size:0">&nbsp;</td>
            <td style="width:3px">&nbsp;</td>
            <td style="width:4px;height:22px;background:#E4622A;font-size:0">&nbsp;</td>
          </tr></table>
        </td>
        <td style="vertical-align:middle">
          <div style="color:#F2EDE3;font-size:18px;font-weight:700;letter-spacing:-.3px">Cuentas y Cartera</div>
          <div style="color:#8CA69D;font-size:12px;margin-top:2px">Tu economía y tu cartera, en un sitio que es tuyo</div>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:32px 28px 8px">
      <div style="font-size:21px;font-weight:700;color:#0B2E29;margin-bottom:14px">Cambiar la contraseña</div>
      <div style="font-size:15px;line-height:1.6;color:#3D5C56">
        Has pedido cambiar la contraseña de tu cuenta. Pulsa el botón y elige
        una nueva:
      </div>
    </td></tr>

    <tr><td align="center" style="padding:26px 28px 22px">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;
                padding:14px 34px;border-radius:100px;font-size:15px;font-weight:700">
        Elegir contraseña nueva
      </a>
    </td></tr>

    <tr><td style="padding:0 28px 24px">
      <div style="background:#EAE1D4;border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.55;color:#3D5C56">
        El enlace caduca en una hora y solo se puede usar una vez.
      </div>
    </td></tr>

    <tr><td style="padding:0 28px 26px;font-size:12.5px;line-height:1.55;color:#586D64">
      Si el botón no funciona, copia esta dirección en tu navegador:<br>
      <span style="word-break:break-all;color:#B84400">{{ .ConfirmationURL }}</span>
    </td></tr>

    <tr><td style="border-top:1px solid #E2D8C9;padding:18px 28px 24px;font-size:12px;line-height:1.55;color:#586D64">
      <strong>Si no has sido tú</strong>, ignora este mensaje: tu contraseña
      actual sigue funcionando y nadie ha entrado en tu cuenta. Nadie puede
      cambiarla sin abrir este correo.<br><br>
      <span style="color:#8CA69D">ahorrainvierte.es · Correo automático, no hace falta responder</span>
    </td></tr>

  </table>
</td></tr>
</table>
```

---

## 3 · Change Email Address

**Subject:**

```
Confirma tu nuevo correo · Cuentas y Cartera
```

**Message body:**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EAE0;margin:0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F4EC;border-radius:16px;overflow:hidden;border:1px solid #E2D8C9">

    <tr><td style="background:#0B322D;padding:22px 28px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:10px;vertical-align:middle">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:4px;height:10px;background:#E4622A;font-size:0">&nbsp;</td>
            <td style="width:3px">&nbsp;</td>
            <td style="width:4px;height:16px;background:#E4622A;font-size:0">&nbsp;</td>
            <td style="width:3px">&nbsp;</td>
            <td style="width:4px;height:22px;background:#E4622A;font-size:0">&nbsp;</td>
          </tr></table>
        </td>
        <td style="vertical-align:middle">
          <div style="color:#F2EDE3;font-size:18px;font-weight:700;letter-spacing:-.3px">Cuentas y Cartera</div>
          <div style="color:#8CA69D;font-size:12px;margin-top:2px">Tu economía y tu cartera, en un sitio que es tuyo</div>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:32px 28px 8px">
      <div style="font-size:21px;font-weight:700;color:#0B2E29;margin-bottom:14px">Confirma tu nuevo correo</div>
      <div style="font-size:15px;line-height:1.6;color:#3D5C56">
        Has pedido cambiar la dirección de tu cuenta a
        <strong>{{ .Email }}</strong>. Confirma que es tuya:
      </div>
    </td></tr>

    <tr><td align="center" style="padding:26px 28px 22px">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;
                padding:14px 34px;border-radius:100px;font-size:15px;font-weight:700">
        Confirmar este correo
      </a>
    </td></tr>

    <tr><td style="border-top:1px solid #E2D8C9;padding:18px 28px 24px;font-size:12px;line-height:1.55;color:#586D64">
      Hasta que no lo confirmes se sigue usando la dirección anterior. Si no
      has pedido el cambio, ignora el mensaje y avisa a quien te invitó.<br><br>
      <span style="color:#8CA69D">ahorrainvierte.es · Correo automático, no hace falta responder</span>
    </td></tr>

  </table>
</td></tr>
</table>
```

---

## Por qué están hechas así

- **Con tablas, no con divs.** No es nostalgia: Outlook sigue usando el
  motor de Word para pintar correos y las maquetaciones modernas se le
  descuadran. Con tablas se ve igual en todas partes.
- **El logotipo son tres barras de color**, hechas con celdas de tabla en
  vez de con una imagen. Muchos clientes bloquean las imágenes por defecto,
  y un correo que empieza con un hueco gris no inspira confianza. Así se ve
  siempre, y de paso no hay nada que descargar.
- **Colores fijos, sin tema oscuro.** El correo no puede adaptarse como la
  aplicación; se elige la versión clara, que es la que se ve bien en todos
  los clientes.
- **Un botón grande y el enlace también en texto**, por si el cliente no
  pinta botones.
- **Cada correo explica qué hacer si no has sido tú.** Es lo que distingue
  un aviso legítimo de uno sospechoso.
- **Sin mayúsculas, urgencias ni exclamaciones**: el vocabulario del spam
  está muy estudiado por los filtros.

## Aviso para cuando invites

Los primeros correos pueden tardar o caer en spam: el dominio es nuevo y
todavía no tiene reputación. Algunos servidores rechazan el primer intento
a propósito (*greylisting*) y aceptan el segundo, media hora después. Avisa
a quien invites y que marque **«No es spam»** — cada vez que alguien lo
hace, el siguiente correo lo tiene más fácil.
