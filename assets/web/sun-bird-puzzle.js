import {
  createJigsawState,
  moveJigsawPiece,
  placeJigsawPiece,
  resetJigsaw,
  shouldSnap,
} from "./sun-bird-puzzle-state.js";
import { bindStripeCheckoutButton } from "./stripe-checkout.js";

const game = document.getElementById("sunBirdGame");
const pieces = [...document.querySelectorAll(".sun-bird-piece[data-piece-id]")];
const targets = new Map(
  [...document.querySelectorAll(".sun-bird-target[data-slot]")]
    .map((target) => [target.dataset.slot, target])
);
const status = document.getElementById("sunBirdStatus");
const reset = document.getElementById("sunBirdReset");
const product = document.getElementById("sunBirdProduct");
const checkout = document.getElementById("sunBirdCheckout");
const checkoutError = document.getElementById("sunBirdCheckoutError");

if (
  game && pieces.length === 10 && targets.size === 10 && status && reset &&
  product && checkout && checkoutError
) {
  let state = createJigsawState(pieces.map((piece) => piece.dataset.pieceId));
  let drag = null;

  const pieceState = (piece) => state.pieces.find((item) => item.id === piece.dataset.pieceId);

  const renderPiece = (piece) => {
    const current = pieceState(piece);
    piece.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) rotate(var(--piece-tilt))`;
  };

  const updateProgress = () => {
    const remaining = state.pieces.length - state.placedCount;
    status.textContent = remaining === 1
      ? "One piece left. You can almost hear the wings."
      : `${remaining} loose pieces are still looking for their homes.`;
  };

  const announceCompletion = ({ focusProduct = false } = {}) => {
    game.classList.add("complete");
    product.dataset.revealed = "true";
    status.textContent = "Puzzle complete — the Sun Bird is whole again!";
    if (focusProduct) {
      product.setAttribute("tabindex", "-1");
      product.focus({ preventScroll: true });
      product.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const returnPiece = (piece) => {
    state = moveJigsawPiece(state, piece.dataset.pieceId, { x: 0, y: 0 });
    renderPiece(piece);
  };

  const placePiece = (piece, { focusProduct = false } = {}) => {
    if (pieceState(piece).placed) return;
    const id = piece.dataset.pieceId;
    state = placeJigsawPiece(state, id);
    targets.get(id).classList.add("filled");
    piece.classList.add("placed");
    piece.setAttribute("aria-label", `Sun Bird puzzle piece ${Number(id) + 1} is in its correct place.`);
    if (state.complete) announceCompletion({ focusProduct });
    else updateProgress();
  };

  for (const piece of pieces) {
    piece.addEventListener("pointerdown", (event) => {
      const current = pieceState(piece);
      if (current.placed) return;
      piece.setPointerCapture(event.pointerId);
      piece.classList.add("dragging");
      drag = {
        piece,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        originX: current.x,
        originY: current.y,
      };
    });

    piece.addEventListener("pointermove", (event) => {
      if (!drag || drag.piece !== piece || event.pointerId !== drag.pointerId) return;
      state = moveJigsawPiece(state, piece.dataset.pieceId, {
        x: drag.originX + event.clientX - drag.clientX,
        y: drag.originY + event.clientY - drag.clientY,
      });
      renderPiece(piece);
    });

    piece.addEventListener("pointerup", (event) => {
      if (!drag || drag.piece !== piece || event.pointerId !== drag.pointerId) return;
      piece.classList.remove("dragging");
      drag = null;
      const target = targets.get(piece.dataset.pieceId);
      if (shouldSnap(piece.getBoundingClientRect(), target.getBoundingClientRect())) placePiece(piece);
      else returnPiece(piece);
    });

    piece.addEventListener("pointercancel", (event) => {
      if (!drag || drag.piece !== piece || event.pointerId !== drag.pointerId) return;
      drag = null;
      piece.classList.remove("dragging");
      returnPiece(piece);
    });

    piece.addEventListener("keydown", (event) => {
      if (pieceState(piece).placed) return;
      const step = event.shiftKey ? 28 : 12;
      const moves = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      if (moves[event.key]) {
        event.preventDefault();
        const current = pieceState(piece);
        state = moveJigsawPiece(state, piece.dataset.pieceId, {
          x: current.x + moves[event.key].x,
          y: current.y + moves[event.key].y,
        });
        renderPiece(piece);
        const target = targets.get(piece.dataset.pieceId);
        if (shouldSnap(piece.getBoundingClientRect(), target.getBoundingClientRect())) {
          placePiece(piece, { focusProduct: true });
        }
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        placePiece(piece, { focusProduct: true });
      } else if (event.key === "Escape") {
        event.preventDefault();
        returnPiece(piece);
      }
    });

    renderPiece(piece);
  }

  reset.addEventListener("click", () => {
    state = resetJigsaw(state);
    for (const target of targets.values()) target.classList.remove("filled");
    for (const piece of pieces) {
      piece.classList.remove("placed", "dragging");
      piece.setAttribute(
        "aria-label",
        `Loose Sun Bird puzzle piece ${Number(piece.dataset.pieceId) + 1}. Drag it to its matching opening or press Enter to place it.`
      );
      renderPiece(piece);
    }
    game.classList.remove("complete");
    product.dataset.revealed = "false";
    product.removeAttribute("tabindex");
    status.textContent = "Ten loose pieces. Ten little homes.";
    pieces[0].focus();
  });

  bindStripeCheckoutButton({
    button: checkout,
    errorBox: checkoutError,
    product: "puzzle"
  });
}
