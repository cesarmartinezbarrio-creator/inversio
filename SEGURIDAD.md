# Análisis de seguridad

Modelo de amenazas de Cuentas y Cartera: qué hay que proteger, de quién,
por dónde podrían entrar, y qué se hace al respecto.

Está escrito para una aplicación que guarda **datos financieros personales
de varias personas**. Eso sube el listón: no es lo mismo perder una lista de
la compra que exponer el patrimonio de alguien.

Acompaña a [`ARQUITECTURA.md`](./ARQUITECTURA.md), que explica el diseño al
que se refieren muchas de estas contramedidas.

---

## 1 · Qué hay que proteger

| Activo | Por qué importa | Si se pierde |
|---|---|---|
| **Los datos de cartera** | Patrimonio, ingresos, gastos y decisiones de inversión de una persona | Daño real: material para extorsión, ingeniería social o robo dirigido |
| **Las credenciales de acceso** | Dan entrada a lo anterior | Compromiso total de esa cuenta |
| **Las claves de API de mercado** | Cuota de terceros que se paga o se agota | Servicio degradado para todos; posible coste |
| **Las cuentas de Supabase, Vercel y GitHub** | Controlan la infraestructura entera | Compromiso total de **todos** los usuarios |
| **El dominio** | Identidad del proyecto | Suplantación, phishing a los propios usuarios |

Fíjate en la cuarta fila: es la más valiosa de la tabla y la que menos se
mira. Volveremos a ella.

---

## 2 · De quién nos defendemos

Cinco perfiles realistas, ordenados de más probable a menos:

**El escaneo automático.** Bots que recorren internet probando rutas
conocidas, credenciales por defecto y vulnerabilidades publicadas. No te
buscan a ti; te encuentran. Es, con diferencia, lo más probable que le pase
a este proyecto.

**El que encuentra un dispositivo.** Un portátil o un móvil perdido o
robado, con la sesión abierta. Sin conocimientos técnicos, pero con acceso
físico.

**El phishing.** Un correo o un mensaje que imita a la aplicación, a
Supabase o a Hostinger, para que escribas tus credenciales en el sitio
equivocado. Es el ataque que mejor funciona contra personas cuidadosas.

**El de dentro.** Alguien con cuenta legítima —familia, un amigo— que
intenta ver los datos de otro. No hace falta que sea malintencionado: basta
la curiosidad, o un fallo que le enseñe lo que no debía. **Este es el
escenario nuevo** que aparece al pasar a multiusuario.

**El compromiso de un tercero.** Supabase, Vercel o Hostinger sufren una
brecha. Poco probable e imposible de prevenir desde aquí, pero hay que saber
qué implicaría.

---

## 3 · Superficie de ataque y contramedidas

### 3.1 · La sesión en el navegador · **riesgo alto**

Es el punto débil principal, y no lo arregla el 2FA.

Si alguien consigue ejecutar JavaScript dentro de la página, se lleva la
sesión **ya iniciada**. El segundo factor no le estorba, porque ya se pasó.
Es la razón de que el XSS sea el ataque que más importa aquí.

**Estado actual:** revisado en septiembre de 2026. El código escapa la
entrada del usuario de forma disciplinada —110 llamadas a `esc()`— y los
avisos, los toasts y los diálogos usan `textContent`, que no interpreta
HTML. Se encontró un único descuido (una inicial de nombre sin escapar) y se
corrigió.

**Qué falta:**

- **Cabecera `Content-Security-Policy`.** Hoy no hay ninguna. Una CSP
  restrictiva convierte un XSS que hoy sería explotable en uno inútil,
  porque el navegador se niega a ejecutar scripts que no vengan de donde
  toca. Es la contramedida con mejor relación coste/beneficio pendiente.
- **Disciplina al añadir código.** Cualquier `innerHTML` nuevo con datos que
  escriba el usuario tiene que pasar por `esc()`. Sin excepciones.

### 3.2 · Separación entre usuarios · **riesgo alto, mitigado por diseño**

El escenario "el de dentro". Se resuelve con RLS en PostgreSQL, no con
filtros en el código: la base de datos se niega a devolver filas ajenas
aunque la consulta se lo pida. Ver `ARQUITECTURA.md`, apartado 2.2.

