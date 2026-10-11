const desktopViews = {
  itinerary: {
    src: "desktop-itinerary.jpg",
    alt: "Desktop itinerary: timeline on the left, a large map of the selected day's stops on the right",
    caption: "A substantial, sticky map beside the selected day's timeline.",
  },
  overview: {
    src: "desktop-overview.jpg",
    alt: "Desktop overview: compact trip header, aligned checklist and all-date weather forecast cards",
    caption: "A compact overview with a full-width checklist and an all-date forecast strip.",
  },
};

const capture = document.querySelector("#desktop-capture");
const caption = document.querySelector("#desktop-caption");
const controls = [...document.querySelectorAll("[data-view]")];

controls.forEach((button) => {
  button.addEventListener("click", () => {
    const view = desktopViews[button.dataset.view];
    if (!view) return;
    capture.src = view.src;
    capture.alt = view.alt;
    caption.textContent = view.caption;
    controls.forEach((control) => {
      const selected = control === button;
      control.classList.toggle("active", selected);
      control.setAttribute("aria-pressed", String(selected));
    });
  });
});
