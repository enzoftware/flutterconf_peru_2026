# Chicha

Lettering chicha hecho con la fuente propia **FlutterChicha**: cinco capas apiladas, con las franjas blanca, amarilla fosforescente y naranja y la sombra azul del alfabeto pintado a mano. Úsalo para titulares en la web, posts, historias y diapositivas.

**Estructura:** un `span.fcp-chicha` con `.vh` (texto real, para lectores de pantalla) y seis capas con `aria-hidden`, de abajo hacia arriba:
1. `.sh`: FlutterChicha Sombra, en `fc-azul`.
2. `.k`: contorno `fc-negro`. Separa las letras de fondos de color.
3. `.b`: FlutterChicha (letra completa), en `fc-blanco`.
4. `.y`: FlutterChicha Amarillo, en `fc-amarillo`.
5. `.n`: FlutterChicha Naranja, en `fc-naranja`.
6. `.h`: FlutterChicha Brillo, en blanco al 80 %.

Las capas comparten métricas, así que calzan exactas. `<br>` corta la línea.

**Variantes:**
- Por defecto: con contorno, para cualquier fondo de la paleta (`navy-deep`, `blue`, `purple-deep`, `red`).
- `is-original`: sin contorno, como el alfabeto original. Úsala solo sobre `fc-negro` o `navy-deep`.

**Reglas:**
- Mayúsculas y minúsculas están permitidas. Escribe como en un afiche: "¡Flutter Conf Perú!", "Carga máxima".
- Úsalo desde 28 px. Para textos más chicos, usa Rubik.
- Una sola frase chicha por pieza. Los ornamentos ★ ⚡ ✺ son caracteres de la fuente.
- En Canva, Figma o Keynote: crea 5 cajas de texto idénticas, una por capa (Sombra, base, Amarillo, Naranja y Brillo), con el mismo texto, tamaño y posición, en ese orden de abajo hacia arriba. Agrupa las cajas antes de moverlas.
