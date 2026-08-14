export function createPuzzleState(start = { x: 0, y: 0 }) {
  const point = { x: Number(start.x) || 0, y: Number(start.y) || 0 };
  return { start: point, piece: { ...point }, complete: false };
}

export function movePiece(state, point) {
  return {
    ...state,
    piece: { x: Number(point.x) || 0, y: Number(point.y) || 0 },
  };
}

export function shouldSnap(pieceRect, targetRect) {
  const width = Math.max(0, Math.min(pieceRect.right, targetRect.right) - Math.max(pieceRect.left, targetRect.left));
  const height = Math.max(0, Math.min(pieceRect.bottom, targetRect.bottom) - Math.max(pieceRect.top, targetRect.top));
  const pieceArea = Math.max(1, (pieceRect.right - pieceRect.left) * (pieceRect.bottom - pieceRect.top));
  return (width * height) / pieceArea >= 0.35;
}

export function completePuzzle(state) {
  return { ...state, complete: true };
}

export function resetPuzzle(state) {
  return createPuzzleState(state.start);
}
