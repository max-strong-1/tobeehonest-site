export function createJigsawState(pieceIds = Array.from({ length: 10 }, (_, index) => String(index))) {
  return {
    pieces: pieceIds.map((id) => ({ id: String(id), x: 0, y: 0, placed: false })),
    placedCount: 0,
    complete: false,
  };
}

export function moveJigsawPiece(state, pieceId, point) {
  return {
    ...state,
    pieces: state.pieces.map((piece) => piece.id === String(pieceId)
      ? (piece.placed ? piece : { ...piece, x: Number(point.x) || 0, y: Number(point.y) || 0 })
      : piece),
  };
}

export function placeJigsawPiece(state, pieceId) {
  const id = String(pieceId);
  if (state.pieces.find((piece) => piece.id === id)?.placed) return state;

  const pieces = state.pieces.map((piece) => piece.id === id
    ? { ...piece, x: 0, y: 0, placed: true }
    : piece);
  const placedCount = pieces.filter((piece) => piece.placed).length;
  return {
    ...state,
    pieces,
    placedCount,
    complete: placedCount === pieces.length,
  };
}

export function resetJigsaw(state) {
  return createJigsawState(state.pieces.map((piece) => piece.id));
}

export function shouldSnap(pieceRect, targetRect) {
  const width = Math.max(0, Math.min(pieceRect.right, targetRect.right) - Math.max(pieceRect.left, targetRect.left));
  const height = Math.max(0, Math.min(pieceRect.bottom, targetRect.bottom) - Math.max(pieceRect.top, targetRect.top));
  const pieceArea = Math.max(1, (pieceRect.right - pieceRect.left) * (pieceRect.bottom - pieceRect.top));
  return (width * height) / pieceArea >= 0.35;
}