**Condición imprescindible:** que la aplicación **nunca** use la clave
`service_role` para servir peticiones de usuarios. Esa clave se salta RLS
por diseño. Es la regla que no se puede romper ni "temporalmente para
probar algo".

### 3.3 · Contraseñas y segundo factor · **riesgo medio**

Con Supabase Auth: hash correcto, sesiones que caducan, límite de intentos.

El TOTP (Google Authenticator) protege bien contra contraseñas robadas o
reutilizadas. **No protege contra phishing en tiempo real**: si te engañan
para que escribas el código de seis dígitos en una web falsa, el atacante lo
reenvía al sitio real dentro de su ventana de validez. La defensa contra eso
son las **passkeys**, que están atadas criptográficamente al dominio y no se
pueden reenviar. Queda anotado como mejora futura, no como carencia
inaceptable.

### 3.4 · La recuperación de cuenta · **la puerta de atrás clásica**

En la mayoría de aplicaciones, el 2FA es teatro porque el "he olvidado mi
contraseña" lo puentea: quien controla el correo, controla la cuenta.

**Aquí no**, y por una decisión concreta: exigir `aal2` en la política de
RLS. Una sesión obtenida por recuperación de contraseña es `aal1`, y con esa
política **no puede leer nada** hasta pasar el código del móvil. La
comprobación no vive en la pantalla de login —donde se puede saltar— sino
dentro de la base de datos.

**El riesgo que queda:** si alguien pierde el móvil, se queda fuera. Como no
hay códigos de recuperación de serie, el administrador (tú) puede eliminarle
el factor desde el panel de Supabase. Eso significa, y hay que decirlo
claro: **tú eres la vía de recuperación, y por tanto el eslabón más débil
del sistema**. Consecuencias:

- Tu cuenta de Supabase necesita la protección más fuerte de todas.
- Antes de quitarle el 2FA a alguien, verifica por un canal distinto que es
  quien dice ser. Una llamada, no un mensaje: el correo o el móvil pueden
  ser justo lo que le han comprometido.
- Recomienda a cada usuario dar de alta **dos** dispositivos con el mismo
  código QR (por ejemplo móvil y tableta). Así una pérdida no obliga a
  recurrir a ti.

### 3.5 · Las claves de las APIs de mercado · **riesgo bajo, impacto medio**

Viven solo en las variables de entorno de Vercel y nunca llegan al
navegador. Esa parte está bien resuelta desde el principio.

El riesgo real no es el robo sino el **agotamiento**: Alpha Vantage da unas
25 peticiones diarias en total. Con varios usuarios, el primero que entre se
las come. Se resuelve con la caché común de precios y los contadores por
usuario descritos en `ARQUITECTURA.md`, apartado 4.

### 3.6 · Las cuentas de infraestructura · **riesgo alto, coste de arreglo: diez minutos**

Supabase, Vercel, GitHub y Hostinger. Cualquiera de las cuatro, comprometida,
entrega el proyecto entero: desde el panel de Supabase se lee la base de
datos completa sin pasar por RLS.

**Sin 2FA en esas cuatro cuentas, todo lo demás de este documento es
decorativo**, porque el sistema entero quedaría protegido por la contraseña
de un correo. Es la tarea de mayor rentabilidad de toda la lista y la que
más se pospone.

### 3.7 · Copias de seguridad · **riesgo medio, hoy sin cubrir**

Ahora mismo no hay ninguna. Si la fila se corrompe, se borra por error o se
pierde, los datos no están en ningún otro sitio. Y esto no es un ataque:
es lo que pasa un martes cualquiera.

Comprueba qué retención de copias incluye tu plan de Supabase —varía y
conviene no darlo por supuesto— y, en cualquier caso, monta un export
propio. La app guarda todo su estado en un JSON: una exportación periódica
es un fichero pequeño y resuelve el problema entero.

### 3.8 · Trazabilidad · **hoy inexistente**

No hay registro de quién entra ni cuándo. Si algún día hay sospecha de
acceso indebido, no habría forma de confirmarlo ni de acotar el alcance —y
esa incertidumbre es, por sí sola, un problema serio cuando hay que
notificar una brecha.

Una tabla sencilla de eventos (usuario, acción, fecha, IP) cubre lo básico.
Ojo: esos registros **también son datos personales** y necesitan su propia
política de RLS y un plazo de borrado.

