# Plantillas de correo

Supabase manda un correo distinto en cada situación, y cada uno debería
decir una cosa distinta. Aquí están los seis, con el **nombre exacto que
tienen en el panel** para que no haya dudas de cuál va dónde.

**Dónde:** Supabase → **Authentication** → **Emails** → pestaña
**Templates**. Pinchas en la fila, cambias el **Subject**, pegas el HTML en
el cuadro grande, **Save**.

Lo que va entre `{{ ... }}` lo rellena Supabase al enviar. **No lo toques
ni lo traduzcas.**

> ⚠️ Antes de nada: **Authentication → URL Configuration → Site URL** tiene
> que ser `https://ahorrainvierte.es`. Si ahí sigue el `localhost:3000` de
> fábrica, los enlaces de todos estos correos no llevan a ningún sitio.

| Fila en Supabase | Cuándo se envía | ¿La usa la app? |
|---|---|---|
| **Confirm sign up** | Alguien crea una cuenta | Sí, siempre |
| **Reset password** | Alguien pide cambiar su contraseña | Sí, cuando se olvida |
| **Change email address** | Alguien cambia su dirección | Sí, si algún día lo permitimos |
| **Invite user** | Invitas tú desde el panel de Supabase | Solo si invitas a mano |
| **Magic link or OTP** | Entrada sin contraseña | No la usamos hoy |
| **Reauthentication** | Confirmar identidad antes de algo delicado | No la usamos hoy |

Las tres primeras son las importantes. Las otras tres las dejo escritas
para que, si algún día se activan, no salga el texto de fábrica en inglés.

---

## 1 · Confirm sign up

Se envía nada más crear la cuenta. Sin pulsar ese botón, la cuenta existe
pero no sirve para nada.

**Subject:**

```
Confirma tu cuenta · Cuentas y Cartera
```

**Message body:**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EAE0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F4EC;border-radius:16px;overflow:hidden;border:1px solid #E2D8C9">
  <tr><td style="background:#0B322D;padding:22px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:4px;height:10px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:16px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:22px;background:#E4622A;font-size:0">&nbsp;</td>
      </tr></table></td>
      <td><div style="color:#F2EDE3;font-size:18px;font-weight:700">Cuentas y Cartera</div>
          <div style="color:#8CA69D;font-size:12px;margin-top:2px">Tu economía y tu cartera, en un sitio que es tuyo</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px 28px 8px">
    <div style="font-size:21px;font-weight:700;color:#0B2E29;margin-bottom:14px">Ya casi está</div>
    <div style="font-size:15px;line-height:1.6;color:#3D5C56">Has creado una cuenta en <strong>Cuentas y Cartera</strong>. Solo falta confirmar que este correo es tuyo:</div>
  </td></tr>
  <tr><td align="center" style="padding:26px 28px 22px">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:100px;font-size:15px;font-weight:700">Confirmar mi correo</a>
  </td></tr>
  <tr><td style="padding:0 28px 24px">
    <div style="background:#EAE1D4;border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.55;color:#3D5C56">Después entra con tu correo y tu contraseña. <strong>Ten a mano el código de invitación</strong>: te lo pediremos una vez más al entrar.</div>
  </td></tr>
  <tr><td style="padding:0 28px 26px;font-size:12.5px;line-height:1.55;color:#586D64">
    Si el botón no funciona, copia esta dirección en tu navegador:<br>
    <span style="word-break:break-all;color:#B84400">{{ .ConfirmationURL }}</span>
  </td></tr>
  <tr><td style="border-top:1px solid #E2D8C9;padding:18px 28px 24px;font-size:12px;line-height:1.55;color:#586D64">
    Si no has sido tú, no hagas nada: sin confirmar este correo la cuenta se queda vacía y sin acceso.<br><br>
    <span style="color:#8CA69D">ahorrainvierte.es · Correo automático, no hace falta responder</span>
  </td></tr>
