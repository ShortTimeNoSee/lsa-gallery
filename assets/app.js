const LICENSE_URL = 'https://github.com/ShortTimeNoSee/liberty-sharealike/blob/v1.0/LICENSE';
const NOTICE = `Licensed under Liberty-ShareAlike 1.0 (LSA-1.0). Include this license or a stable link if you distribute adaptations. No attribution required. ${LICENSE_URL}`;
const BASE = getBasePath();

const state = {
  images: [],
  filtered: [],
  layout: localStorage.getItem('layout') || 'masonry', // or 'grid'
  sort: localStorage.getItem('sort') || 'newest',
  query: '',
  currentImageId: null
};

const els = {
  gallery: document.getElementById('gallery'),
  cardTemplate: document.getElementById('cardTemplate'),
  search: document.getElementById('search'),
  sort: document.getElementById('sort'),
  layoutToggle: document.getElementById('layoutToggle'),
  themeToggle: document.getElementById('themeToggle'),
  lb: document.getElementById('lightbox'),
  lbTitle: document.getElementById('lbTitle'),
  lbDesc: document.getElementById('lbDesc'),
  lbTags: document.getElementById('lbTags'),
  lbImg: document.getElementById('lbImg'),
  rawLink: document.getElementById('rawLink'),
  licenseLink: document.getElementById('licenseLink'),
  copyNotice: document.getElementById('copyNotice'),
  stampBtn: document.getElementById('stampBtn'),
  closeLb: document.getElementById('closeLb'),
  lbJsonLd: document.getElementById('lbJsonLd'),
  header: document.querySelector('.site-header'),
  menuToggle: document.getElementById('menuToggle'),
};

async function init() {
  try {
    const res = await fetch(BASE + 'data/images.json', { cache: 'no-store' });
    state.images = await res.json();
  } catch (e) {
    console.error('Failed to load manifest', e);
    state.images = [];
  }
  applySort();
  bindEvents();
  setLayout(state.layout);
  handleInitialRoute();
  render();
  registerSW();
}

