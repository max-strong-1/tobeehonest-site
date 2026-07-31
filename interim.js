(() => {
  'use strict';

  const body = document.body;
  const constructionView = document.querySelector('.construction-view');
  const previewShell = document.querySelector('#site-preview');
  const iframe = document.querySelector('#approved-site');
  const peekButton = document.querySelector('#peek-button');
  const returnButton = document.querySelector('#return-button');
  const combNote = document.querySelector('#comb-note');
  const cells = document.querySelectorAll('.comb-cell');
  const cornerBee = document.querySelector('#corner-bee');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let focusTimer = 0;

  const setPreviewState = (isPreviewing) => {
    if (isPreviewing && !iframe.src) {
      iframe.src = iframe.dataset.src;
    }

    window.clearTimeout(focusTimer);
    body.classList.toggle('is-previewing', isPreviewing);
    constructionView.inert = isPreviewing;
    previewShell.inert = !isPreviewing;
    if (isPreviewing) {
      constructionView.setAttribute('inert', '');
      previewShell.removeAttribute('inert');
    } else {
      constructionView.removeAttribute('inert');
      previewShell.setAttribute('inert', '');
    }
    previewShell.setAttribute('aria-hidden', String(!isPreviewing));
    peekButton.setAttribute('aria-expanded', String(isPreviewing));

    focusTimer = window.setTimeout(() => {
      (isPreviewing ? returnButton : peekButton).focus({ preventScroll: true });
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 430);
  };

  peekButton.addEventListener('click', () => setPreviewState(true));
  returnButton.addEventListener('click', () => setPreviewState(false));

  cells.forEach((cell) => {
    cell.addEventListener('click', () => {
      cells.forEach((item) => item.classList.toggle('is-active', item === cell));
      combNote.textContent = cell.dataset.note;
    });
  });

  if (cornerBee) {
    const drag = { pointerId: null, startX: 0, startY: 0, moved: false };
    const maxDistance = 64;

    const pollenBurst = (x, y) => {
      if (reducedMotion.matches) return;
      for (let index = 0; index < 6; index += 1) {
        const pollen = document.createElement('i');
        const angle = (Math.PI * 2 * index) / 6;
        const distance = 18 + (index % 2) * 8;
        pollen.className = 'corner-pollen';
        pollen.style.left = `${x}px`;
        pollen.style.top = `${y}px`;
        pollen.style.setProperty('--corner-dx', `${Math.cos(angle) * distance}px`);
        pollen.style.setProperty('--corner-dy', `${Math.sin(angle) * distance}px`);
        document.body.append(pollen);
        pollen.addEventListener('animationend', () => pollen.remove(), { once: true });
      }
    };

    const returnHome = () => {
      cornerBee.classList.remove('is-dragging');
      cornerBee.classList.add('is-returning');
      cornerBee.style.transform = 'translate3d(0, 0, 0)';
      window.setTimeout(() => cornerBee.classList.remove('is-returning'), reducedMotion.matches ? 0 : 520);
    };

    cornerBee.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || drag.pointerId !== null) return;
      event.preventDefault();
      drag.pointerId = event.pointerId;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.moved = false;
      cornerBee.classList.remove('is-returning');
      cornerBee.classList.add('is-dragging');
      cornerBee.setPointerCapture(event.pointerId);
    });

    cornerBee.addEventListener('pointermove', (event) => {
      if (event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      let dx = event.clientX - drag.startX;
      let dy = event.clientY - drag.startY;
      const distance = Math.hypot(dx, dy);
      if (distance > maxDistance) {
        const scale = maxDistance / distance;
        dx *= scale;
        dy *= scale;
      }
      drag.moved ||= distance > 4;
      cornerBee.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    });

    const finishDrag = (event, emitPollen) => {
      if (event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      if (cornerBee.hasPointerCapture(event.pointerId)) {
        cornerBee.releasePointerCapture(event.pointerId);
      }
      if (emitPollen) pollenBurst(event.clientX, event.clientY);
      drag.pointerId = null;
      returnHome();
    };

    cornerBee.addEventListener('pointerup', (event) => finishDrag(event, true));
    cornerBee.addEventListener('pointercancel', (event) => finishDrag(event, false));

    cornerBee.addEventListener('click', (event) => {
      if (event.detail !== 0) return;
      const rect = cornerBee.getBoundingClientRect();
      pollenBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
      cornerBee.classList.add('is-returning');
      cornerBee.style.transform = 'translate3d(18px, -12px, 0)';
      window.requestAnimationFrame(() => window.requestAnimationFrame(returnHome));
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && body.classList.contains('is-previewing')) {
      setPreviewState(false);
    }
  });

  window.addEventListener('pageshow', () => {
    setPreviewState(false);
  });
})();
