document.querySelectorAll('.carousel').forEach(carousel => {
  const track = carousel.querySelector('.carousel-track');
  const slides = carousel.querySelectorAll('.carousel-slide');
  const prevBtn = carousel.querySelector('.carousel-prev');
  const nextBtn = carousel.querySelector('.carousel-next');
  const dotsContainer = carousel.querySelector('.carousel-dots');
  const count = slides.length;
  let current = 0;

  // Defer non-active slide images
  function loadSlide(index) {
    if (index < 0 || index >= count) return;
    slides[index].querySelectorAll('img[data-src], source[data-srcset]').forEach(el => {
      if (el.dataset.src) { el.src = el.dataset.src; el.removeAttribute('data-src'); }
      if (el.dataset.srcset) { el.srcset = el.dataset.srcset; el.removeAttribute('data-srcset'); }
    });
  }
  // Move src/srcset to data attributes for all slides except the first
  slides.forEach((slide, i) => {
    if (i === 0) return;
    slide.querySelectorAll('img[src], source[srcset]').forEach(el => {
      if (el.src) { el.dataset.src = el.src; el.removeAttribute('src'); }
      if (el.srcset) { el.dataset.srcset = el.srcset; el.removeAttribute('srcset'); }
    });
  });

  // Generate dots
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  }

  const dots = dotsContainer.querySelectorAll('.carousel-dot');

  function goTo(index) {
    current = Math.max(0, Math.min(index, count - 1));
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === count - 1;
    loadSlide(current);
    loadSlide(current - 1);
    loadSlide(current + 1);
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));
  goTo(0);

  // Touch/swipe support
  let touchStartX = 0;
  let touchDeltaX = 0;
  carousel.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchDeltaX = 0;
  }, { passive: true });
  carousel.addEventListener('touchmove', e => {
    touchDeltaX = e.touches[0].clientX - touchStartX;
  }, { passive: true });
  carousel.addEventListener('touchend', () => {
    if (Math.abs(touchDeltaX) > 50) {
      goTo(current + (touchDeltaX < 0 ? 1 : -1));
    }
  });
});