function bindEvents() {
  els.search.addEventListener('input', (e) => { state.query = e.target.value.trim().toLowerCase(); render(); });
  els.sort.value = state.sort;
  els.sort.addEventListener('change', () => { state.sort = els.sort.value; localStorage.setItem('sort', state.sort); applySort(); render(); });
  els.layoutToggle.addEventListener('click', () => { setLayout(state.layout === 'masonry' ? 'grid' : 'masonry'); render(); });
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  if (els.menuToggle && els.header) {
    els.menuToggle.addEventListener('click', () => {
      const nowOpen = !els.header.classList.contains('menu-open');
      els.header.classList.toggle('menu-open', nowOpen);
      els.menuToggle.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 701 && els.header.classList.contains('menu-open')) {
        els.header.classList.remove('menu-open');
        els.menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
    const actions = els.header.querySelector('.top-actions');
    if (actions) {
      actions.addEventListener('click', (e) => {
        if (els.header.classList.contains('menu-open') && (e.target.closest('a') || e.target.closest('button'))) {
          els.header.classList.remove('menu-open');
          els.menuToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  els.closeLb.addEventListener('click', closeLightbox);
  els.lb.addEventListener('click', (e) => { if (e.target === els.lb) closeLightbox(); });
  els.copyNotice.addEventListener('click', () => {
    navigator.clipboard.writeText(NOTICE).then(() => toast('License notice copied'));
  });
  els.stampBtn.addEventListener('click', stampAndDownload);

  window.addEventListener('popstate', handlePopState);
}

function setLayout(mode) {
  state.layout = mode;
  localStorage.setItem('layout', mode);
  els.gallery.classList.toggle('masonry', mode === 'masonry');
  els.gallery.classList.toggle('grid', mode === 'grid');
  els.layoutToggle.textContent = mode === 'masonry' ? 'Grid' : 'Masonry';
}

function applySort() {
  const coll = [...state.images];
  switch (state.sort) {
    case 'oldest':
      coll.sort((a, b) => (a.added || 0) - (b.added || 0));
      break;
    case 'title':
      coll.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'size':
      coll.sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
      break;
    case 'newest':
    default:
      coll.sort((a, b) => (b.added || 0) - (a.added || 0));
  }
  state.filtered = coll;
}

function matchesQuery(img, q) {
  if (!q) return true;
  const hay = [img.title, img.description, ...(img.tags || [])].join(' ').toLowerCase();
  return hay.includes(q);
}

function render() {
  const q = state.query;
  els.gallery.innerHTML = '';
  const frag = document.createDocumentFragment();
  state.filtered.filter(img => matchesQuery(img, q)).forEach(img => {
    const node = els.cardTemplate.content.firstElementChild.cloneNode(true);
    const thumb = node.querySelector('.thumb');
    const title = node.querySelector('.title');
    const dims = node.querySelector('.badge.dims');
    const size = node.querySelector('.badge.size');
    const tags = node.querySelector('.tags');
    if (img.creator) {
      const creatorBadge = document.createElement('span');
      creatorBadge.className = 'badge';
      creatorBadge.textContent = img.creator;
      node.querySelector('.badges').appendChild(creatorBadge);
    }

    thumb.src = BASE + img.src;
    thumb.alt = img.alt || img.title || 'image';
    title.textContent = img.title || img.file;
    dims.textContent = `${img.width}×${img.height}`;
    size.textContent = humanBytes(img.bytes);

    (img.tags || []).forEach(t => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `#${t}`;
      span.addEventListener('click', () => { els.search.value = t; state.query = t; render(); });
      tags.appendChild(span);
    });

    const open = () => openLightbox(img);
    node.querySelector('.quickview').addEventListener('click', open);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    node.addEventListener('click', (e) => {
      if (e.target.closest('.quickview')) return;
      open();
    });

    frag.appendChild(node);
  });
  els.gallery.appendChild(frag);
}

function openLightbox(img, updateUrl = true) {
  state.currentImageId = getImageId(img);
  
  els.lbTitle.textContent = img.title || img.file;
  els.lbDesc.textContent = img.description || '';
  let creatorEl = document.getElementById('lbCreator');
  if (!creatorEl) {
    creatorEl = document.createElement('p');
    creatorEl.id = 'lbCreator';
    creatorEl.className = 'desc';
    els.lbDesc.insertAdjacentElement('afterend', creatorEl);
  }
  creatorEl.textContent = img.creator ? `Creator: ${img.creator}` : '';
  els.lbImg.src = BASE + img.src;
  els.lbImg.alt = img.alt || img.title || 'image';

  els.rawLink.href = BASE + img.src;
  els.rawLink.download = img.file;
  els.licenseLink.href = LICENSE_URL;

  els.lbTags.innerHTML = '';
  (img.tags || []).forEach(t => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `#${t}`;
    els.lbTags.appendChild(span);
  });

  // JSON-LD for the current image
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "name": img.title || img.file,
    "contentUrl": new URL(img.src, location.origin + BASE).toString(),
    "thumbnail": new URL(img.src, location.origin + BASE).toString(),
    "description": img.description || "",
    "creator": img.creator ? { "@type": "Person", "name": img.creator } : undefined,
    "width": img.width,
    "height": img.height,
    "encodingFormat": img.mime || "",
    "license": LICENSE_URL
  };
  els.lbJsonLd.textContent = JSON.stringify(jsonLd);

  if (updateUrl) {
    const imageUrl = BASE + 'image/' + state.currentImageId;
    history.pushState({ imageId: state.currentImageId }, img.title || img.file, imageUrl);
    document.title = `${img.title || img.file} - LSA Gallery`;
  }

  els.lb.showModal();
}

function closeLightbox() {
  els.lb.close();
  state.currentImageId = null;
  
  history.pushState(null, 'LSA Gallery — liberty • share • remix', BASE);
  document.title = 'LSA Gallery — liberty • share • remix';
}

function toggleTheme() {
  const now = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
  document.documentElement.dataset.theme = now;
  localStorage.setItem('theme', now);
}

function humanBytes(n) {
  if (!n && n !== 0) return '';
  const units = ['B','KB','MB','GB'];
  let u = 0, x = n;
  while (x >= 1024 && u < units.length-1) { x /= 1024; u++; }
  return `${x.toFixed(x < 10 && u > 0 ? 1 : 0)} ${units[u]}`;
}

async function stampAndDownload() {
  const imgEl = els.lbImg;
  await imgEl.decode();
  const canvas = document.createElement('canvas');
  const margin = Math.max(24, Math.round(imgEl.naturalWidth * 0.02));
  const footerH = Math.max(54, Math.round(imgEl.naturalHeight * 0.05));
  canvas.width = imgEl.naturalWidth;
  canvas.height = imgEl.naturalHeight + footerH;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0);

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, imgEl.naturalHeight, canvas.width, footerH);

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(18, Math.round(footerH*0.35))}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';

  const short = `LSA-1.0 — ${LICENSE_URL}`;
  ctx.fillText(short, margin, imgEl.naturalHeight + footerH/2);

  const a = document.createElement('a');
  a.download = (els.lbTitle.textContent || 'image') + '-lsa.jpg';
  a.href = canvas.toDataURL('image/jpeg', 0.95);
  a.click();
}

// toast
let toastTimer = null;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    Object.assign(t.style, {
      position:'fixed', left:'50%', bottom:'20px', transform:'translateX(-50%)',
      background:'#111a', color:'#fff', padding:'8px 12px', borderRadius:'8px',
      zIndex:9999, backdropFilter:'blur(4px)'
    });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.style.opacity='0', 1800);
}

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register(BASE + 'assets/sw.js'); }
    catch (e) { console.warn('SW failed', e); }
  }
}