</table>
</td></tr></table>
```

---

## 2 · Reset password

Se envía cuando alguien dice que ha olvidado la contraseña. Es el correo
más delicado de todos: quien lo abra puede entrar en la cuenta.

**Subject:**

```
Recupera tu contraseña · Cuentas y Cartera
```

**Message body:**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EAE0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F4EC;border-radius:16px;overflow:hidden;border:1px solid #E2D8C9">
  <tr><td style="background:#0B322D;padding:22px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:4px;height:10px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:16px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:22px;background:#E4622A;font-size:0">&nbsp;</td>
      </tr></table></td>
      <td><div style="color:#F2EDE3;font-size:18px;font-weight:700">Cuentas y Cartera</div>
          <div style="color:#8CA69D;font-size:12px;margin-top:2px">Tu economía y tu cartera, en un sitio que es tuyo</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px 28px 8px">
    <div style="font-size:21px;font-weight:700;color:#0B2E29;margin-bottom:14px">Cambiar la contraseña</div>
    <div style="font-size:15px;line-height:1.6;color:#3D5C56">Has pedido cambiar la contraseña de tu cuenta. Pulsa el botón y elige una nueva:</div>
  </td></tr>
  <tr><td align="center" style="padding:26px 28px 22px">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:100px;font-size:15px;font-weight:700">Elegir contraseña nueva</a>
  </td></tr>
  <tr><td style="padding:0 28px 24px">
    <div style="background:#EAE1D4;border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.55;color:#3D5C56">El enlace caduca en una hora y solo se puede usar una vez. Elige una contraseña larga y que no uses en ningún otro sitio.</div>
  </td></tr>
  <tr><td style="padding:0 28px 26px;font-size:12.5px;line-height:1.55;color:#586D64">
    Si el botón no funciona, copia esta dirección en tu navegador:<br>
    <span style="word-break:break-all;color:#B84400">{{ .ConfirmationURL }}</span>
  </td></tr>
  <tr><td style="border-top:1px solid #E2D8C9;padding:18px 28px 24px;font-size:12px;line-height:1.55;color:#586D64">
    <strong>Si no has sido tú</strong>, ignora este mensaje: tu contraseña actual sigue funcionando y nadie ha entrado en tu cuenta. Nadie puede cambiarla sin abrir este correo.<br><br>
    <span style="color:#8CA69D">ahorrainvierte.es · Correo automático, no hace falta responder</span>
  </td></tr>
</table>
</td></tr></table>
```

---

## 3 · Change email address

Se envía a la dirección **nueva** cuando alguien cambia el correo de su
cuenta. Hasta que no se confirma, sigue valiendo la antigua.

**Subject:**

```
Confirma tu nuevo correo · Cuentas y Cartera
```

**Message body:**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EAE0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F4EC;border-radius:16px;overflow:hidden;border:1px solid #E2D8C9">
  <tr><td style="background:#0B322D;padding:22px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:4px;height:10px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:16px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:22px;background:#E4622A;font-size:0">&nbsp;</td>
      </tr></table></td>
      <td><div style="color:#F2EDE3;font-size:18px;font-weight:700">Cuentas y Cartera</div>
          <div style="color:#8CA69D;font-size:12px;margin-top:2px">Tu economía y tu cartera, en un sitio que es tuyo</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px 28px 8px">
    <div style="font-size:21px;font-weight:700;color:#0B2E29;margin-bottom:14px">Confirma tu nuevo correo</div>
    <div style="font-size:15px;line-height:1.6;color:#3D5C56">Has pedido cambiar la dirección de tu cuenta a <strong>{{ .NewEmail }}</strong>. Confirma que es tuya:</div>
  </td></tr>
  <tr><td align="center" style="padding:26px 28px 22px">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:100px;font-size:15px;font-weight:700">Confirmar este correo</a>
  </td></tr>
  <tr><td style="border-top:1px solid #E2D8C9;padding:18px 28px 24px;font-size:12px;line-height:1.55;color:#586D64">
    Hasta que no lo confirmes se sigue usando la dirección anterior, así que no pierdes el acceso. Si no has pedido este cambio, ignora el mensaje y avisa a quien te invitó.<br><br>
    <span style="color:#8CA69D">ahorrainvierte.es · Correo automático, no hace falta responder</span>
  </td></tr>
