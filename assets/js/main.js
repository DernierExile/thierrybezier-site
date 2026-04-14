/* ═══════════════════════════════════════════════════════════
   THIERRY BÉZIER — Main JS
   Hero slider · works grid · filters · i18n · nav · form
   ═══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const WORKS = window.WORKS_DATA || [];
  const I18N = window.I18N || {};
  const SUPPORTED = ['en', 'fr', 'jp'];
  let currentLang = localStorage.getItem('tb_lang') || detectLang();

  function detectLang() {
    const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    if (nav === 'fr') return 'fr';
    if (nav === 'ja') return 'jp';
    return 'en';
  }

  /* ═══════ Preloader ═══════ */
  window.addEventListener('load', () => {
    setTimeout(() => $('#preloader')?.classList.add('hidden'), 600);
  });

  /* ═══════ Year ═══════ */
  const yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ═══════ i18n apply ═══════ */
  function applyLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = 'en';
    currentLang = lang;
    localStorage.setItem('tb_lang', lang);
    document.documentElement.lang = lang === 'jp' ? 'ja' : lang;

    const dict = I18N[lang] || {};
    $$('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.textContent = dict[key];
    });
    $$('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (dict[key] != null) el.innerHTML = dict[key];
    });

    $$('.lang-switcher button').forEach(b => {
      const on = b.getAttribute('data-lang') === lang;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    renderWorks();
  }

  $$('.lang-switcher button').forEach(btn => {
    btn.addEventListener('click', () => applyLang(btn.getAttribute('data-lang')));
  });

  /* ═══════ Hero slider ═══════ */
  function initHero() {
    const slider = $('#heroSlider');
    const dotsEl = $('#heroDots');
    if (!slider) return;

    // Select 6 visually strong slides
    const picks = [
      'mars-2026-works.jpg',
      'gorgonz-2026.jpg',
      're-cyberpunk.jpg',
      'japanese-armors.jpg',
      'lady-in-the-machine.jpg',
      'daybreak-fuji.jpg'
    ];

    picks.forEach((f, i) => {
      const slide = document.createElement('div');
      slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
      slide.style.backgroundImage = `url('assets/img/works/${f}')`;
      slider.appendChild(slide);

      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      if (i === 0) dot.classList.add('active');
      dot.addEventListener('click', () => go(i));
      dotsEl.appendChild(dot);
    });

    const slides = $$('.hero-slide', slider);
    const dots = $$('button', dotsEl);
    let idx = 0, timer;

    function go(n) {
      slides[idx].classList.remove('active');
      dots[idx].classList.remove('active');
      idx = (n + slides.length) % slides.length;
      slides[idx].classList.add('active');
      dots[idx].classList.add('active');
      restart();
    }
    function restart() {
      clearInterval(timer);
      timer = setInterval(() => go(idx + 1), 6000);
    }
    restart();
  }

  /* ═══════ Works grid ═══════ */
  function renderWorks(filter = null) {
    const grid = $('#workGrid');
    if (!grid) return;
    const active = filter || $('.filter.active')?.getAttribute('data-filter') || 'all';

    grid.innerHTML = WORKS.map((w, i) => {
      const title = w.title[currentLang] || w.title.en;
      const desc = w.desc[currentLang] || w.desc.en;
      const show = active === 'all' || w.cat === active;
      const count = (w.images && w.images.length) || 1;
      const hasVideo = !!w.video;
      const ariaLabel = hasVideo ? `${title} — play video` : `${title} — open gallery`;
      const badge = hasVideo
        ? `<div class="work-card-badge work-card-badge-video"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg> VIDEO</div>`
        : (count > 1 ? `<div class="work-card-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg> ${count}</div>` : '');
      const playOverlay = hasVideo ? `<div class="work-card-play" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg></div>` : '';
      return `
        <article class="work-card ${show ? '' : 'hidden'} ${hasVideo ? 'has-video' : ''}" data-cat="${w.cat}" data-idx="${i}" tabindex="0" role="button" aria-label="${escapeHtml(ariaLabel)}">
          <img src="assets/img/works/${w.img}" alt="${escapeHtml(title)}" loading="lazy">
          ${playOverlay}
          ${badge}
          <div class="work-card-info">
            <div class="work-card-meta">${w.year} · ${w.catLabel}</div>
            <h3 class="work-card-title">${escapeHtml(title)}</h3>
            <p class="work-card-desc">${escapeHtml(desc)}</p>
          </div>
        </article>`;
    }).join('');

    // Wire click → open lightbox
    $$('.work-card', grid).forEach(card => {
      card.addEventListener('click', () => openLightbox(parseInt(card.dataset.idx, 10), 0));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(parseInt(card.dataset.idx, 10), 0); }
      });
    });
  }

  /* ═══════ Lightbox ═══════ */
  let lbState = { workIdx: -1, imgIdx: 0, images: [], isVideo: false };
  const lb = $('#lightbox');
  const lbStage = $('#lbStage');
  const lbImg = $('#lbImg');
  const lbTitle = $('#lbTitle');
  const lbMeta = $('#lbMeta');
  const lbCounter = $('#lbCounter');

  function openLightbox(workIdx, imgIdx = 0) {
    const w = WORKS[workIdx];
    if (!w) return;
    const isVideo = !!w.video;
    const list = (w.images && w.images.length) ? w.images : [w.img];
    lbState = { workIdx, imgIdx, images: list, slug: w.slug, isVideo };
    if (isVideo) {
      showLightboxVideo();
    } else {
      showLightboxImage();
    }
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function showLightboxVideo() {
    const w = WORKS[lbState.workIdx];
    if (!w || !w.video) return;
    // Replace stage content with iframe
    lbStage.innerHTML = `<div class="lb-video-wrap"><iframe class="lb-video" src="https://www.youtube.com/embed/${w.video}?autoplay=1" title="${escapeHtml(w.title[currentLang] || w.title.en)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    lbTitle.textContent = w.title[currentLang] || w.title.en;
    lbMeta.textContent = `${w.year} · ${w.catLabel}`;
    lbCounter.textContent = '';
    $('#lbPrev').style.display = 'none';
    $('#lbNext').style.display = 'none';
  }

  function showLightboxImage() {
    const w = WORKS[lbState.workIdx];
    if (!w) return;
    // Restore image stage if previously replaced by iframe
    if (!lbStage.querySelector('#lbImg')) {
      lbStage.innerHTML = '<img class="lb-img" id="lbImg" alt="">';
    }
    const imgEl = lbStage.querySelector('#lbImg');
    const file = lbState.images[lbState.imgIdx];
    const src = w.slug ? `assets/img/works/${w.slug}/${file}` : `assets/img/works/${file}`;
    imgEl.src = src;
    imgEl.alt = w.title[currentLang] || w.title.en;
    lbTitle.textContent = w.title[currentLang] || w.title.en;
    lbMeta.textContent = `${w.year} · ${w.catLabel}`;
    const total = lbState.images.length;
    lbCounter.textContent = total > 1 ? `${lbState.imgIdx + 1} / ${total}` : '';
    $('#lbPrev').style.display = total > 1 ? '' : 'none';
    $('#lbNext').style.display = total > 1 ? '' : 'none';
  }

  function closeLightbox() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Reset stage (kills any playing iframe)
    lbStage.innerHTML = '<img class="lb-img" id="lbImg" alt="">';
    lbState.isVideo = false;
  }

  function nextImage() {
    if (!lbState.images.length) return;
    lbState.imgIdx = (lbState.imgIdx + 1) % lbState.images.length;
    showLightboxImage();
  }
  function prevImage() {
    if (!lbState.images.length) return;
    lbState.imgIdx = (lbState.imgIdx - 1 + lbState.images.length) % lbState.images.length;
    showLightboxImage();
  }

  $('#lbClose')?.addEventListener('click', closeLightbox);
  $('#lbNext')?.addEventListener('click', nextImage);
  $('#lbPrev')?.addEventListener('click', prevImage);
  lb?.addEventListener('click', (e) => { if (e.target === lb || e.target.id === 'lbStage') closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lb?.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') nextImage();
    else if (e.key === 'ArrowLeft') prevImage();
  });

  // Touch swipe
  let touchX = null;
  lb?.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb?.addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { dx < 0 ? nextImage() : prevImage(); }
    touchX = null;
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ═══════ Filters ═══════ */
  $$('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderWorks(btn.getAttribute('data-filter'));
    });
  });

  /* ═══════ Header scroll state ═══════ */
  const header = $('#header');
  const backTop = $('#backToTop');
  function onScroll() {
    const y = window.scrollY;
    header?.classList.toggle('scrolled', y > 30);
    backTop?.classList.toggle('visible', y > 600);
    // Active nav link
    const sections = $$('section[id]');
    let cur = '';
    sections.forEach(s => {
      if (s.getBoundingClientRect().top <= 120) cur = s.id;
    });
    $$('.main-nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === `#${cur}`);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ═══════ Burger / mobile nav ═══════ */
  const burger = $('#burger');
  const mainNav = $('.main-nav');
  const langSw = $('.lang-switcher');
  burger?.addEventListener('click', () => {
    const open = burger.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    mainNav?.classList.toggle('mobile-open', open);
    langSw?.classList.toggle('mobile-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('.main-nav a').forEach(a => a.addEventListener('click', () => {
    if (burger?.classList.contains('open')) burger.click();
  }));

  /* ═══════ Reveal on scroll ═══════ */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -80px 0px' });

  function observeReveal() {
    $$('.section-head, .work-card, .resume-block, .service-card, .about-text, .about-portrait, .contact-form, .contact-intro')
      .forEach(el => { el.classList.add('reveal'); io.observe(el); });
  }

  /* ═══════ Contact form ═══════ */
  const form = $('#contactForm');
  const formStatus = $('#formStatus');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dict = I18N[currentLang] || I18N.en;
    formStatus.className = 'form-status';
    formStatus.textContent = '';

    const data = new FormData(form);
    if (!data.get('name') || !data.get('email') || !data.get('message')) {
      formStatus.className = 'form-status error';
      formStatus.textContent = dict['form.required'];
      return;
    }

    const btn = form.querySelector('.btn-submit span');
    const originalText = btn.textContent;
    btn.textContent = dict['form.sending'];
    form.querySelector('.btn-submit').disabled = true;

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      });
      const json = await res.json().catch(() => ({ ok: res.ok }));
      if (res.ok && json.ok) {
        formStatus.className = 'form-status success';
        formStatus.textContent = dict['form.success'];
        form.reset();
      } else {
        throw new Error(json.error || 'server');
      }
    } catch (err) {
      formStatus.className = 'form-status error';
      formStatus.textContent = dict['form.error'];
    } finally {
      btn.textContent = originalText;
      form.querySelector('.btn-submit').disabled = false;
    }
  });

  /* ═══════ Init ═══════ */
  document.addEventListener('DOMContentLoaded', () => {
    initHero();
    applyLang(currentLang);
    observeReveal();
    onScroll();
  });

})();
