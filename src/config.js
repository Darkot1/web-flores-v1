/**
 * Configuración del jardín. Edita aquí el nombre, los textos y la fecha.
 *
 * - relationshipStart: "YYYY-MM-DD" o null. Con null el jardín muestra
 *   "aún no empieza" y se puede elegir la fecha desde la app (Ajustes).
 *   Lo que se elija en la app tiene prioridad sobre este valor.
 * - authors: nombres por defecto; se pueden cambiar desde la app.
 * - climate: "tropical" (Colombia: temporadas secas y de lluvias), "north" o "south".
 */
export const config = {
  /** Nombre de la página (pestaña del navegador y marca de la barra). */
  title: "Nuestro jardín",
  name: "Shara Melizza",
  relationshipStart: null,
  authors: {
    el: "Él",
    ella: "Ella",
  },
  climate: "tropical",

  /** Horas (locales) en que el jardín pasa a día y a noche. Colombia: ~6:00 y ~18:00. */
  gardenClock: { sunrise: 6, sunset: 18 },

  intro: {
    eyebrow: "Un jardín para",
    phrase: "Todo empezó como una semilla.",
    body: "Cada día juntos, cada recuerdo y cada carta lo hacen crecer. Mira cómo florece.",
    notStarted: "Nuestro jardín aún no empieza… pero la semilla ya está aquí.",
  },

  memories: {
    title: "La tierra donde plantamos lo vivido",
    body: "Toca un día para sembrar un recuerdo. Cada uno se vuelve una margarita que madura con el tiempo.",
  },

  letters: {
    title: "Las flores que nos regalamos",
    body: "Cartas que cuelgan de la pérgola. Cada una florece también en el jardín.",
  },

  closing: {
    phrase: "…y seguirá creciendo.",
    body: "Todo esto lo plantamos juntos.",
  },

  signature: "Con todo mi cariño",

  /**
   * Música. Con src: null suena la nana sintetizada del jardín.
   * Para usar vuestra canción, copia el archivo a public/musica/ y pon, por ejemplo:
   *   src: "/musica/nuestra-cancion.mp3"
   */
  music: { src: null },

  /** Días de antigüedad para cada etapa de la flor. */
  growth: { sprout: 0, bud: 7, open: 30, full: 90 },

  /** Límite de flores individuales antes de agruparlas en matas. */
  caps: {
    mobile: { flowers: 50, wild: 24, grass: 60 },
    desktop: { flowers: 250, wild: 90, grass: 150 },
  },
};