---

## 4 · Riesgos que se aceptan a conciencia

Un análisis honesto también dice de qué **no** protege:

**Un dispositivo comprometido.** Si hay un troyano en el portátil del
usuario, no hay nada que la aplicación pueda hacer. Se acepta.

**Un compromiso de Supabase, Vercel o Hostinger.** Se confía en ellos por
necesidad. La mitigación es elegir proveedores serios y minimizar lo que se
les da: por eso las claves de mercado están en un sitio y los datos en otro.

**El phishing en tiempo real contra el TOTP.** Cubierto por passkeys el día
que se implementen. Hasta entonces, se acepta.

**El administrador como vía de recuperación.** Descrito en 3.4. Es un
compromiso consciente entre seguridad y no dejar tirado a quien pierde el
móvil.

---

## 5 · Obligaciones legales

En el momento en que la aplicación guarda datos de otras personas, dejas de
ser un aficionado con un proyecto y pasas a ser **responsable del
tratamiento** bajo el RGPD. Esto no cambia según lo pequeño que sea el
proyecto.

Lo que implica, en concreto:

- **Borrado a petición.** Si alguien pide que borres sus datos, hay que
  poder hacerlo. El `on delete cascade` de la tabla lo resuelve
  técnicamente.
- **Acceso a sus datos.** Tiene derecho a una copia. La exportación en JSON
  ya lo cubre.
- **Notificación de brechas.** Si hay un acceso indebido, hay 72 horas para
  notificarlo a la autoridad de control (en España, la AEPD) y, según la
  gravedad, a los afectados. Esto es lo que hace que el apartado 3.8 no sea
  un lujo: sin registros, no se puede evaluar el alcance.
- **Información previa.** Aunque sean tu familia, tienen que saber qué se
  guarda, dónde y por cuánto tiempo. Con un texto corto y honesto basta.

Con familia y amigos el riesgo práctico es bajo. Si algún día se abre al
público, esto pasa a ser un compromiso serio y continuo, y conviene
revisarlo con calma antes de dar el paso.

---

## 6 · Lista de verificación

Por orden de rentabilidad, no de dificultad.

**Hazlo hoy:**

- [ ] 2FA en Supabase, Vercel, GitHub y Hostinger
- [ ] Exportar la fila actual de `estado` y guardarla fuera de Supabase

**Durante la migración:**

- [ ] RLS activado y políticas escritas en la tabla nueva
- [ ] `grant` explícito al rol `authenticated` (sin esto, RLS ni se evalúa)
- [ ] Verificar que la clave `service_role` **no** aparece en ninguna ruta
      que sirva peticiones de usuarios
- [ ] Registro público de usuarios desactivado en Supabase
- [ ] Política de RLS con `aal2` una vez el 2FA esté en marcha
- [ ] Contadores por usuario y caché común de precios en el proxy

**Al cerrar:**

- [ ] Cabecera `Content-Security-Policy`
- [ ] Export automático de copias de seguridad
- [ ] Tabla de registro de accesos, con su propia RLS y su plazo de borrado
- [ ] Texto de información sobre datos para los usuarios

**Cada cierto tiempo:**

- [ ] Revisar los usuarios dados de alta y quitar los que ya no usen la app
- [ ] Comprobar que las copias de seguridad **se restauran**, no solo que se
      hacen
- [ ] Repasar el escapado de HTML en el código añadido desde la última vez

---

## 7 · Si algo pasa

Un plan corto vale más que uno completo que no se lea.

1. **Cortar.** En Supabase, revocar las sesiones activas de la cuenta
   afectada. Si la sospecha es general, rotar las claves de API y forzar el
   cierre de todas las sesiones.
2. **Mirar.** Revisar los registros de acceso de Supabase y de Vercel para
   acotar qué se tocó y cuándo.
3. **Avisar.** A los usuarios afectados, con lo que se sepa y sin adornos. Y
   a la AEPD si procede, dentro de las 72 horas.
4. **Cerrar.** Averiguar por dónde entró y taparlo antes de restablecer el
   servicio.
5. **Escribir.** Añadir el caso a [`AVERIAS.md`](./AVERIAS.md). Lo que no se
   documenta se repite.