</table>
</td></tr></table>
```

---

## 4 · Invite user

Este NO sale del formulario de registro: sale cuando invitas tú a alguien
desde el panel de Supabase (**Authentication → Users → Invite user**). Es
la vía rápida para dar de alta a alguien sin código de invitación.

**Subject:**

```
Te han invitado a Cuentas y Cartera
```

**Message body:**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EAE0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F4EC;border-radius:16px;overflow:hidden;border:1px solid #E2D8C9">
  <tr><td style="background:#0B322D;padding:22px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:4px;height:10px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:16px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:22px;background:#E4622A;font-size:0">&nbsp;</td>
      </tr></table></td>
      <td><div style="color:#F2EDE3;font-size:18px;font-weight:700">Cuentas y Cartera</div>
          <div style="color:#8CA69D;font-size:12px;margin-top:2px">Tu economía y tu cartera, en un sitio que es tuyo</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px 28px 8px">
    <div style="font-size:21px;font-weight:700;color:#0B2E29;margin-bottom:14px">Tienes una invitación</div>
    <div style="font-size:15px;line-height:1.6;color:#3D5C56">
      Alguien te ha invitado a <strong>Cuentas y Cartera</strong>: una aplicación para llevar tu economía del mes y tu cartera de inversión, con un método escrito para decidir qué comprar, qué mantener y qué vender.
      <br><br>Pulsa para aceptar la invitación y elegir tu contraseña:
    </div>
  </td></tr>
  <tr><td align="center" style="padding:26px 28px 22px">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:100px;font-size:15px;font-weight:700">Aceptar la invitación</a>
  </td></tr>
  <tr><td style="padding:0 28px 24px">
    <div style="background:#EAE1D4;border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.55;color:#3D5C56">Tus datos son solo tuyos: nadie más, ni siquiera quien te invitó, puede verlos.</div>
  </td></tr>
  <tr><td style="border-top:1px solid #E2D8C9;padding:18px 28px 24px;font-size:12px;line-height:1.55;color:#586D64">
    Si no esperabas esta invitación, ignórala y no pasa nada.<br><br>
    <span style="color:#8CA69D">ahorrainvierte.es · Correo automático, no hace falta responder</span>
  </td></tr>
</table>
</td></tr></table>
```

---

## 5 · Magic link or OTP

Entrada sin contraseña: un enlace de un solo uso. **Hoy la aplicación no lo
usa**, pero si algún día se activa, mejor que no salga en inglés.

**Subject:**

```
Tu enlace de entrada · Cuentas y Cartera
```

**Message body:**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EAE0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F4EC;border-radius:16px;overflow:hidden;border:1px solid #E2D8C9">
  <tr><td style="background:#0B322D;padding:22px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:4px;height:10px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:16px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:22px;background:#E4622A;font-size:0">&nbsp;</td>
      </tr></table></td>
      <td><div style="color:#F2EDE3;font-size:18px;font-weight:700">Cuentas y Cartera</div>
          <div style="color:#8CA69D;font-size:12px;margin-top:2px">Tu economía y tu cartera, en un sitio que es tuyo</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px 28px 8px">
    <div style="font-size:21px;font-weight:700;color:#0B2E29;margin-bottom:14px">Entra con este enlace</div>
    <div style="font-size:15px;line-height:1.6;color:#3D5C56">Has pedido entrar sin escribir la contraseña. Pulsa aquí y estarás dentro:</div>
  </td></tr>
  <tr><td align="center" style="padding:26px 28px 22px">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#B84400;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:100px;font-size:15px;font-weight:700">Entrar en mi cuenta</a>
  </td></tr>
  <tr><td style="padding:0 28px 24px">
    <div style="background:#EAE1D4;border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.55;color:#3D5C56">
      También puedes escribir este código en la pantalla de acceso:<br>
      <span style="display:inline-block;margin-top:8px;font-size:24px;font-weight:700;letter-spacing:4px;color:#0B2E29">{{ .Token }}</span>
    </div>
  </td></tr>
  <tr><td style="border-top:1px solid #E2D8C9;padding:18px 28px 24px;font-size:12px;line-height:1.55;color:#586D64">
    Caduca en una hora y solo sirve una vez. <strong>Si no lo has pedido tú</strong>, ignóralo: mientras no se pulse, nadie entra.<br><br>
    <span style="color:#8CA69D">ahorrainvierte.es · Correo automático, no hace falta responder</span>
  </td></tr>
