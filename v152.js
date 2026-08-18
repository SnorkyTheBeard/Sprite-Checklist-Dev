(() => {
  'use strict';

  const localCollapsedFamilies = new Set();
  let syncing = false;

  function globalVariantsAreExpanded() {
    const toggle = document.getElementById('variantCollapseToggle');
    if (!toggle || toggle.hidden) return false;
    return /collapse variants/i.test(toggle.textContent || '');
  }

  function syncFamilyCollapseButtons() {
    if (syncing) return;
    syncing = true;
    try {
      const expandedMode = globalVariantsAreExpanded();
      document.querySelectorAll('#collections .collection').forEach((section) => {
        if (!(section instanceof HTMLElement)) return;
        const familyId = String(section.dataset.familyId || '');
        const appCollapsed = section.classList.contains('collection-collapsed');
        let button = section.querySelector(':scope > .v152-family-collapse');

        if (!expandedMode || appCollapsed || !familyId) {
          button?.remove();
          section.classList.remove('v152-family-collapsed');
          return;
        }

        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'v152-family-collapse';
          section.appendChild(button);
        }

        const collapsed = localCollapsedFamilies.has(familyId);
        section.classList.toggle('v152-family-collapsed',collapsed);
        button.textContent = collapsed ? 'Expand Variants' : 'Collapse Variants';
        button.setAttribute('aria-expanded',String(!collapsed));
        button.setAttribute('aria-label',`${collapsed ? 'Expand' : 'Collapse'} variants for ${section.querySelector('.collection-head h3')?.textContent?.trim() || 'this Sprite'}`);

        if (button.dataset.v152Bound !== 'true') {
          button.dataset.v152Bound = 'true';
          button.addEventListener('click',() => {
            const id = String(section.dataset.familyId || '');
            if (!id) return;
            if (localCollapsedFamilies.has(id)) localCollapsedFamilies.delete(id);
            else localCollapsedFamilies.add(id);
            syncFamilyCollapseButtons();
            if (localCollapsedFamilies.has(id)) section.scrollIntoView({ block:'nearest',behavior:'smooth' });
          });
        }
      });
    } finally {
      syncing = false;
    }
  }

  document.addEventListener('click',(event) => {
    const toggle = event.target instanceof Element ? event.target.closest('#variantCollapseToggle') : null;
    if (!toggle) return;
    const wasCollapsedMode = /expand variants/i.test(toggle.textContent || '');
    if (wasCollapsedMode) localCollapsedFamilies.clear();
    window.setTimeout(syncFamilyCollapseButtons,0);
  },true);

  const observer = new MutationObserver(() => window.requestAnimationFrame(syncFamilyCollapseButtons));

  function start() {
    const collections = document.getElementById('collections');
    if (collections) observer.observe(collections,{ childList:true,subtree:true });
    const toggle = document.getElementById('variantCollapseToggle');
    if (toggle) observer.observe(toggle,{ childList:true,characterData:true,subtree:true,attributes:true });
    syncFamilyCollapseButtons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{ once:true });
  else start();
})();
