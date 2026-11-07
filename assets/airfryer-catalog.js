(function () {
  'use strict';
  const recipes = Array.isArray(window.AIRFRYER_RECIPE_DATA) ? window.AIRFRYER_RECIPE_DATA : [];
  const grid = document.getElementById('airfryerGrid');
  const filters = document.getElementById('airfryerFilters');
  const search = document.getElementById('airfryerSearch');
  const count = document.getElementById('airfryerResultCount');
  const empty = document.getElementById('airfryerEmpty');
  if (!grid || !filters || !search || !count || !empty || !recipes.length) return;

  const state = { category: 'all', query: '' };
  const order = ['Птица', 'Мясо', 'Рыба и морепродукты', 'Овощи и гарниры', 'Завтраки и выпечка', 'Закуски', 'Десерты'];
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const normalize = (value) => String(value == null ? '' : value).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').normalize('NFKC');
  const pluralRecipes = (value) => {
    const mod100 = value % 100;
    const mod10 = value % 10;
    const word = mod100 >= 11 && mod100 <= 14 ? 'рецептов' : mod10 === 1 ? 'рецепт' : mod10 >= 2 && mod10 <= 4 ? 'рецепта' : 'рецептов';
    return value + ' ' + word;
  };
  const categoryNames = [...new Set(recipes.map((recipe) => recipe.category))].sort((a, b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  function renderFilters() {
    const options = [{ value: 'all', label: 'Все 100' }].concat(categoryNames.map((name) => ({
      value: name, label: name + ' · ' + recipes.filter((recipe) => recipe.category === name).length
    })));
    filters.innerHTML = options.map((option) => (
      '<button type="button" class="du-af-filter" data-af-filter="' + escapeHtml(option.value) + '" aria-pressed="' +
      String(state.category === option.value) + '">' + escapeHtml(option.label) + '</button>'
    )).join('');
    filters.querySelectorAll('[data-af-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.category = button.dataset.afFilter;
        renderFilters();
        renderCards();
      });
    });
  }

  function renderCards() {
    const query = normalize(state.query.trim());
    const visible = recipes.filter((recipe) => {
      if (state.category !== 'all' && recipe.category !== state.category) return false;
      if (!query) return true;
      const ingredients = (recipe.ingredients || []).map((item) => item[0] + ' ' + item[1]).join(' ');
      return normalize([recipe.title, recipe.category, ingredients].join(' ')).includes(query);
    });
    count.textContent = pluralRecipes(visible.length);
    empty.hidden = visible.length > 0;
    grid.hidden = visible.length === 0;
    grid.innerHTML = visible.map((recipe) => {
      const ingredients = (recipe.ingredients || []).slice(0, 4).map((item) => item[0]).join(' · ');
      const cook = Array.isArray(recipe.cook_minutes) ? recipe.cook_minutes.join('–') : '';
      const photo = '/assets/airfryer/' + recipe.id + '.webp';
      return '<article class="du-af-card">' +
        '<button type="button" class="du-af-card-open" data-airfryer-open="' + escapeHtml(recipe.id) + '" aria-label="Открыть рецепт: ' + escapeHtml(recipe.title) + '">' +
          '<span class="du-af-card-image"><img src="' + escapeHtml(photo) + '" alt="' + escapeHtml(recipe.title) + '" loading="lazy" decoding="async"></span>' +
          '<span class="du-af-card-body">' +
            '<span class="du-af-card-meta">' + escapeHtml(recipe.category) + ' · 2 ПОРЦИИ</span>' +
            '<strong class="du-af-card-title">' + escapeHtml(recipe.title) + '</strong>' +
            '<span class="du-af-card-ingredients">' + escapeHtml(ingredients) + '</span>' +
            '<span class="du-af-card-facts"><span>' + escapeHtml(recipe.temperature_c) + ' °C</span><span>' + escapeHtml(cook) + ' мин</span></span>' +
          '</span>' +
        '</button>' +
      '</article>';
    }).join('');
    grid.querySelectorAll('[data-airfryer-open]').forEach((button) => {
      button.addEventListener('click', () => {
        window.location.hash = 'recipe=' + encodeURIComponent(button.dataset.airfryerOpen);
      });
    });
  }

  search.addEventListener('input', () => {
    state.query = search.value;
    renderCards();
  });
  renderFilters();
  renderCards();
})();
