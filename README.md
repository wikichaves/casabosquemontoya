# Casa Bosque Montoya

Landing del proyecto **Casa Bosque Montoya** — cuatro casas vacacionales de baja densidad entre pinos y mar, en Montoya, La Barra (Maldonado, Uruguay). Apertura diciembre 2026.

🌐 **Producción:** https://casabosquemontoya.com

## Stack

Sitio **estático**, sin build step. Todo vive en un único `index.html` (HTML + CSS + JS inline).

- HTML/CSS/JS vanilla — sin frameworks ni dependencias de runtime
- Tipografías vía Google Fonts: Instrument Serif, JetBrains Mono, Geist
- Bilingüe ES/EN con un i18n propio en JS (sin librerías)
- Hosting en **Vercel** (estático, `framework: null`) + Vercel Web Analytics

> El proyecto fue Next.js en un inicio y se simplificó a HTML/CSS/JS estático. Si ves `.next/` o `node_modules/` localmente son residuos ignorados por git.

## Estructura

```
index.html        Toda la página (markup + estilos + scripts)
assets/           Imágenes del sitio (renders, logo, favicon, OG)
uploads/          Imágenes fuente / generadas (no necesariamente usadas)
vercel.json       Config de Vercel (estático puro)
.claude/          Config de tooling local (launch.json para preview)
```

`_archive/` y `_downloads/` están ignorados por git.

## Desarrollo local

Al ser estático, alcanza con servir la carpeta:

```bash
python3 -m http.server 4321
# luego abrir http://localhost:4321
```

(Existe `.claude/launch.json` con ese mismo server para el preview integrado.)

También se puede abrir `index.html` directo en el navegador, aunque servirlo por HTTP es más fiel a producción.

## Editar contenido

El sitio es **bilingüe (ES / EN)** y el español es el contenido por defecto del HTML (fallback sin JS). El inglés se aplica encima por JS.

**Para cambiar un texto traducible hay que tocarlo en DOS lugares:**

1. El markup HTML — es el texto en español (default) y lleva un atributo:
   - `data-i18n="clave"` → reemplaza `textContent`
   - `data-i18n-html="clave"` → reemplaza `innerHTML` (cuando hay `<em>`, `<br>`, etc.)
   - `data-i18n-attr="alt:clave"` → reemplaza un atributo (alt, aria-label…)
2. El diccionario `T` dentro del `<script>` — entradas `es` **y** `en` para esa misma `clave`.

Si una clave existe en el HTML pero falta en el diccionario, al cambiar de idioma ese texto no se traduce. Mantené ambos lados en sync.

Texto fijo (nombres propios: Montoya, La Barra, José Ignacio, etc.) va marcado con `translate="no"` y se excluye del i18n.

Detalles de comportamiento del selector de idioma:
- Idioma inicial: `localStorage['cbm-lang']` › `navigator.language` › `es`
- La elección se persiste en `localStorage`
- Actualiza `<html lang>` en cada cambio

## Deploy

Push a `main` → Vercel despliega automáticamente. No hay paso de build.
