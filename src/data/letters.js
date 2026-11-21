/**
 * Cartas iniciales. Se muestran siempre (no se pueden borrar desde la app).
 * Las cartas nuevas que se escriban desde la web se guardan aparte (storage).
 *
 * Formato: { id, title, date, from, to, intro, body: [párrafos], signature,
 *            flower: { color, petals }, sealColor }
 * - from / to: "el" | "ella" (los nombres se toman de Ajustes).
 * - flower.color: "morada" | "lavanda" | "blanca" | "dorada" | "ciruela"
 * - flower.petals: 13 | 16 | 21 (pétalos de su margarita)
 * - flower.rain: pétalos que caen al abrirla: "morados" | "lavanda" | "dorados" | "blancos" | "mezcla" | "ninguno"
 * - date: "YYYY-MM-DD". Si la dejas en null se usa la fecha de inicio del jardín.
 */
export const initialLetters = [
  {
    id: "carta-margaritas-moradas",
    title: "Para ti",
    date: null,
    from: "el",
    to: "ella",
    intro: "Y esto era para decirte...",
    body: [
      "que quiero que te vuelvas la persona más importante para mí. Porque contigo siento que el mundo se vuelve más bonito, más tranquilo, y más lleno de sentido.",
      "Como sé que tus preferidas son las margaritas moradas, también florecen para ti. Quiero tenerte cerca, cuidarte, apoyarte y compartir contigo cada instante que la vida me permita.",
    ],
    signature: "Con todo mi cariño",
    flower: { color: "morada", petals: 21, rain: "morados" },
    sealColor: "ciruela",
    initial: true,
  },
];
