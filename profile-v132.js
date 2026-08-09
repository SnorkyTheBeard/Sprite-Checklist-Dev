(() => {
  'use strict';

  const account = window.SPRITE_ACCOUNT_BRIDGE;
  const spriteData = window.SPRITE_PROFILE_DATA_BRIDGE;
  const cloudConfig = window.SPRITE_CLOUD_CONFIG || {};
  const profileTable = /^[a-z][a-z0-9_]{0,62}$/i.test(cloudConfig.profileTable || '')
    ? cloudConfig.profileTable
    : 'sprite_profiles';
  const avatarKeys = new Set(['sprite','crown','compass','star','meadow']);
  const privacyValues = new Set(['public','code','private']);
  const page = document.getElementById('spriteProfilePage');
  if (!page) return;

  const lookupForm = document.getElementById('profileLookupForm');
  const lookupCode = document.getElementById('profileLookupCode');
  const showMineButton = document.getElementById('profileShowMineBtn');
  const status = document.getElementById('profileStatus');
  const setupNotice = document.getElementById('profileSetupNotice');
  const signedOut = document.getElementById('profileSignedOut');
  const openAccountButton = document.getElementById('profileOpenAccountBtn');
  const ownerPanel = document.getElementById('profileOwnerPanel');
  const visitorPanel = document.getElementById('profileVisitorPanel');
  const editForm = document.getElementById('profileEditForm');
  const displayNameInput = document.getElementById('profileDisplayName');
  const bioInput = document.getElementById('profileBio');
  const bioCount = document.getElementById('profileBioCount');
  const privacySelect = document.getElementById('profilePrivacy');
  const favoriteSearch = document.getElementById('profileFavoriteSearch');
  const favoriteResults = document.getElementById('profileFavoriteResults');
  const selectedFavorites = document.getElementById('profileSelectedFavorites');
  const favoritesEmpty = document.getElementById('profileFavoritesEmpty');
  const ownerAvatar = document.getElementById('profileOwnerAvatar');
  const ownerName = document.getElementById('profileOwnerName');
  const ownerBio = document.getElementById('profileOwnerBio');
  const ownerCodeRow = document.getElementById('profileOwnerCodeRow');
  const ownerCode = document.getElementById('profileOwnerCode');
  const ownerStats = document.getElementById('profileOwnerStats');
  const shareActions = document.getElementById('profileShareActions');
  const shareButton = document.getElementById('profileShareBtn');
  const copyCodeButton = document.getElementById('profileCopyCodeBtn');
  const visitorAvatar = document.getElementById('profileVisitorAvatar');
  const visitorName = document.getElementById('profileVisitorName');
  const visitorBio = document.getElementById('profileVisitorBio');
  const visitorCode = document.getElementById('profileVisitorCode');
  const visitorStats = document.getElementById('profileVisitorStats');
  const visitorFavorites = document.getElementById('profileVisitorFavorites');
  const visitorFavoritesEmpty = document.getElementById('profileVisitorFavoritesEmpty');

  let ownProfile = null;
  let ownProfileUserId = '';
  let draftFavorites = [];
  let shownVisitorCode = '';
  let loadSequence = 0;
  let saving = false;

  const avatarSvg = Object.freeze({
    sprite:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 8c8-5 22-4 28 5 6 8 3 19 5 27 2 6 7 9 4 14-2 5-9 5-14 2-3 6-8 7-13 3-6 3-12 0-12-7-6 2-11 0-12-5-1-5 4-8 6-12 3-7 1-16 8-27Z"></path><path d="m23 35 7 7 13-15"></path></svg>',
    crown:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m8 19 13 11 11-20 11 20 13-11-5 31H13Z"></path><path d="M16 56h32"></path></svg>',
    compass:'<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24"></circle><path d="m40 24-5 13-13 5 5-13Z"></path><path d="M32 8v5M32 51v5M8 32h5M51 32h5"></path></svg>',
    star:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 7 7 15 17 2-12 12 3 17-15-8-15 8 3-17L8 24l17-2Z"></path><path d="M49 8v8M45 12h8"></path></svg>',
    meadow:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 53h48M16 53c0-13 6-22 18-28M48 53c0-12-5-21-16-27"></path><path d="M31 53V17M22 29c-7 0-11-4-11-11 7 0 11 4 11 11ZM40 29c7 0 11-4 11-11-7 0-11 4-11 11Z"></path></svg>'
  });

  function session() {
    return account?.session?.() || null;
  }

  function configured() {
    return account?.configured?.() === true;
  }

  function cleanText(value,max = 160) {
    return String(value || '').trim().replace(/\s+/g,' ').slice(0,max);
  }

  function cleanCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
  }

  function cleanFavorite(value) {
    const familyId = cleanText(value?.familyId,200);
    const variantId = cleanText(value?.variantId,200);
    if (!familyId || !variantId) return null;
    const resolved = spriteData?.resolveFavorite?.({ familyId,variantId }) || {};
    return {
      familyId,
      variantId,
      familyName:cleanText(resolved.familyName || value?.familyName || 'Sprite',80),
      variantName:cleanText(resolved.variantName || value?.variantName || 'Variant',80),
      rarity:cleanText(resolved.rarity || value?.rarity || '',20),
      seasonId:cleanText(resolved.seasonId || value?.seasonId || '',80),
      collected:resolved.collected === true || value?.collected === true,
      mastered:resolved.mastered === true || value?.mastered === true
    };
  }

  function cleanFavorites(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.flatMap((entry) => {
      const favorite = cleanFavorite(entry);
      const key = favorite ? `${favorite.familyId}:${favorite.variantId}` : '';
      if (!favorite || seen.has(key)) return [];
      seen.add(key);
      return [favorite];
    }).slice(0,5);
  }

  function cleanStats(value) {
    const current = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const number = (entry) => Math.max(0,Math.min(100000,Number(entry) || 0));
    const rarities = Array.isArray(current.rarities) ? current.rarities.slice(0,8).map((entry) => ({
      rarity:cleanText(entry?.rarity,20),
      total:number(entry?.total),
      collected:number(entry?.collected),
      mastered:number(entry?.mastered)
    })).filter((entry) => entry.rarity) : [];
    return {
      seasonId:cleanText(current.seasonId,80),
      seasonLabel:cleanText(current.seasonLabel || 'Current season',80),
      total:number(current.total),
      collected:number(current.collected),
      mastered:number(current.mastered),
      rarities,
      updatedAt:cleanText(current.updatedAt,40)
    };
  }

  function normalizeProfile(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const avatar = avatarKeys.has(value.avatar_key) ? value.avatar_key : 'sprite';
    const privacy = privacyValues.has(value.privacy) ? value.privacy : 'code';
    return {
      meadowCode:cleanCode(value.meadow_code),
      displayName:cleanText(value.display_name || 'Sprite Collector',40),
      avatar,
      bio:cleanText(value.bio,160),
      privacy,
      favorites:cleanFavorites(value.favorites),
      stats:cleanStats(value.collection_stats),
      updatedAt:cleanText(value.updated_at,40)
    };
  }

  function routeCode() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const match = hash.match(/^profile\/([a-z0-9]{1,8})$/i);
    return match ? cleanCode(match[1]) : '';
  }

  function setStatus(message,state = '') {
    status.textContent = message || '';
    status.dataset.state = state;
  }

  function setLoading(value) {
    const loading = Boolean(value);
    page.setAttribute('aria-busy',String(loading));
    lookupForm.querySelectorAll('input,button').forEach((control) => { control.disabled = loading; });
  }

  function setAvatar(element,key) {
    const clean = avatarKeys.has(key) ? key : 'sprite';
    element.dataset.avatar = clean;
    element.innerHTML = avatarSvg[clean];
  }

  function currentAvatar() {
    return editForm.querySelector('input[name="profileAvatar"]:checked')?.value || 'sprite';
  }

  function setAvatarChoice(value) {
    const key = avatarKeys.has(value) ? value : 'sprite';
    const input = editForm.querySelector(`input[name="profileAvatar"][value="${key}"]`);
    if (input) input.checked = true;
  }

  function favoriteInfo(favorite) {
    return spriteData?.resolveFavorite?.(favorite) || favorite;
  }

  function favoriteThumb(info) {
    const thumb = document.createElement('span');
    thumb.className = 'profile-favorite-thumb';
    const imageSource = String(info?.image || '');
    if (imageSource) {
      const image = document.createElement('img');
      image.src = imageSource;
      image.alt = '';
      image.loading = 'lazy';
      image.width = 80;
      image.height = 80;
      thumb.appendChild(image);
    } else {
      thumb.textContent = cleanText(info?.familyName || 'S',1).toUpperCase() || 'S';
    }
    return thumb;
  }

  function favoriteCopy(info) {
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = cleanText(info?.familyName || 'Sprite',80);
    const detail = document.createElement('small');
    detail.textContent = [cleanText(info?.variantName || 'Variant',80),cleanText(info?.rarity,20)].filter(Boolean).join(' · ');
    copy.append(name,detail);
    return copy;
  }

  function renderSelectedFavorites() {
    selectedFavorites.replaceChildren();
    favoritesEmpty.hidden = Boolean(draftFavorites.length);
    draftFavorites.forEach((favorite) => {
      const info = favoriteInfo(favorite);
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label',`Remove ${info.familyName} ${info.variantName} from favorites`);
      button.append(favoriteThumb(info),favoriteCopy(info));
      const action = document.createElement('span');
      action.className = 'profile-favorite-action';
      action.textContent = 'Remove';
      button.appendChild(action);
      button.addEventListener('click',() => {
        draftFavorites = draftFavorites.filter((entry) => !(entry.familyId === favorite.familyId && entry.variantId === favorite.variantId));
        renderSelectedFavorites();
        renderFavoriteResults();
      });
      selectedFavorites.appendChild(button);
    });
  }

  function renderFavoriteResults() {
    const query = favoriteSearch.value.trim();
    const matches = query ? (spriteData?.search?.(query) || []).slice(0,10) : [];
    favoriteResults.replaceChildren();
    favoriteResults.hidden = !matches.length;
    favoriteSearch.setAttribute('aria-expanded',String(Boolean(matches.length)));
    matches.forEach((match) => {
      const favorite = cleanFavorite(match);
      if (!favorite) return;
      const exists = draftFavorites.some((entry) => entry.familyId === favorite.familyId && entry.variantId === favorite.variantId);
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = exists || (!exists && draftFavorites.length >= 5);
      button.append(favoriteThumb(match),favoriteCopy(match));
      const action = document.createElement('span');
      action.className = 'profile-favorite-action';
      action.textContent = exists ? 'Added' : (draftFavorites.length >= 5 ? 'Full' : 'Add');
      button.appendChild(action);
      button.addEventListener('click',() => {
        if (draftFavorites.length >= 5 || exists) return;
        draftFavorites.push(favorite);
        favoriteSearch.value = '';
        favoriteResults.hidden = true;
        favoriteSearch.setAttribute('aria-expanded','false');
        renderSelectedFavorites();
        favoriteSearch.focus({ preventScroll:true });
      });
      favoriteResults.appendChild(button);
    });
  }

  function statCard(label,value,detail = '',rarity = '') {
    const card = document.createElement('article');
    card.className = 'profile-stat-card';
    if (rarity) card.dataset.rarity = rarity.toLowerCase();
    const title = document.createElement('span');
    title.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;
    card.append(title,strong);
    if (detail) {
      const small = document.createElement('small');
      small.textContent = detail;
      card.appendChild(small);
    }
    return card;
  }

  function renderStats(container,rawStats) {
    const stats = cleanStats(rawStats);
    const completion = stats.total ? Math.round((stats.collected / stats.total) * 100) : 0;
    container.replaceChildren(
      statCard('Collected',`${stats.collected} / ${stats.total}`,stats.seasonLabel),
      statCard('Mastered',`${stats.mastered} / ${stats.total}`,stats.seasonLabel),
      statCard('Completion',`${completion}%`,'Current collection')
    );
    stats.rarities.forEach((entry) => {
      container.appendChild(statCard(entry.rarity,`${entry.collected} / ${entry.total}`,`${entry.mastered} mastered`,entry.rarity));
    });
  }

  function renderVisitorFavorites(favorites) {
    visitorFavorites.replaceChildren();
    const clean = cleanFavorites(favorites);
    visitorFavoritesEmpty.hidden = Boolean(clean.length);
    clean.forEach((favorite) => {
      const info = favoriteInfo(favorite);
      const card = document.createElement('article');
      card.className = 'profile-favorite-card';
      if (favorite.mastered || info.mastered) card.classList.add('is-mastered');
      card.appendChild(favoriteThumb(info));
      const name = document.createElement('strong');
      name.textContent = cleanText(info.familyName || favorite.familyName || 'Sprite',80);
      const detail = document.createElement('small');
      detail.textContent = [cleanText(info.variantName || favorite.variantName || 'Variant',80),cleanText(info.rarity || favorite.rarity,20)].filter(Boolean).join(' · ');
      card.append(name,detail);
      visitorFavorites.appendChild(card);
    });
  }

  function localStats() {
    return cleanStats(spriteData?.stats?.() || {});
  }

  function renderOwner() {
    const currentSession = session();
    if (!currentSession) return;
    const fallbackName = cleanText(currentSession.user?.user_metadata?.display_name || 'Sprite Collector',40);
    const profile = ownProfile || {
      meadowCode:'',displayName:fallbackName || 'Sprite Collector',avatar:'sprite',bio:'',privacy:'code',favorites:[],stats:localStats()
    };
    const currentStats = localStats();
    displayNameInput.value = profile.displayName || fallbackName || 'Sprite Collector';
    bioInput.value = profile.bio || '';
    bioCount.textContent = String(bioInput.value.length);
    privacySelect.value = privacyValues.has(profile.privacy) ? profile.privacy : 'code';
    setAvatarChoice(profile.avatar);
    draftFavorites = cleanFavorites(profile.favorites);
    renderSelectedFavorites();
    setAvatar(ownerAvatar,profile.avatar);
    ownerName.textContent = profile.displayName || fallbackName || 'Sprite Collector';
    ownerBio.textContent = profile.bio || 'Choose a name, emblem, and favorite Sprites.';
    ownerCode.textContent = profile.meadowCode || '—';
    ownerCodeRow.hidden = !profile.meadowCode;
    shareActions.hidden = !profile.meadowCode || profile.privacy === 'private';
    renderStats(ownerStats,currentStats);
  }

  function renderVisitor(profile) {
    setAvatar(visitorAvatar,profile.avatar);
    visitorName.textContent = profile.displayName || 'Sprite Collector';
    visitorBio.textContent = profile.bio || 'This collector has not added a bio yet.';
    visitorCode.textContent = profile.meadowCode;
    renderStats(visitorStats,profile.stats);
    renderVisitorFavorites(profile.favorites);
  }

  function showOwnerMode() {
    const signedIn = Boolean(session());
    setupNotice.hidden = configured();
    signedOut.hidden = signedIn;
    ownerPanel.hidden = !signedIn;
    visitorPanel.hidden = true;
    showMineButton.hidden = true;
    shownVisitorCode = '';
    if (signedIn) renderOwner();
  }

  function showVisitorMode(profile) {
    setupNotice.hidden = configured();
    signedOut.hidden = true;
    ownerPanel.hidden = true;
    visitorPanel.hidden = false;
    showMineButton.hidden = !session();
    shownVisitorCode = profile.meadowCode;
    renderVisitor(profile);
  }

  async function loadOwnProfile() {
    const currentSession = session();
    if (!configured() || !currentSession) {
      ownProfile = null;
      ownProfileUserId = '';
      showOwnerMode();
      return;
    }
    if (ownProfileUserId === currentSession.user.id) {
      showOwnerMode();
      return;
    }
    const requestId = ++loadSequence;
    setLoading(true);
    setStatus('Loading your Sprite Profile…');
    try {
      const token = await account.accessToken();
      const rows = await account.request(`/rest/v1/${profileTable}?select=meadow_code,display_name,avatar_key,bio,privacy,favorites,collection_stats,updated_at&user_id=eq.${encodeURIComponent(currentSession.user.id)}&limit=1`,{ token });
      if (requestId !== loadSequence) return;
      ownProfile = normalizeProfile(Array.isArray(rows) ? rows[0] : null);
      ownProfileUserId = currentSession.user.id;
      showOwnerMode();
      setStatus(ownProfile ? 'Your profile is ready.' : 'Create your profile to receive a Meadow Code.',ownProfile ? 'success' : '');
    } catch (error) {
      if (requestId !== loadSequence) return;
      ownProfile = null;
      ownProfileUserId = '';
      showOwnerMode();
      setStatus(error?.message || 'Your profile could not be loaded.','error');
    } finally {
      if (requestId === loadSequence) setLoading(false);
    }
  }

  async function visitProfile(code) {
    const clean = cleanCode(code);
    if (clean.length !== 8) {
      setStatus('Enter the full 8-character Meadow Code.','error');
      return;
    }
    if (!configured()) {
      showOwnerMode();
      setStatus('Profiles need Account & Cloud setup before Meadow Codes can be used.','error');
      return;
    }
    if (shownVisitorCode === clean && !visitorPanel.hidden) return;
    const requestId = ++loadSequence;
    setLoading(true);
    setStatus(`Looking for ${clean}…`);
    try {
      let token = '';
      if (session()) {
        try { token = await account.accessToken(); } catch { token = ''; }
      }
      const rows = await account.request('/rest/v1/rpc/get_sprite_profile_by_code',{
        method:'POST',
        token,
        body:{ lookup_code:clean }
      });
      if (requestId !== loadSequence) return;
      const profile = normalizeProfile(Array.isArray(rows) ? rows[0] : rows);
      if (!profile) {
        showOwnerMode();
        setStatus('No shared profile was found for that Meadow Code.','error');
        return;
      }
      lookupCode.value = profile.meadowCode;
      showVisitorMode(profile);
      setStatus(`Visiting ${profile.displayName}.`,'success');
    } catch (error) {
      if (requestId !== loadSequence) return;
      showOwnerMode();
      setStatus(error?.status === 404 ? 'No shared profile was found for that Meadow Code.' : (error?.message || 'That profile could not be opened.'),'error');
    } finally {
      if (requestId === loadSequence) setLoading(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (saving || !configured() || !session()) return;
    const name = cleanText(displayNameInput.value,40);
    if (name.length < 2) {
      setStatus('Use at least 2 characters for your display name.','error');
      displayNameInput.focus();
      return;
    }
    saving = true;
    editForm.setAttribute('aria-busy','true');
    document.getElementById('profileSaveBtn').disabled = true;
    setStatus('Saving your Sprite Profile…');
    try {
      const currentSession = session();
      const token = await account.accessToken();
      const favorites = cleanFavorites(draftFavorites);
      const payload = {
        user_id:currentSession.user.id,
        display_name:name,
        avatar_key:currentAvatar(),
        bio:cleanText(bioInput.value,160),
        privacy:privacyValues.has(privacySelect.value) ? privacySelect.value : 'code',
        favorites,
        collection_stats:localStats()
      };
      const rows = await account.request(`/rest/v1/${profileTable}?on_conflict=user_id`,{
        method:'POST',
        token,
        headers:{ Prefer:'resolution=merge-duplicates,return=representation' },
        body:payload
      });
      ownProfile = normalizeProfile(Array.isArray(rows) ? rows[0] : rows);
      ownProfileUserId = currentSession.user.id;
      if (!ownProfile) throw new Error('The profile saved, but its Meadow Code could not be read.');
      renderOwner();
      setStatus(`Profile saved · Meadow Code ${ownProfile.meadowCode}`,'success');
    } catch (error) {
      setStatus(error?.message || 'Your profile could not be saved.','error');
    } finally {
      saving = false;
      editForm.setAttribute('aria-busy','false');
      document.getElementById('profileSaveBtn').disabled = false;
    }
  }

  function profileUrl(code) {
    const url = new URL(location.href);
    url.hash = `profile/${cleanCode(code)}`;
    return url.href;
  }

  async function copyText(value,successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(successMessage,'success');
    } catch {
      setStatus('Copying is not available in this browser. Press and hold the Meadow Code to copy it.','error');
    }
  }

  async function shareProfile() {
    if (!ownProfile?.meadowCode || ownProfile.privacy === 'private') return;
    const url = profileUrl(ownProfile.meadowCode);
    const shareData = {
      title:`${ownProfile.displayName} · My Sprite Tracker`,
      text:`Visit my Sprite Profile with Meadow Code ${ownProfile.meadowCode}.`,
      url
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setStatus('Profile shared.','success');
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await copyText(url,'Profile link copied.');
  }

  async function renderFromRoute() {
    if (page.hidden) return;
    setupNotice.hidden = configured();
    const code = routeCode();
    if (code) await visitProfile(code);
    else await loadOwnProfile();
  }

  lookupCode.addEventListener('input',() => {
    const clean = cleanCode(lookupCode.value);
    if (lookupCode.value !== clean) lookupCode.value = clean;
  });
  lookupForm.addEventListener('submit',(event) => {
    event.preventDefault();
    const code = cleanCode(lookupCode.value);
    if (code.length !== 8) return setStatus('Enter the full 8-character Meadow Code.','error');
    const nextHash = `#profile/${code}`;
    if (location.hash === nextHash) visitProfile(code);
    else location.hash = nextHash;
  });
  showMineButton.addEventListener('click',() => { location.hash = '#profile'; });
  openAccountButton.addEventListener('click',() => account?.openAccount?.());
  editForm.addEventListener('submit',saveProfile);
  bioInput.addEventListener('input',() => { bioCount.textContent = String(bioInput.value.length); });
  editForm.querySelectorAll('input[name="profileAvatar"]').forEach((input) => input.addEventListener('change',() => setAvatar(ownerAvatar,currentAvatar())));
  favoriteSearch.addEventListener('input',renderFavoriteResults);
  favoriteSearch.addEventListener('keydown',(event) => {
    if (event.key !== 'Escape') return;
    favoriteSearch.value = '';
    favoriteResults.hidden = true;
    favoriteSearch.setAttribute('aria-expanded','false');
  });
  shareButton.addEventListener('click',shareProfile);
  copyCodeButton.addEventListener('click',() => {
    if (ownProfile?.meadowCode) copyText(ownProfile.meadowCode,'Meadow Code copied.');
  });
  window.addEventListener('sprite-profile-view-opened',renderFromRoute);
  window.addEventListener('hashchange',renderFromRoute);
  window.addEventListener('sprite-cloud-session-changed',() => {
    ownProfile = null;
    ownProfileUserId = '';
    renderFromRoute();
  });

  setAvatar(ownerAvatar,'sprite');
  setAvatar(visitorAvatar,'sprite');
  setupNotice.hidden = configured();
  showOwnerMode();
  renderFromRoute();
})();
