import {
  completePuzzle,
  createPuzzleState,
  movePiece,
  resetPuzzle,
  shouldSnap,
} from "./sun-bird-puzzle-state.js";
import { bindStripeCheckoutButton } from "./stripe-checkout.js";

const game = document.getElementById("sunBirdGame");
const piece = document.getElementById("sunBirdPiece");
const target = document.getElementById("sunBirdTarget");
const bee = document.getElementById("sunBirdBee");
const status = document.getElementById("sunBirdStatus");
const reset = document.getElementById("sunBirdReset");
const product = document.getElementById("sunBirdProduct");
const checkout = document.getElementById("sunBirdCheckout");
const checkoutError = document.getElementById("sunBirdCheckoutError");

if (game && piece && target && bee && status && reset && product && checkout && checkoutError) {
  let state = createPuzzleState();
  let drag = null;

  const render = () => {
    piece.style.transform = `translate3d(${state.piece.x}px, ${state.piece.y}px, 0)`;
  };

  const announceCompletion = ({ focusProduct = false } = {}) => {
    if (state.complete) return;
    state = completePuzzle(state);
    target.classList.add("filled");
    piece.classList.add("placed");
    game.classList.add("complete");
    product.dataset.revealed = "true";
    status.textContent = "Puzzle complete — you helped the Sun Bird take flight!";
    piece.setAttribute("aria-label", "The final Sun Bird puzzle piece is in place.");
    if (focusProduct) {
      product.setAttribute("tabindex", "-1");
      product.focus({ preventScroll: true });
      product.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const returnPiece = () => {
    state = movePiece(state, state.start);
    render();
  };

  piece.addEventListener("pointerdown", (event) => {
    if (state.complete) return;
    piece.setPointerCapture(event.pointerId);
    piece.classList.add("dragging");
    drag = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      originX: state.piece.x,
      originY: state.piece.y,
      distance: 0,
    };
  });

  piece.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId || state.complete) return;
    const dx = event.clientX - drag.clientX;
    const dy = event.clientY - drag.clientY;
    drag.distance = Math.max(drag.distance, Math.hypot(dx, dy));
    state = movePiece(state, { x: drag.originX + dx, y: drag.originY + dy });
    render();
  });

  const finishPointer = (event) => {
    if (!drag || event.pointerId !== drag.pointerId || state.complete) return;
    piece.classList.remove("dragging");
    const wasTap = drag.distance < 8;
    drag = null;
    if (shouldSnap(piece.getBoundingClientRect(), target.getBoundingClientRect()) || wasTap) {
      announceCompletion();
    } else {
      returnPiece();
    }
  };

  piece.addEventListener("pointerup", finishPointer);
  piece.addEventListener("pointercancel", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    piece.classList.remove("dragging");
    returnPiece();
  });

  piece.addEventListener("keydown", (event) => {
    if (state.complete) return;
    const step = event.shiftKey ? 28 : 12;
    const moves = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    if (moves[event.key]) {
      event.preventDefault();
      const move = moves[event.key];
      state = movePiece(state, { x: state.piece.x + move.x, y: state.piece.y + move.y });
      render();
      if (shouldSnap(piece.getBoundingClientRect(), target.getBoundingClientRect())) announceCompletion({ focusProduct: true });
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      announceCompletion({ focusProduct: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      returnPiece();
    }
  });

  reset.addEventListener("click", () => {
    state = resetPuzzle(state);
    target.classList.remove("filled");
    piece.classList.remove("placed", "dragging");
    game.classList.remove("complete");
    product.dataset.revealed = "false";
    product.removeAttribute("tabindex");
    status.textContent = "One brave little piece to go.";
    piece.setAttribute("aria-label", "The final Sun Bird puzzle piece. Drag it into the empty space or press Enter to place it.");
    render();
    piece.focus();
  });

  bindStripeCheckoutButton({
    button: checkout,
    errorBox: checkoutError,
    product: "puzzle"
  });

  render();
}
