(() => {
  'use strict';

  function copyRoundToolAppearance(button, reference) {
    if (!button || !reference) return;
    const rect = reference.getBoundingClientRect();
    if (rect.width) button.style.setProperty('--v155-tool-width', `${Math.round(rect.width)}px`);
    if (rect.height) button.style.setProperty('--v155-tool-height', `${Math.round(rect.height)}px`);

    const styles = getComputedStyle(reference);
    [
      'color','background','backgroundColor','backgroundImage','border','borderColor',
      'borderStyle','borderWidth','boxShadow','font','opacity'
    ].forEach((property) => {
      try {
        const value = styles[property];
        if (value) button.style[property] = value;
      } catch {}
    });
    button.style.borderRadius = '50%';
  }

  function setupSearchToggle() {
    const searchSection = document.querySelector('.sprite-search.tracker-primary-view');
    const searchForm = document.getElementById('spriteSearchForm');
    const searchInput = document.getElementById('spriteSearchInput');
    const searchResults = document.getElementById('spriteSearchResults');
    const tools = document.querySelector('.tracker-tools.tracker-primary-view');
    const huntControl = tools?.querySelector('.hunt-mode-control');
    const showcase = document.getElementById('showcaseBtn');
    if (!searchSection || !searchForm || !searchInput || !tools || !huntControl || !showcase) return;

    let button = document.getElementById('v155SearchToggle');
    if (!button) {
      button = document.createElement('button');
      button.id = 'v155SearchToggle';
      button.type = 'button';
      button.setAttribute('aria-label','Search Sprites');
      button.setAttribute('title','Search Sprites');
      button.setAttribute('aria-controls','spriteSearchForm');
      button.setAttribute('aria-expanded','false');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg>';
      tools.insertBefore(button,huntControl);
    }

    copyRoundToolAppearance(button,showcase);
    searchSection.classList.remove('v155-search-open');
    searchSection.classList.add('v155-search-collapsed');

    const closeSearch = ({ clear = false } = {}) => {
      searchSection.classList.remove('v155-search-open');
      searchSection.classList.add('v155-search-collapsed');
      button.setAttribute('aria-expanded','false');
      if (clear) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input',{ bubbles:true }));
      }
    };

    const openSearch = () => {
      searchSection.classList.remove('v155-search-collapsed');
      searchSection.classList.add('v155-search-open');
      button.setAttribute('aria-expanded','true');
      requestAnimationFrame(() => {
        try { searchInput.focus({ preventScroll:true }); }
        catch { searchInput.focus(); }
      });
    };

    button.addEventListener('click',() => {
      if (button.getAttribute('aria-expanded') === 'true') closeSearch();
      else openSearch();
    });

    searchInput.addEventListener('keydown',(event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeSearch({ clear:true });
      button.focus({ preventScroll:true });
    });

    document.addEventListener('click',(event) => {
      if (button.getAttribute('aria-expanded') !== 'true') return;
      if (button.contains(event.target) || searchSection.contains(event.target)) return;
      if (!searchInput.value.trim() && (searchResults?.hidden ?? true)) closeSearch();
    });

    const observer = new ResizeObserver(() => copyRoundToolAppearance(button,showcase));
    observer.observe(showcase);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',setupSearchToggle,{ once:true });
  } else {
    setupSearchToggle();
  }
})();