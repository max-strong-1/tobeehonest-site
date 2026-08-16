export function bindMantraCard(element, {
  mantra = "",
  imageSrc = "",
  onFirstReveal = () => {},
} = {}) {
  const photo = element.querySelector(".card-photo");
  if (photo && imageSrc) photo.src = imageSrc;

  let hasBeenRevealed = false;
  const setState = (flipped) => {
    element.classList.toggle("flipped", flipped);
    element.setAttribute("aria-pressed", String(flipped));
    element.querySelector(".card-front")?.setAttribute("aria-hidden", String(!flipped));
    element.querySelector(".card-back")?.setAttribute("aria-hidden", String(flipped));
    element.setAttribute("aria-label", flipped
      ? `Mantra card, revealed: “${mantra}”. Activate to turn it face down again.`
      : "Mantra card, face down. Activate to reveal it.");

    if (flipped && !hasBeenRevealed) {
      hasBeenRevealed = true;
      onFirstReveal();
    }
  };

  const toggle = () => setState(!element.classList.contains("flipped"));
  element.addEventListener("click", toggle);
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  });
  setState(false);

  return { setState, toggle };
}
