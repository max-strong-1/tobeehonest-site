(() => {
  const responses = {
    overwhelmed: 'That does not mean you are failing. It may mean you are carrying too much without asking what still belongs to you.',
    lost: 'Lost is not empty. It is the honest space between an old direction and one you have not named yet.',
    anxious: 'Your mind may be trying to protect you by rehearsing every ending. You are allowed to interrupt the rehearsal.',
    stressed: 'Stress can make survival feel like a personality. It is a signal—not your identity.',
    fine: 'Maybe you are. Maybe “fine” is the answer that gets everyone to stop asking. Either way, curiosity is allowed.'
  };
  const buttons = [...document.querySelectorAll('[data-book-mood]')];
  const response = document.getElementById('bookMoodResponse');
  const cue = document.getElementById('bookScrollCue');
  const details = document.getElementById('bookDetails');
  if (!buttons.length || !response || !cue || !details) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      response.textContent = `${responses[button.dataset.bookMood]} That small pause—the moment you tell yourself the truth without turning it into a verdict—is where this book begins.`;
      cue.querySelector('span').textContent = 'Why this book exists';
    });
  });

  cue.addEventListener('click', () => {
    details.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  });
})();
