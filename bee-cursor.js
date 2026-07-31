/*
 * To Bee Honest ink bee cursor.
 * Self-contained progressive enhancement; remove this file and its stylesheet
 * references to restore the native cursor.
 */
(() => {
  'use strict';

  const finePointer = window.matchMedia('(pointer: fine) and (hover: hover)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!finePointer.matches || reducedMotion.matches) return;

  const editableSelector =
    'input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]';
  const interactiveSelector =
    'a, button, [role="button"], select, label, [tabindex]:not([tabindex="-1"])';

  const bee = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  bee.setAttribute('class', 'tbh-bee-cursor');
  bee.setAttribute('viewBox', '0 0 48 48');
  bee.setAttribute('aria-hidden', 'true');
  bee.innerHTML = `
    <g class="tbh-wing tbh-wing-left">
      <path d="M20 22C7 21 5 7 12 6c8-1 12 9 8 16Z"
        fill="#fff9de" fill-opacity=".72" stroke="#262015" stroke-width="1.5"/>
    </g>
    <g class="tbh-wing tbh-wing-right">
      <path d="M28 22C41 21 43 7 36 6c-8-1-12 9-8 16Z"
        fill="#fff9de" fill-opacity=".72" stroke="#262015" stroke-width="1.5"/>
    </g>
    <g class="tbh-bee-body">
      <path d="M24 13c8 0 13 7 12 16-1 8-6 13-12 13S13 37 12 29c-1-9 4-16 12-16Z"
        fill="#e69a17" stroke="#262015" stroke-width="1.8"/>
      <path d="M14 22c6 2 14 2 20 0M12.5 29c8 2 15 2 23 0M15 36c6 1.5 12 1.5 18 0"
        fill="none" stroke="#262015" stroke-width="3.5"/>
      <circle cx="20.5" cy="16.5" r="1.2" fill="#262015"/>
      <circle cx="27.5" cy="16.5" r="1.2" fill="#262015"/>
      <path d="M20 12C18 7 15 7 14 5M28 12c2-5 5-5 6-7M35 31l7 3-7 2"
        fill="none" stroke="#262015" stroke-width="1.5" stroke-linecap="round"/>
    </g>`;
  document.body.append(bee);
  document.documentElement.classList.add('bee-cursor-enabled');

  const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const current = { x: target.x, y: target.y };
  let previousX = target.x;
  let angle = 0;
  let frameId = 0;

  const setHoverState = (event) => {
    const element = event.target instanceof Element ? event.target : null;
    const overEditable = Boolean(element?.closest(editableSelector));
    const overInteractive = Boolean(element?.closest(interactiveSelector));
    bee.classList.toggle('is-hovering', overInteractive && !overEditable);
    bee.classList.toggle('is-visible', !overEditable);
  };

  const createPollenBurst = (x, y) => {
    const count = 10;
    for (let index = 0; index < count; index += 1) {
      const pollen = document.createElement('i');
      const theta = (Math.PI * 2 * index) / count;
      const distance = 46 + Math.random() * 42;
      pollen.className = 'tbh-pollen';
      pollen.style.left = `${x}px`;
      pollen.style.top = `${y}px`;
      pollen.style.setProperty('--tbh-dx', `${Math.cos(theta) * distance}px`);
      pollen.style.setProperty('--tbh-dy', `${Math.sin(theta) * distance}px`);
      document.body.append(pollen);
      pollen.addEventListener('animationend', () => pollen.remove(), { once: true });
    }
  };

  const animate = () => {
    current.x += (target.x - current.x) * .19;
    current.y += (target.y - current.y) * .19;
    const velocityX = current.x - previousX;
    previousX = current.x;
    angle += (velocityX * 2.4 - angle) * .12;
    angle = Math.max(-22, Math.min(22, angle));
    bee.style.transform =
      `translate3d(${current.x - 19}px, ${current.y - 24}px, 0) rotate(${angle}deg)`;
    frameId = window.requestAnimationFrame(animate);
  };

  window.addEventListener('pointermove', (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
    setHoverState(event);
  }, { passive: true });

  window.addEventListener('pointerover', setHoverState, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => {
    bee.classList.remove('is-visible', 'is-hovering');
  });

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    bee.classList.add('is-clicking');
    createPollenBurst(event.clientX, event.clientY);
  });

  window.addEventListener('pointerup', () => bee.classList.remove('is-clicking'));
  window.addEventListener('pointercancel', () => bee.classList.remove('is-clicking'));

  const disable = () => {
    window.cancelAnimationFrame(frameId);
    document.documentElement.classList.remove('bee-cursor-enabled');
    bee.remove();
    document.querySelectorAll('.tbh-pollen').forEach((pollen) => pollen.remove());
  };

  finePointer.addEventListener('change', (event) => {
    if (!event.matches) disable();
  }, { once: true });
  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) disable();
  }, { once: true });

  animate();
})();
