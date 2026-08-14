import { readFileSync, writeFileSync } from 'node:fs';

const width = 800;
const height = 1200;
const columns = 25;
const rows = 40;
const cellWidth = width / columns;
const cellHeight = height / rows;
const tabDepth = 7;
const artworkData = readFileSync(
  new URL('../assets/web/sun-bird-puzzle.webp', import.meta.url),
).toString('base64');

function verticalBoundary(column) {
  const x = column * cellWidth;
  let path = `M ${x} 0`;

  for (let row = 0; row < rows; row += 1) {
    const top = row * cellHeight;
    const direction = (column + row) % 2 === 0 ? 1 : -1;
    const bump = x + direction * tabDepth;
    path += [
      ` L ${x} ${top + cellHeight / 3}`,
      ` C ${x} ${top + cellHeight / 3} ${bump} ${top + cellHeight / 3} ${bump} ${top + cellHeight / 2}`,
      ` C ${bump} ${top + (cellHeight * 2) / 3} ${x} ${top + (cellHeight * 2) / 3} ${x} ${top + (cellHeight * 2) / 3}`,
      ` L ${x} ${top + cellHeight}`,
    ].join('');
  }

  return path;
}

function horizontalBoundary(row) {
  const y = row * cellHeight;
  let path = `M 0 ${y}`;

  for (let column = 0; column < columns; column += 1) {
    const left = column * cellWidth;
    const direction = (column + row) % 2 === 0 ? 1 : -1;
    const bump = y + direction * tabDepth;
    path += [
      ` L ${left + cellWidth / 3} ${y}`,
      ` C ${left + cellWidth / 3} ${y} ${left + cellWidth / 3} ${bump} ${left + cellWidth / 2} ${bump}`,
      ` C ${left + (cellWidth * 2) / 3} ${bump} ${left + (cellWidth * 2) / 3} ${y} ${left + (cellWidth * 2) / 3} ${y}`,
      ` L ${left + cellWidth} ${y}`,
    ].join('');
  }

  return path;
}

const verticalLines = Array.from(
  { length: columns - 1 },
  (_, index) => `    <path class="cut-line cut-line--vertical" data-boundary="vertical-${index + 1}" d="${verticalBoundary(index + 1)}"/>`,
).join('\n');

const horizontalLines = Array.from(
  { length: rows - 1 },
  (_, index) => `    <path class="cut-line cut-line--horizontal" data-boundary="horizontal-${index + 1}" d="${horizontalBoundary(index + 1)}"/>`,
).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" data-columns="${columns}" data-rows="${rows}" data-piece-count="${columns * rows}" role="img" aria-labelledby="title description">
  <title id="title">The Sun Bird 1,000-piece cut preview</title>
  <desc id="description">Nicolas Bettinger's Sun Bird artwork divided by a complete 25-column by 40-row jigsaw cut map.</desc>
  <image href="data:image/webp;base64,${artworkData}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  <g fill="none" stroke="#23170f" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" opacity=".92">
    <rect x="1.1" y="1.1" width="${width - 2.2}" height="${height - 2.2}" rx="1"/>
${verticalLines}
${horizontalLines}
  </g>
</svg>
`;

writeFileSync(new URL('../assets/web/sun-bird-puzzle-cutmap.svg', import.meta.url), svg);
