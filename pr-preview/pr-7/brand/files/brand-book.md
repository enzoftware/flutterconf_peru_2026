FlutterConf Perú 2026 es un día entero de Flutter y Dart. El sistema mezcla la gráfica chicha de los afiches limeños con la paleta oficial de Flutter, y tiene a Dash como guía. Úsalo para la web, los posts, las historias, las diapositivas y el material impreso.

**Datos del evento:** sábado 19 de diciembre de 2026, de 9:00 a 15:00, en Bloom Tower, piso 16 (Flora Tristán 310, Magdalena del Mar, Lima). Hashtag #FlutterConfPE. Los precios, ponentes y redes que aparecen en las plantillas son provisionales.

## Voz y contenido

- Tutea siempre, en un tono cercano y entusiasta, como un dev peruano hablándole a otro: "Compra tu entrada", "Separa tu cupo", "¿Quién sube al escenario?".
- Usa la jerga con medida: un "causa" o un "pe" en las burbujas de Dash o en un post, nunca en información práctica (precios, sede, horarios).
- Abre los titulares con ¡…! o ¿…? como en un afiche: "¡Flutter Conf Perú!", "¿Qué vas a aprender?", "De 9 a 15, sin parar".
- Pon primero a Flutter, Dart y Dash. Lima es la sede, no el tema.
- Escribe las horas en formato de 24 horas con dos puntos (9:00, 15:00) y los precios en soles con S/.
- Nada de emojis en las piezas gráficas: los reemplazan los ornamentos (★, destello, rayo).
- Escribe "Flutter" sin ligaduras: las dos "t" van separadas. Todos los estilos ya las tienen desactivadas.

## Color

La paleta usa los colores oficiales de flutter.dev/brand y unos pocos tonos derivados de ellos.

- Fondo por defecto: `navy-deep`. Para cambiar de ambiente, alterna secciones o piezas en `navy`, `blue` y `purple-deep`, como en la web, donde el fondo pasa de noche a púrpura y a azul.
- Acentos: `yellow`, `red` y `green`, como franjas, botones, stickers y cintas. Una pieza usa como máximo tres acentos.
- Fondos encendidos: cuando el fondo es `yellow` o `red`, el texto va en `ink` y el botón es `.is-dark`.
- Texto sobre fondos oscuros: `paper`. Para destacar, `yellow` o `green`, que son legibles sobre `navy-deep`.
- `sky` es solo para formas y gráficos: como texto chico sobre navy no se lee.
- Proporción orientativa por pieza: 60 % fondo oscuro, 25 % acentos y 15 % paper o blanco.

## Tipografía

- Titulares: `display-xl`, `display-l` y `display-m` en **FlutterChicha**, siempre armados con el componente **Chicha**: sombra azul, contorno, letra blanca, franja amarilla fosforescente, franja naranja y brillos. Los colores son los del alfabeto pintado a mano (`fc-blanco`, `fc-amarillo`, `fc-naranja`, `fc-azul`, `fc-negro`) y no se cambian.
- FlutterChicha tiene mayúsculas, minúsculas, Ñ, tildes, números, signos ¡! ¿? y los ornamentos ★ ⚡ ✺. Los archivos TTF de las 5 capas están en el grupo de recursos **FlutterChicha**.
- Botones, etiquetas, chips, cintas y antetítulos: Bungee (`title`, `kicker`).
- Número del año y números de tema: `numeral`, en Bungee Shade.
- Antetítulos: `kicker`, en mayúsculas con espaciado.
- Texto: `body-l` para bajadas, `body` para texto corrido y `caption` para metadatos, en Rubik.
- En Canva, Figma o Keynote, instala los 5 TTF y apila una caja de texto por capa (ver el componente Chicha).

## Forma, espacio y profundidad

- Todo va con contorno `ink` (`stroke-card` en tarjetas y cintas, `stroke-chip` en chips) y sombra dura sin desenfoque (`hard-sm`, `hard-md`, `hard-red`, `hard-yellow`). Nunca sombras difusas ni degradados suaves de UI.
- Esquinas: `radius-lg` para tarjetas, `radius-md` para etiquetas y fotos, `radius-pill` para botones y chips.
- Las piezas se rotan levemente (±2° a ±6°) para darles energía de afiche. El texto largo nunca va rotado.
- Espaciado: `space-3` a `space-7`. Márgenes seguros: 64 px en posts, 96 px en historias y 120 px en diapositivas.

## Dash y movimiento

- Usa los archivos del grupo **Dash** (posado, con contorno, volando, cabeza e ícono) sin deformarlos ni recolorearlos.
- **Dash con la bandera del Perú:** en la pieza principal, Dash sostiene una banderita peruana (roja, blanca, roja) en el ala levantada, ondeando. Usa `dash-bandera`, `dash-bandera-contorno` o `dash-volando-bandera`. La bandera siempre va pequeña, en el ala levantada y con los colores reales. No la uses sola como logo ni la deformes.
- En la web, la animación elegida es **Forma viva con Dash asomándose**. Una forma M3 cambia detrás de la página. Los bloques se abren desde una flor al entrar. En cada cambio de sección, Dash se asoma por un borde con una burbuja de diálogo (`.fcp-bubble`).
- Para video y reels: Dash entra por un borde, dice una frase corta en burbuja y sale. Las cintas corren como marquesina. Los titulares chicha aparecen capa por capa: sombra, contorno y luego relleno.
- Respeta el movimiento reducido: sin animación, todo queda visible y Dash se queda posado.

## Marca Flutter

- No uses el logo de Flutter como elemento principal. Si aparece, va con su margen mínimo (la altura de una "F"), separado del nombre del evento y con contraste AA.
- La marca del evento es el ícono de Dash más "FlutterConf Perú" en Bungee (o en FlutterChicha en piezas grandes). El logo definitivo está pendiente.
- Antes de imprimir merch con Dash, confirma el uso con el equipo de Flutter.

## Formatos

| Pieza | Tamaño | Componente |
| --- | --- | --- |
| Post | 1080 × 1080 | Post |
| Historia / reel | 1080 × 1920 | Historia |
| Diapositiva / pantalla | 1920 × 1080 | Diapositiva |
| Anuncio de ponente | 1080 × 1350 o 1080 × 1920 | CartaPonente dentro de Post o Historia |
