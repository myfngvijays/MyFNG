'use client';

import { useEffect } from 'react';

export default function HtmlStyleEffects() {
  useEffect(() => {
    const menu = document.getElementById('mobileMenu');
    const hamburger = document.getElementById('blogHamburgerBtn');

    const onHamburgerClick = () => {
      if (!menu) return;
      menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
    };

    if (hamburger) hamburger.addEventListener('click', onHamburgerClick);

    const faqItems = Array.from(document.querySelectorAll<HTMLElement>('.blog-html-wrap .faq-item'));
    const faqHandlers = faqItems.map((item) => {
      const handler = () => {
        faqItems.forEach((el) => {
          if (el !== item) {
            el.classList.remove('active');
            const otherIcon = el.querySelector('i');
            if (otherIcon) {
              otherIcon.classList.remove('fa-minus');
              otherIcon.classList.add('fa-plus');
            }
          }
        });

        item.classList.toggle('active');
        const icon = item.querySelector('i');
        if (icon) {
          icon.classList.toggle('fa-plus');
          icon.classList.toggle('fa-minus');
        }
      };
      item.addEventListener('click', handler);
      return { item, handler };
    });

    const slides = Array.from(document.querySelectorAll<HTMLElement>('.blog-html-wrap .service-slider .service-slide'));
    const slider = document.querySelector<HTMLElement>('.blog-html-wrap .service-slider');

    let index = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const showSlide = (i: number) => {
      slides.forEach((slide) => {
        slide.classList.remove('active');
        slide.style.left = '100%';
      });
      const next = slides[i];
      if (!next) return;
      next.classList.add('active');
      next.style.left = '0';
    };

    const nextSlide = () => {
      if (slides.length <= 1) return;
      index = (index + 1) % slides.length;
      showSlide(index);
    };

    const startSlider = () => {
      if (slides.length <= 1 || intervalId) return;
      intervalId = setInterval(nextSlide, 2000);
    };

    const stopSlider = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const onMouseEnter = () => stopSlider();
    const onMouseLeave = () => startSlider();

    if (slides.length > 0) {
      showSlide(0);
      startSlider();
    }

    if (slider) {
      slider.addEventListener('mouseenter', onMouseEnter);
      slider.addEventListener('mouseleave', onMouseLeave);
    }

    return () => {
      if (hamburger) hamburger.removeEventListener('click', onHamburgerClick);
      faqHandlers.forEach(({ item, handler }) => item.removeEventListener('click', handler));
      if (slider) {
        slider.removeEventListener('mouseenter', onMouseEnter);
        slider.removeEventListener('mouseleave', onMouseLeave);
      }
      stopSlider();
    };
  }, []);

  return null;
}