</table>
</td></tr></table>
```

---

## 6 · Reauthentication

Un código corto para confirmar que eres tú antes de algo delicado, como
cambiar la contraseña estando ya dentro. **Hoy tampoco se usa.** Ojo: aquí
no hay enlace, solo `{{ .Token }}`.

**Subject:**

```
Tu código de confirmación · Cuentas y Cartera
```

**Message body:**

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EAE0;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F4EC;border-radius:16px;overflow:hidden;border:1px solid #E2D8C9">
  <tr><td style="background:#0B322D;padding:22px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:4px;height:10px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:16px;background:#E4622A;font-size:0">&nbsp;</td><td style="width:3px">&nbsp;</td>
        <td style="width:4px;height:22px;background:#E4622A;font-size:0">&nbsp;</td>
      </tr></table></td>
      <td><div style="color:#F2EDE3;font-size:18px;font-weight:700">Cuentas y Cartera</div>
          <div style="color:#8CA69D;font-size:12px;margin-top:2px">Tu economía y tu cartera, en un sitio que es tuyo</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px 28px 8px">
    <div style="font-size:21px;font-weight:700;color:#0B2E29;margin-bottom:14px">Confirma que eres tú</div>
    <div style="font-size:15px;line-height:1.6;color:#3D5C56">Para seguir adelante con una operación delicada en tu cuenta, escribe este código en la aplicación:</div>
  </td></tr>
  <tr><td align="center" style="padding:24px 28px 22px">
    <div style="display:inline-block;background:#EAE1D4;border-radius:12px;padding:16px 30px;font-size:30px;font-weight:700;letter-spacing:6px;color:#0B2E29">{{ .Token }}</div>
  </td></tr>
  <tr><td style="border-top:1px solid #E2D8C9;padding:18px 28px 24px;font-size:12px;line-height:1.55;color:#586D64">
    Caduca en unos minutos. <strong>No se lo des a nadie</strong>: no te lo pediremos nunca por teléfono ni por mensaje. Si no estabas haciendo nada, ignóralo y cambia tu contraseña por si acaso.<br><br>
    <span style="color:#8CA69D">ahorrainvierte.es · Correo automático, no hace falta responder</span>
  </td></tr>
</table>
</td></tr></table>
```

---

## Los avisos de seguridad (la sección de abajo)

En la misma pantalla, debajo, hay siete interruptores apagados. No son
correos que la gente pida: son **avisos de que ha pasado algo en su
cuenta**, y por eso valen tanto — es como te enteras de que alguien ha
entrado donde no debía.

Merece la pena encender estos dos:

- **Password changed** — avisa cuando se cambia la contraseña.
- **Email address changed** — avisa cuando se cambia el correo.

Son exactamente los dos movimientos que hace quien roba una cuenta: cambiar
la contraseña para que el dueño no entre, y cambiar el correo para que no
pueda recuperarla. Si te avisan, tienes tiempo de reaccionar; si no, te
enteras cuando ya no puedes hacer nada.

Los otros cinco (teléfono, métodos de acceso, MFA) van de cosas que la
aplicación no usa todavía. Cuando montemos la verificación en dos pasos,
encenderemos también los dos de MFA.

---

## Por qué están hechas así

- **Con tablas, no con divs.** Outlook pinta los correos con el motor de
  Word y descuadra las maquetaciones modernas. Con tablas se ve igual en
  todas partes.
- **El logotipo son tres barras de color hechas con celdas**, no una
  imagen. Muchos clientes bloquean las imágenes por defecto, y un correo
  que empieza con un hueco gris no inspira ninguna confianza.
- **Colores fijos.** El correo no puede adaptarse al tema oscuro como la
  aplicación; se elige la versión clara, que se ve bien en todos lados.
- **Un botón grande y el enlace también en texto**, por si el cliente no
  pinta botones.
- **Todos explican qué hacer si no has sido tú.** Es lo que distingue un
  aviso legítimo de uno sospechoso.
- **Sin mayúsculas, urgencias ni exclamaciones**: el vocabulario del spam
  está muy estudiado por los filtros.

## Aviso para cuando invites

Los primeros correos pueden tardar o caer en spam: el dominio es nuevo y no
tiene reputación. Algunos servidores rechazan el primer intento a propósito
(*greylisting*) y aceptan el segundo, media hora después. Avisa a quien
invites y que marque **«No es spam»**: cada vez que alguien lo hace, el
siguiente correo lo tiene más fácil.