function getBasePath() {
  try {
    const script = document.querySelector('script[src$="assets/app.js"]') || document.querySelector('script[src*="/assets/app.js"]');
    if (script) {
      const u = new URL(script.src, location.href);
      let p = u.pathname.replace(/assets\/app\.js$/, '');
      if (!p.endsWith('/')) p += '/';
      return p || '/';
    }
  } catch (e) {}
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts.length > 0) {
    return '/' + parts[0] + '/';
  }
  return '/';
}

function getImageId(img) {
  return encodeURIComponent(img.file.replace(/\.[^/.]+$/, ""));
}

function findImageById(imageId) {
  const decodedId = decodeURIComponent(imageId);
  return state.images.find(img => {
    const imgId = img.file.replace(/\.[^/.]+$/, "");
    return imgId === decodedId;
  });
}

function handleInitialRoute() {
  const path = window.location.pathname;
  const prefix = (BASE.endsWith('/') ? BASE : BASE + '/').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const imageMatch = path.match(new RegExp('^' + prefix + 'image/(.+)$'));
  
  if (imageMatch) {
    const imageId = imageMatch[1];
    const img = findImageById(imageId);
    
    if (img) {
      setTimeout(() => openLightbox(img, false), 100);
      return;
    } else {
      history.replaceState(null, 'LSA Gallery — liberty • share • remix', BASE);
      return;
    }
  }
  const sp = new URLSearchParams(window.location.search);
  const qi = sp.get('i') || sp.get('image');
  if (qi) {
    const img = findImageById(qi);
    if (img) {
      setTimeout(() => openLightbox(img, true), 100);
    } else {
      history.replaceState(null, 'LSA Gallery — liberty • share • remix', BASE);
    }
  }
}

function handlePopState(event) {
  const path = window.location.pathname;
  const prefix = (BASE.endsWith('/') ? BASE : BASE + '/').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const imageMatch = path.match(new RegExp('^' + prefix + 'image/(.+)$'));
  
  if (imageMatch) {
    const imageId = imageMatch[1];
    const img = findImageById(imageId);
    
    if (img && !els.lb.open) {
      openLightbox(img, false);
    } else if (!img) {
      history.replaceState(null, 'LSA Gallery — liberty • share • remix', BASE);
    }
  } else {
    if (els.lb.open) {
      els.lb.close();
      state.currentImageId = null;
      document.title = 'LSA Gallery — liberty • share • remix';
    }
  }
}

init();
