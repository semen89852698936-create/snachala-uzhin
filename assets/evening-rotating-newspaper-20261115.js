/* Restores the original change-on-each-visit recipe selection.
   All dynamic content is contained within each existing newspaper-shaped card.
   The original WebP artwork stays as the fallback if an image fails to load. */
(function rotateEveningPaperCards() {
  'use strict';
  const cards = Array.from(document.querySelectorAll('#eveningLanding .du-match11-recipe-grid > a.du-approved-cover-recipe'));
  if (cards.length !== 3 || typeof RECIPES === 'undefined' || !Array.isArray(RECIPES)) return;
  const groups = [['fish','meat','poultry'], ['pasta','vegetables'], ['dessert']];
  const key = 'nash-vecher-previous-three-recipes-v1';
  let previous = [];
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) previous = saved;
  } catch (_) {}
  const picks = [];
  for (let i = 0; i < groups.length; i++) {
    const pool = RECIPES.filter(r =>
      groups[i].includes(r.category) &&
      typeof r.photo === 'string' && r.photo.startsWith('/assets/') &&
      typeof r.id === 'string' && typeof r.title === 'string'
    );
    if (!pool.length) return;
    const fresh = pool.filter(r => r.id !== previous[i] && !picks.some(p => p.id === r.id));
    const candidates = fresh.length ? fresh : pool;
    let index = Math.floor(Math.random() * candidates.length);
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        const value = new Uint32Array(1);
        window.crypto.getRandomValues(value);
        index = value[0] % candidates.length;
      }
    } catch (_) {}
    picks.push(candidates[index]);
  }
  function render(card, recipe) {
    const photo = document.createElement('img');
    photo.className = 'du-rot-photo';
    photo.alt = '';
    photo.decoding = 'async';
    const paper = document.createElement('div');
    paper.className = 'du-rot-paper';
    paper.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'du-rot-copy';
    const title = document.createElement('strong');
    title.className = 'du-rot-title' + (recipe.title.length > 31 ? ' du-rot-long' : '');
    title.textContent = recipe.title;
    const description = document.createElement('small');
    description.className = 'du-rot-description';
    description.textContent = recipe.description && recipe.description.trim()
      ? recipe.description.trim()
      : 'Вечер, который хочется повторить вдвоём.';
    const action = document.createElement('span');
    action.className = 'du-rot-action';
    action.append(document.createTextNode('Приготовить '));
    const arrow = document.createElement('span');
    arrow.className = 'du-rot-arrow';
    arrow.textContent = '→';
    action.append(arrow);
    copy.append(title, description, action);
    // Commit the update only once the selected photo is confirmed available.
    photo.onload = function () {
      card.href = '#recipe=' + encodeURIComponent(recipe.id);
      card.setAttribute('aria-label', recipe.title + '. Приготовить рецепт');
      card.append(photo, paper, copy);
      card.classList.add('du-rotate-ready');
    };
    photo.onerror = function () {
      // Keep the approved, functional static image/card unchanged.
    };
    photo.src = recipe.photo;
  }
  cards.forEach((card, i) => render(card, picks[i]));
  try { localStorage.setItem(key, JSON.stringify(picks.map(r => r.id))); } catch (_) {}
})();