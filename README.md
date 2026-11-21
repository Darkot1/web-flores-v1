# Jardín vivo · web-flores-v1

Una web-regalo para Shara Melizza. La relación es un jardín que se cultiva:
cada día juntos, cada recuerdo y cada carta lo hacen crecer.

1. **Inicio** (amanecer): una semilla cae, brota y se abre una margarita morada.
2. **Recuerdos** (pleno día): el calendario y el jardín vivo que nace de ellos.
3. **Cartas** (atardecer y noche): la pérgola de cartas y el cierre con la margarita ya florecida.

Modo claro u oscuro con el botón Noche/Día (se recuerda en cada dispositivo). El jardín no depende del
tema: sigue la hora real (de día de 6:00 a 18:00, configurable en `config.gardenClock`); de noche hay luna, luciérnagas y los faroles de cada mesiversario encendidos.

**Zoom del jardín:** botones + / − / ver todo, pellizco en el móvil, Ctrl/⌘ + rueda o pellizco
del trackpad en el ordenador, doble toque o doble clic, y teclas + − 0 con el jardín enfocado.
Con zoom, se arrastra para recorrerlo.

## Comandos

```bash
npm install
npm run dev       # desarrollo
npm test          # reglas del jardín, layout, fechas y migración (node --test)
npm run build     # producción en dist/
```

## Personalizar

Todo lo editable está en `src/config.js`:

| Qué | Dónde |
| --- | --- |
| Nombre | `config.name` |
| Fecha de inicio | `config.relationshipStart` (`"YYYY-MM-DD"` o `null`). También se puede elegir desde la app en **Ajustes del jardín**, y eso tiene prioridad. Con `null` la web muestra "aún no empieza". |
| Nombres de él y ella | `config.authors` (por defecto "Él"/"Ella"). Se cambian desde la app en **Ajustes del jardín**. |
| Frases | `config.intro`, `config.memories`, `config.letters`, `config.closing`, `config.signature` |
| Clima | `config.climate`: `"tropical"` (Colombia: temporadas secas y de lluvias), `"north"` o `"south"` |
| Maduración | `config.growth` (días para brote → capullo → flor abierta → flor plena) |
| Música | `config.music.src`: `null` usa la nana del jardín; para vuestra canción copia el archivo a `public/musica/` y pon `"/musica/nombre.mp3"` |

**Cartas iniciales:** `src/data/letters.js`. La carta de las margaritas moradas es la primera.
Añade objetos al array con el mismo formato (`from`/`to` son `"el"` o `"ella"`).

**Hitos** (salen solos de la fecha de inicio):
- **El árbol del primer día:** dos troncos que se entrelazan hasta formar una sola copa de flores moradas. Preside la cabecera del camino y crece con los años: primero dos brotes enroscados, luego un árbol joven y al final un árbol pleno con un columpio.
- **Cada mes:** un farolillo colgado en la guirnalda del cielo, con una guirnalda de 12 luces por año. De noche se encienden.
- **Cada 3 meses:** un gran arco de flores sobre el camino, con los colores de la temporada. En el aniversario es dorado.
- **El estanque:** un pez por cada carta, del color de su flor, y un koi dorado por cada aniversario.
- **Días especiales:** al crear o editar un recuerdo, activa **"Es un día especial"**. Su margarita crece dentro de un corazón de flores doradas y moradas que brilla de noche, y el día se marca en dorado en el calendario.

Los recuerdos y las flores silvestres se reparten por todo el prado, desde el camino hasta los bordes.

## Guardado: modo local y modo compartido

| | Modo local (por defecto) | Modo compartido (Supabase) |
| --- | --- | --- |
| Dónde vive | `localStorage` de cada navegador | Base de datos en Supabase |
| Quién lo ve | Solo ese dispositivo | Los dos, cada uno en su dispositivo |
| Requisitos | Ninguno | `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` |
| Copia de seguridad | Ajustes → Descargar / Restaurar copia | En la nube |

Para activar el modo compartido:

1. Crea un proyecto en Supabase y ejecuta `supabase/schema.sql` en el SQL Editor.
2. Crea vuestro jardín con un código largo y privado (la última línea del SQL, descomentada).
3. Copia `.env.example` a `.env` con la URL y la anon key, y vuelve a hacer build/deploy.
4. Abrid la web con el enlace `https://tu-web/#c=TU-CODIGO`. El código se recuerda en cada dispositivo y se borra de la barra de direcciones.

Las tablas tienen RLS sin políticas: la anon key, que es pública, no puede leer nada por sí sola.
Todo pasa por funciones que exigen el código. Sin conexión se guarda en local y se sincroniza al volver.
Lo que plantó el otro aparece al volver a la pestaña o cada 30 s.

## Estructura

```
src/
  main.js                 arranque y orquestación
  config.js               nombre, fecha, autores, textos, clima
  data/letters.js         cartas iniciales
  lib/                    storage (+ local, supabase), store, migrate, dates, seed, motion, audio
  garden/growth.js        reglas puras: etapas, hitos, estaciones, matas
  garden/layout.js        posiciones deterministas (camino en perspectiva)
  garden/symbols.js       sprite SVG (<symbol>/<use>)
  garden/renderer.js      dibujo e interacción del jardín
  components/             daisy, intro, counters, calendar, memory-sheet, timeline,
                          letters, letter-composer, settings, modal, toast
  styles/                 tokens, base, hero, calendar, garden, letters, dialogs
supabase/schema.sql
tests/
```
