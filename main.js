document.addEventListener("DOMContentLoaded", () => {
  /*
   * Navegación suave entre escenas.
   */
  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.scroll);

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });

  /*
   * Activa los textos cuando entran en pantalla.
   */
  const revealElements = document.querySelectorAll(".reveal");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    {
      threshold: 0.2
    }
  );

  revealElements.forEach((element) => observer.observe(element));

  /*
   * Parallax muy ligero para el jardín.
   * No mueve la página: solamente cambia la posición visual
   * de algunos elementos mientras hacemos scroll.
   */
  const garden = document.querySelector(".garden");
  const moon = document.querySelector(".moon");

  let ticking = false;

  const updateParallax = () => {
    const scrollY = window.scrollY;
    const gardenSection = document.querySelector("#jardin");

    if (garden && gardenSection) {
      const rect = gardenSection.getBoundingClientRect();
      const progress = Math.max(
        -1,
        Math.min(1, -rect.top / window.innerHeight)
      );

      garden.style.transform =
        `translateX(-50%) translateY(${progress * 18}px)`;
    }

    if (moon && gardenSection) {
      const rect = gardenSection.getBoundingClientRect();
      const progress = Math.max(
        -1,
        Math.min(1, -rect.top / window.innerHeight)
      );

      moon.style.transform =
        `translate(${progress * -18}px, ${progress * 8}px)`;
    }

    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }, { passive: true });

  updateParallax();
});
