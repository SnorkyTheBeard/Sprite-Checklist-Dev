(() => {
  'use strict';

  const account = window.SPRITE_ACCOUNT_BRIDGE;
  const spriteData = window.SPRITE_PROFILE_DATA_BRIDGE;
  const cloudConfig = window.SPRITE_CLOUD_CONFIG || {};
  const profileTable = /^[a-z][a-z0-9_]{0,62}$/i.test(cloudConfig.profileTable || '') ? cloudConfig.profileTable : 'sprite_profiles';
  const PROFILE_BUCKET = 'profile-pictures';
  const MAX_FAVORITES = 3;
  const MIN_STATS = 3;
  const MAX_STATS = 6;
  const avatarKeys = new Set(['sprite','crown','compass','star','meadow']);
  const privacyValues = new Set(['public','code','private']);
  const statDefinitions = Object.freeze([
    { key:'collected',label:'Collected' },
    { key:'mastered',label:'Mastered' },
    { key:'completion',label:'Completion' },
    { key:'unowned',label:'Unowned' },
    { key:'unmastered',label:'Unmastered' },
    { key:'rare',label:'Rare Progress' },
    { key:'epic',label:'Epic Progress' },
    { key:'legendary',label:'Legendary Progress' },
    { key:'mythic',label:'Mythic Progress' }
  ]);
  const statKeys = new Set(statDefinitions.map((entry) => entry.key));
  const defaultStats = Object.freeze(['collected','mastered','completion']);
  const page = document.getElementById('spriteProfilePage');
  if (!page) return;

  const lookupForm = document.getElementById('profileLookupForm');
  const lookupPanel = document.querySelector('.profile-lookup-panel');
  const lookupCode = document.getElementById('profileLookupCode');
  const showMineButton = document.getElementById('profileShowMineBtn');
  const status = document.getElementById('profileStatus');
  const setupNotice = document.getElementById('profileSetupNotice');
  const signedOut = document.getElementById('profileSignedOut');
  const openAccountButton = document.getElementById('profileOpenAccountBtn');
  const ownerPanel = document.getElementById('profileOwnerPanel');
  const ownerHero = document.getElementById('profileOwnerHero');
  const heroCode = document.getElementById('profileHeroCode');
  const heroAvatar = document.getElementById('profileHeroAvatar');
  const heroShareButton = document.getElementById('profileHeroShareBtn');
  const visitorPanel = document.getElementById('profileVisitorPanel');
  const quickButton = document.getElementById('profileQuickBtn');
  const quickAvatar = document.getElementById('profileQuickAvatar');
  const quickCloudIndicator = document.getElementById('profileQuickCloudIndicator');
  const accountEmail = document.getElementById('profileAccountEmail');
  const accountName = document.getElementById('profileAccountName');
  const cloudStateDot = document.getElementById('profileCloudStateDot');
  const cloudStateText = document.getElementById('profileCloudStateText');
  const manageAccountButton = document.getElementById('profileManageAccountBtn');
  const ownerAvatar = document.getElementById('profileOwnerAvatar');
  const ownerName = document.getElementById('profileOwnerName');
  const ownerBio = document.getElementById('profileOwnerBio');
  const ownerCodeRow = document.getElementById('profileOwnerCodeRow');
  const ownerCode = document.getElementById('profileOwnerCode');
  const ownerStats = document.getElementById('profileOwnerStats');
  const ownerFavorites = document.getElementById('profileOwnerFavorites');
  const ownerFavoritesEmpty = document.getElementById('profileOwnerFavoritesEmpty');
  const editButton = document.getElementById('profileEditBtn');
  const shareButton = document.getElementById('profileShareBtn');
  const visitorAvatar = document.getElementById('profileVisitorAvatar');
  const visitorName = document.getElementById('profileVisitorName');
  const visitorBio = document.getElementById('profileVisitorBio');
  const visitorCode = document.getElementById('profileVisitorCode');
  const visitorStats = document.getElementById('profileVisitorStats');
  const visitorFavorites = document.getElementById('profileVisitorFavorites');
  const visitorFavoritesEmpty = document.getElementById('profileVisitorFavoritesEmpty');
  const editDialog = document.getElementById('profileEditDialog');
  const editForm = document.getElementById('profileEditForm');
  const editTitle = document.getElementById('profileEditTitle');
  const editCloseButton = document.getElementById('profileEditCloseBtn');
  const editAvatar = document.getElementById('profileEditAvatar');
  const pictureInput = document.getElementById('profilePictureInput');
  const removePictureButton = document.getElementById('profileRemovePictureBtn');
  const displayNameInput = document.getElementById('profileDisplayName');
  const bioInput = document.getElementById('profileBio');
  const bioCount = document.getElementById('profileBioCount');
  const privacySelect = document.getElementById('profilePrivacy');
  const statSelected = document.getElementById('profileStatSelected');
  const statAvailable = document.getElementById('profileStatAvailable');
  const favoriteSearch = document.getElementById('profileFavoriteSearch');
  const favoriteResults = document.getElementById('profileFavoriteResults');
  const selectedFavorites = document.getElementById('profileSelectedFavorites');
  const favoritesEmpty = document.getElementById('profileFavoritesEmpty');
  const editStatus = document.getElementById('profileEditStatus');
  const saveButton = document.getElementById('profileSaveBtn');

  let ownProfile = null;
  let ownProfileUserId = '';
  let draftFavorites = [];
  let draftStatLayout = [...defaultStats];
  let draftImagePath = '';
  let pendingImageBlob = null;
  let pendingImagePreview = '';
  let removeExistingImage = false;
  let shownVisitorCode = '';
  let loadingCode = '';
  let loadingOwnUserId = '';
  let loadSequence = 0;
  let saving = false;

  const avatarSvg = Object.freeze({
    sprite:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 8c8-5 22-4 28 5 6 8 3 19 5 27 2 6 7 9 4 14-2 5-9 5-14 2-3 6-8 7-13 3-6 3-12 0-12-7-6 2-11 0-12-5-1-5 4-8 6-12 3-7 1-16 8-27Z"></path><path d="m23 35 7 7 13-15"></path></svg>',
    crown:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m8 19 13 11 11-20 11 20 13-11-5 31H13Z"></path><path d="M16 56h32"></path></svg>',
    compass:'<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24"></circle><path d="m40 24-5 13-13 5 5-13Z"></path><path d="M32 8v5M32 51v5M8 32h5M51 32h5"></path></svg>',
    star:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 7 7 15 17 2-12 12 3 17-15-8-15 8 3-17L8 24l17-2Z"></path><path d="M49 8v8M45 12h8"></path></svg>',
    meadow:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 53h48M16 53c0-13 6-22 18-28M48 53c0-12-5-21-16-27"></path><path d="M31 53V17M22 29c-7 0-11-4-11-11 7 0 11 4 11 11ZM40 29c7 0 11-4 11-11-7 0-11 4-11 11Z"></path></svg>'
  });

  function session() { return account?.session?.() || null; }
  function configured() { return account?.configured?.() === true; }
  function cleanText(value,max = 160) { return String(value || '').trim().replace(/\s+/g,' ').slice(0,max); }
  function cleanCode(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8); }

  function cleanStatLayout(value) {
    const source = Array.isArray(value) ? value : defaultStats;
    const unique = source.map((entry) => cleanText(entry,30).toLowerCase()).filter((entry,index,array) => statKeys.has(entry) && array.indexOf(entry) === index);
    const filled = [...unique];
    defaultStats.forEach((entry) => { if (filled.length < MIN_STATS && !filled.includes(entry)) filled.push(entry); });
    statDefinitions.forEach((entry) => { if (filled.length < MIN_STATS && !filled.includes(entry.key)) filled.push(entry.key); });
    return filled.slice(0,MAX_STATS);
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
    }).slice(0,MAX_FAVORITES);
  }

  function cleanStats(value) {
    const current = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const number = (entry) => Math.max(0,Math.min(100000,Number(entry) || 0));
    return {
      seasonId:cleanText(current.seasonId,80),
      seasonLabel:cleanText(current.seasonLabel || 'Current season',80),
      total:number(current.total),
      collected:number(current.collected),
      mastered:number(current.mastered),
      rarities:Array.isArray(current.rarities) ? current.rarities.slice(0,8).map((entry) => ({
        rarity:cleanText(entry?.rarity,20),total:number(entry?.total),collected:number(entry?.collected),mastered:number(entry?.mastered)
      })).filter((entry) => entry.rarity) : [],
      displayStats:cleanStatLayout(current.displayStats),
      updatedAt:cleanText(current.updatedAt,40)
    };
  }

  function normalizeProfile(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return {
      meadowCode:cleanCode(value.meadow_code),
      displayName:cleanText(value.display_name || 'Sprite Collector',40),
      avatar:avatarKeys.has(value.avatar_key) ? value.avatar_key : 'sprite',
      imagePath:cleanText(value.profile_image_path,500),
      bio:cleanText(value.bio,160),
      privacy:privacyValues.has(value.privacy) ? value.privacy : 'code',
      favorites:cleanFavorites(value.favorites),
      stats:cleanStats(value.collection_stats),
      updatedAt:cleanText(value.updated_at,40)
    };
  }

  function localStats(layout = defaultStats) {
    const value = cleanStats(spriteData?.stats?.() || {});
    value.displayStats = cleanStatLayout(layout);
    return value;
  }

  function routeCode() {
    const match = decodeURIComponent(location.hash.slice(1)).match(/^profile\/([a-z0-9]{1,8})$/i);
    return match ? cleanCode(match[1]) : '';
  }

  function setStatus(message,state = '') { status.textContent = message || '';status.dataset.state = state; }
  function setEditStatus(message,state = '') { editStatus.textContent = message || '';editStatus.dataset.state = state; }

  function imageUrl(path,version = '') {
    const base = account?.publicStorageUrl?.(PROFILE_BUCKET,path) || '';
    return base && version ? `${base}?v=${encodeURIComponent(version)}` : base;
  }

  function setAvatar(element,key,imagePath = '',version = '',preview = '') {
    const clean = avatarKeys.has(key) ? key : 'sprite';
    element.dataset.avatar = clean;
    element.replaceChildren();
    const source = preview || imageUrl(imagePath,version);
    if (source) {
      const image = document.createElement('img');
      image.src = source;
      image.alt = '';
      image.decoding = 'async';
      image.addEventListener('error',() => {
        element.replaceChildren();
        element.innerHTML = avatarSvg[clean];
      },{ once:true });
      element.appendChild(image);
    } else {
      element.innerHTML = avatarSvg[clean];
    }
  }

  function currentAvatar() { return editForm.querySelector('input[name="profileAvatar"]:checked')?.value || 'sprite'; }
  function setAvatarChoice(value) {
    const input = editForm.querySelector(`input[name="profileAvatar"][value="${avatarKeys.has(value) ? value : 'sprite'}"]`);
    if (input) input.checked = true;
  }
  function favoriteInfo(favorite) { return spriteData?.resolveFavorite?.(favorite) || favorite; }

  function favoriteThumb(info) {
    const thumb = document.createElement('span');
    thumb.className = 'profile-favorite-thumb';
    if (info?.image) {
      const image = document.createElement('img');
      image.src = String(info.image);
      image.alt = '';
      image.loading = 'lazy';
      image.width = 120;
      image.height = 120;
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

  function renderFavoriteShowcase(container,emptyElement,favorites) {
    container.replaceChildren();
    const clean = cleanFavorites(favorites);
    emptyElement.hidden = Boolean(clean.length);
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
      container.appendChild(card);
    });
  }

  function statValue(key,stats) {
    const total = stats.total || 0;
    const rarity = stats.rarities.find((entry) => entry.rarity.toLowerCase() === key);
    if (key === 'collected') return { value:`${stats.collected} / ${total}`,detail:stats.seasonLabel };
    if (key === 'mastered') return { value:`${stats.mastered} / ${total}`,detail:stats.seasonLabel };
    if (key === 'completion') return { value:`${total ? Math.round((stats.collected / total) * 100) : 0}%`,detail:'Collection complete' };
    if (key === 'unowned') return { value:String(Math.max(0,total - stats.collected)),detail:'Still missing' };
    if (key === 'unmastered') return { value:String(Math.max(0,total - stats.mastered)),detail:'Still to master' };
    if (rarity) return { value:`${rarity.collected} / ${rarity.total}`,detail:`${rarity.mastered} mastered` };
    return { value:'0 / 0',detail:'No Sprites yet' };
  }

  function renderStats(container,rawStats) {
    const stats = cleanStats(rawStats);
    container.replaceChildren();
    stats.displayStats.forEach((key) => {
      const definition = statDefinitions.find((entry) => entry.key === key);
      if (!definition) return;
      const info = statValue(key,stats);
      const item = document.createElement('article');
      item.className = 'profile-stat-item';
      item.dataset.stat = key;
      const label = document.createElement('span');
      label.textContent = definition.label;
      const strong = document.createElement('strong');
      strong.textContent = info.value;
      const small = document.createElement('small');
      small.textContent = info.detail;
      item.append(label,strong,small);
      container.appendChild(item);
    });
  }

  function cloudState() { return account?.status?.() || { state:session() ? 'checking' : 'signed-out',detail:session() ? 'Checking account progress…' : 'Sign in to save across devices' }; }
  function lastSaveText(value) {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) return 'Preparing your first save…';
    const date = new Date(parsed);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    const time = new Intl.DateTimeFormat(undefined,{ hour:'numeric',minute:'2-digit' }).format(date);
    return sameDay ? `Last save at ${time}` : `Last save ${new Intl.DateTimeFormat(undefined,{ month:'short',day:'numeric' }).format(date)} at ${time}`;
  }
  function friendlyCloudDetail(state,lastSyncedAt = '') {
    if (state === 'synced') return lastSaveText(lastSyncedAt);
    if (['checking','syncing','pending','attention','error'].includes(state)) return 'Saving automatically…';
    if (state === 'offline') return 'Offline · saving resumes when connected';
    if (state === 'setup') return 'Account saving needs setup';
    return 'Sign in to save across devices';
  }
  function friendlyProfileError(error) {
    const message = String(error?.message || '');
    if (/profile_image_path|column .* does not exist/i.test(message)) return 'Profile setup needs the V134 Supabase update.';
    if (/jwt|issued at future|token.*expired/i.test(message)) return 'Refreshing your account session. Please try again.';
    return message;
  }
  function renderCloudState() {
    const currentSession = session();
    const cloud = cloudState();
    const state = cleanText(cloud.state || (currentSession ? 'checking' : 'signed-out'),30);
    quickCloudIndicator.dataset.state = state;
    cloudStateDot.dataset.state = state;
    accountName.textContent = ownProfile?.displayName || cleanText(currentSession?.user?.user_metadata?.display_name || 'Sprite Collector',40);
    accountEmail.textContent = currentSession?.user?.email || 'Signed-out account';
    cloudStateText.textContent = friendlyCloudDetail(state,cloud.lastSyncedAt);
  }

  function fallbackProfile() {
    const currentSession = session();
    return {
      meadowCode:'',displayName:cleanText(currentSession?.user?.user_metadata?.display_name || 'Sprite Collector',40),avatar:'sprite',imagePath:'',bio:'',privacy:'code',favorites:[],stats:localStats(defaultStats),updatedAt:''
    };
  }

  function renderQuickAvatar() {
    const profile = ownProfile || fallbackProfile();
    setAvatar(quickAvatar,profile.avatar,profile.imagePath,profile.updatedAt);
    quickButton.classList.toggle('is-active',!page.hidden && !routeCode());
  }

  function renderOwner() {
    const profile = ownProfile || fallbackProfile();
    const stats = localStats(profile.stats.displayStats);
    setAvatar(ownerAvatar,profile.avatar,profile.imagePath,profile.updatedAt);
    setAvatar(heroAvatar,profile.avatar,profile.imagePath,profile.updatedAt);
    ownerName.textContent = profile.displayName || 'Sprite Collector';
    fitProfileName(ownerName);
    ownerBio.textContent = profile.bio || '';
    ownerBio.hidden = !profile.bio;
    heroCode.textContent = profile.meadowCode || 'Creating…';
    heroShareButton.hidden = !profile.meadowCode || profile.privacy === 'private';
    ownerCode.textContent = profile.meadowCode || '—';
    ownerCodeRow.hidden = !profile.meadowCode;
    shareButton.hidden = !profile.meadowCode || profile.privacy === 'private';
    renderStats(ownerStats,stats);
    renderFavoriteShowcase(ownerFavorites,ownerFavoritesEmpty,profile.favorites);
    renderQuickAvatar();
    renderCloudState();
  }

  function renderVisitor(profile) {
    setAvatar(visitorAvatar,profile.avatar,profile.imagePath,profile.updatedAt);
    visitorName.textContent = profile.displayName || 'Sprite Collector';
    fitProfileName(visitorName);
    visitorBio.textContent = profile.bio || 'This collector has not added a bio yet.';
    visitorCode.textContent = profile.meadowCode;
    renderStats(visitorStats,profile.stats);
    renderFavoriteShowcase(visitorFavorites,visitorFavoritesEmpty,profile.favorites);
  }

  function fitProfileName(element) {
    if (!element) return;
    element.style.fontSize = '';
    requestAnimationFrame(() => {
      const available = element.parentElement?.clientWidth || 0;
      if (!available) return;
      let size = parseFloat(getComputedStyle(element).fontSize) || 48;
      while (element.scrollWidth > available && size > 20) {
        size -= 1;
        element.style.fontSize = `${size}px`;
      }
    });
  }

  function showOwnerMode() {
    const signedIn = Boolean(session());
    setupNotice.hidden = configured();
    signedOut.hidden = signedIn;
    ownerHero.hidden = true;
    ownerPanel.hidden = !signedIn;
    visitorPanel.hidden = true;
    showMineButton.hidden = true;
    shownVisitorCode = '';
    if (signedIn) {
      if (lookupPanel && ownerPanel.nextElementSibling !== lookupPanel) page.insertBefore(ownerPanel,lookupPanel);
      renderOwner();
    }
    else renderQuickAvatar();
    renderCloudState();
  }

  function showVisitorMode(profile) {
    setupNotice.hidden = configured();
    signedOut.hidden = true;
    ownerPanel.hidden = true;
    ownerHero.hidden = true;
    visitorPanel.hidden = false;
    showMineButton.hidden = !session();
    shownVisitorCode = profile.meadowCode;
    if (lookupPanel && visitorPanel.nextElementSibling !== lookupPanel) page.insertBefore(visitorPanel,lookupPanel);
    renderVisitor(profile);
    renderQuickAvatar();
  }

  async function loadOwnProfile({ pageStatus = true } = {}) {
    const currentSession = session();
    if (!configured() || !currentSession) {
      ownProfile = null;
      ownProfileUserId = '';
      loadingOwnUserId = '';
      if (!page.hidden) showOwnerMode();
      else { renderQuickAvatar();renderCloudState(); }
      return;
    }
    if (ownProfileUserId === currentSession.user.id) {
      if (!page.hidden && !routeCode()) showOwnerMode();
      else { renderQuickAvatar();renderCloudState(); }
      return;
    }
    if (loadingOwnUserId === currentSession.user.id) return;
    loadingOwnUserId = currentSession.user.id;
    const requestId = ++loadSequence;
    if (pageStatus && !page.hidden) setStatus('Loading your Sprite Profile…');
    try {
      const token = await account.accessToken();
      let rows = await account.request(`/rest/v1/${profileTable}?select=meadow_code,display_name,avatar_key,profile_image_path,bio,privacy,favorites,collection_stats,updated_at&user_id=eq.${encodeURIComponent(currentSession.user.id)}&limit=1`,{ token });
      if (!Array.isArray(rows) || !rows[0]?.meadow_code) {
        let defaultName = cleanText(currentSession.user.user_metadata?.display_name || currentSession.user.email?.split('@')[0] || 'Sprite Collector',40);
        if (defaultName.length < 2) defaultName = 'Sprite Collector';
        rows = await account.request(`/rest/v1/${profileTable}?on_conflict=user_id`,{
          method:'POST',
          token,
          headers:{ Prefer:'resolution=merge-duplicates,return=representation' },
          body:{
            user_id:currentSession.user.id,
            display_name:defaultName,
            avatar_key:'sprite',
            profile_image_path:'',
            bio:'',
            privacy:'code',
            favorites:[],
            collection_stats:localStats(defaultStats)
          }
        });
      }
      if (requestId !== loadSequence) return;
      ownProfile = normalizeProfile(Array.isArray(rows) ? rows[0] : null);
      ownProfileUserId = currentSession.user.id;
      if (!page.hidden && !routeCode()) {
        showOwnerMode();
        if (pageStatus) setStatus(ownProfile ? 'Your profile is ready.' : 'Create your profile to receive a Meadow Code.',ownProfile ? 'success' : '');
      } else {
        renderQuickAvatar();
        renderCloudState();
      }
    } catch (error) {
      ownProfile = null;
      ownProfileUserId = '';
      if (!page.hidden && !routeCode()) {
        showOwnerMode();
        if (pageStatus) setStatus(friendlyProfileError(error) || 'Your profile could not be loaded.','error');
      }
    } finally {
      if (loadingOwnUserId === currentSession.user.id) loadingOwnUserId = '';
    }
  }

  async function visitProfile(code) {
    const clean = cleanCode(code);
    if (clean.length !== 8) return setStatus('Enter the full 8-character Meadow Code.','error');
    if (!configured()) { showOwnerMode();return setStatus('Profiles need Account & Cloud setup before Meadow Codes can be used.','error'); }
    if (shownVisitorCode === clean && !visitorPanel.hidden) return;
    if (loadingCode === clean) return;
    loadingCode = clean;
    const requestId = ++loadSequence;
    setStatus(`Looking for ${clean}…`);
    try {
      let token = '';
      if (session()) {
        try { token = await account.accessToken(); } catch { token = ''; }
      }
      const rows = await account.request('/rest/v1/rpc/get_sprite_profile_by_code',{ method:'POST',token,body:{ lookup_code:clean } });
      if (requestId !== loadSequence) return;
      const profile = normalizeProfile(Array.isArray(rows) ? rows[0] : rows);
      if (!profile) { showOwnerMode();return setStatus('No shared profile was found for that Meadow Code.','error'); }
      lookupCode.value = profile.meadowCode;
      showVisitorMode(profile);
      setStatus(`Visiting ${profile.displayName}.`,'success');
    } catch (error) {
      if (requestId !== loadSequence) return;
      showOwnerMode();
      setStatus(friendlyProfileError(error) || 'That profile could not be opened.','error');
    } finally {
      if (loadingCode === clean) loadingCode = '';
    }
  }

  function revokePreview() {
    if (!pendingImagePreview) return;
    try { URL.revokeObjectURL(pendingImagePreview); } catch { /* Preview cleanup is best effort. */ }
    pendingImagePreview = '';
  }

  function renderEditAvatar() {
    const profile = ownProfile || fallbackProfile();
    setAvatar(editAvatar,currentAvatar(),draftImagePath,profile.updatedAt,pendingImagePreview);
    removePictureButton.hidden = !draftImagePath && !pendingImageBlob;
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
      button.disabled = exists || (!exists && draftFavorites.length >= MAX_FAVORITES);
      button.append(favoriteThumb(match),favoriteCopy(match));
      const action = document.createElement('span');
      action.className = 'profile-favorite-action';
      action.textContent = exists ? 'Added' : (draftFavorites.length >= MAX_FAVORITES ? 'Full' : 'Add');
      button.appendChild(action);
      button.addEventListener('click',() => {
        if (exists || draftFavorites.length >= MAX_FAVORITES) return;
        draftFavorites.push(favorite);
        favoriteSearch.value = '';
        favoriteResults.hidden = true;
        favoriteSearch.setAttribute('aria-expanded','false');
        renderSelectedFavorites();
      });
      favoriteResults.appendChild(button);
    });
  }

  function renderStatEditor() {
    statSelected.replaceChildren();
    draftStatLayout.forEach((key,index) => {
      const definition = statDefinitions.find((entry) => entry.key === key);
      if (!definition) return;
      const row = document.createElement('div');
      row.className = 'profile-stat-row';
      const label = document.createElement('strong');
      label.textContent = definition.label;
      const up = document.createElement('button');
      up.type = 'button';up.dataset.action = 'up';up.textContent = '↑';up.disabled = index === 0;up.setAttribute('aria-label',`Move ${definition.label} up`);
      const down = document.createElement('button');
      down.type = 'button';down.dataset.action = 'down';down.textContent = '↓';down.disabled = index === draftStatLayout.length - 1;down.setAttribute('aria-label',`Move ${definition.label} down`);
      const remove = document.createElement('button');
      remove.type = 'button';remove.dataset.action = 'remove';remove.textContent = '×';remove.disabled = draftStatLayout.length <= MIN_STATS;remove.setAttribute('aria-label',`Remove ${definition.label}`);
      up.addEventListener('click',() => { [draftStatLayout[index - 1],draftStatLayout[index]] = [draftStatLayout[index],draftStatLayout[index - 1]];renderStatEditor(); });
      down.addEventListener('click',() => { [draftStatLayout[index],draftStatLayout[index + 1]] = [draftStatLayout[index + 1],draftStatLayout[index]];renderStatEditor(); });
      remove.addEventListener('click',() => { if (draftStatLayout.length > MIN_STATS) { draftStatLayout.splice(index,1);renderStatEditor(); } });
      row.append(label,up,down,remove);
      statSelected.appendChild(row);
    });
    const wrap = document.createElement('div');
    wrap.className = 'profile-stat-add';
    statDefinitions.filter((entry) => !draftStatLayout.includes(entry.key)).forEach((definition) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `+ ${definition.label}`;
      button.disabled = draftStatLayout.length >= MAX_STATS;
      button.addEventListener('click',() => { if (draftStatLayout.length < MAX_STATS) { draftStatLayout.push(definition.key);renderStatEditor(); } });
      wrap.appendChild(button);
    });
    statAvailable.replaceChildren(wrap);
  }

  function openEditor() {
    if (!session()) return account?.openAccount?.();
    const profile = ownProfile || fallbackProfile();
    displayNameInput.value = profile.displayName || 'Sprite Collector';
    bioInput.value = profile.bio || '';
    bioCount.textContent = String(bioInput.value.length);
    privacySelect.value = profile.privacy;
    setAvatarChoice(profile.avatar);
    draftFavorites = cleanFavorites(profile.favorites);
    draftStatLayout = cleanStatLayout(profile.stats.displayStats);
    draftImagePath = profile.imagePath || '';
    pendingImageBlob = null;
    removeExistingImage = false;
    revokePreview();
    pictureInput.value = '';
    favoriteSearch.value = '';
    favoriteResults.hidden = true;
    renderEditAvatar();
    renderSelectedFavorites();
    renderStatEditor();
    setEditStatus('');
    document.documentElement.classList.add('profile-edit-open');
    document.body.classList.add('profile-edit-open');
    if (!editDialog.open) editDialog.showModal();
    requestAnimationFrame(() => { try { editTitle.focus({ preventScroll:true }); } catch { editTitle.focus(); } });
  }

  function closeEditor() {
    revokePreview();
    pendingImageBlob = null;
    if (editDialog.open) editDialog.close();
  }

  function resizeProfilePicture(file) {
    return new Promise((resolve,reject) => {
      if (!file || !/^image\/(?:png|jpeg|webp)$/i.test(file.type || '')) return reject(new Error('Choose a PNG, JPG, or WebP image.'));
      if (file.size > 10 * 1024 * 1024) return reject(new Error('Choose an image smaller than 10 MB.'));
      const source = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        try {
          const size = Math.min(image.naturalWidth,image.naturalHeight);
          const sx = Math.max(0,(image.naturalWidth - size) / 2);
          const sy = Math.max(0,(image.naturalHeight - size) / 2);
          const canvas = document.createElement('canvas');
          canvas.width = 512;canvas.height = 512;
          const context = canvas.getContext('2d',{ alpha:false });
          context.fillStyle = '#0b1220';context.fillRect(0,0,512,512);
          context.drawImage(image,sx,sy,size,size,0,0,512,512);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('That picture could not be prepared.')),'image/jpeg',.88);
        } catch (error) { reject(error); }
        finally { URL.revokeObjectURL(source); }
      };
      image.onerror = () => { URL.revokeObjectURL(source);reject(new Error('That picture could not be opened.')); };
      image.src = source;
    });
  }

  async function choosePicture() {
    const file = pictureInput.files?.[0];
    if (!file) return;
    setEditStatus('Preparing your profile picture…');
    try {
      const blob = await resizeProfilePicture(file);
      revokePreview();
      pendingImageBlob = blob;
      pendingImagePreview = URL.createObjectURL(blob);
      removeExistingImage = false;
      renderEditAvatar();
      setEditStatus('Picture ready. Save your profile to upload it.','success');
    } catch (error) {
      pictureInput.value = '';
      setEditStatus(error?.message || 'That picture could not be used.','error');
    }
  }

  async function updateProfilePicture(token,userId) {
    const oldPath = ownProfile?.imagePath || '';
    if (pendingImageBlob) {
      const path = `${userId}/avatar.jpg`;
      await account.request(`/storage/v1/object/${PROFILE_BUCKET}/${path}`,{
        method:'POST',token,rawBody:pendingImageBlob,headers:{ 'Content-Type':'image/jpeg','x-upsert':'true' }
      });
      return path;
    }
    if (removeExistingImage && oldPath) {
      try { await account.request(`/storage/v1/object/${PROFILE_BUCKET}/${oldPath}`,{ method:'DELETE',token }); }
      catch (error) { if (error?.status !== 404) throw error; }
      return '';
    }
    return draftImagePath;
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (saving || !configured() || !session()) return;
    const name = cleanText(displayNameInput.value,40);
    if (name.length < 2) { setEditStatus('Use at least 2 characters for your display name.','error');return displayNameInput.focus(); }
    if (draftStatLayout.length < MIN_STATS || draftStatLayout.length > MAX_STATS) return setEditStatus('Choose between 3 and 6 profile stats.','error');
    saving = true;
    saveButton.disabled = true;
    editForm.setAttribute('aria-busy','true');
    setEditStatus('Saving your profile…');
    try {
      const currentSession = session();
      const token = await account.accessToken();
      const imagePath = await updateProfilePicture(token,currentSession.user.id);
      const stats = localStats(draftStatLayout);
      const payload = {
        user_id:currentSession.user.id,
        display_name:name,
        avatar_key:currentAvatar(),
        profile_image_path:imagePath,
        bio:cleanText(bioInput.value,160),
        privacy:privacyValues.has(privacySelect.value) ? privacySelect.value : 'code',
        favorites:cleanFavorites(draftFavorites),
        collection_stats:stats
      };
      const rows = await account.request(`/rest/v1/${profileTable}?on_conflict=user_id`,{
        method:'POST',token,headers:{ Prefer:'resolution=merge-duplicates,return=representation' },body:payload
      });
      ownProfile = normalizeProfile(Array.isArray(rows) ? rows[0] : rows);
      ownProfileUserId = currentSession.user.id;
      if (!ownProfile) throw new Error('The profile saved, but its Meadow Code could not be read.');
      renderOwner();
      setStatus(`Profile saved · Meadow Code ${ownProfile.meadowCode}`,'success');
      closeEditor();
    } catch (error) {
      setEditStatus(friendlyProfileError(error) || 'Your profile could not be saved.','error');
    } finally {
      saving = false;
      saveButton.disabled = false;
      editForm.setAttribute('aria-busy','false');
    }
  }

  function profileUrl(code) { const url = new URL(location.href);url.hash = `profile/${cleanCode(code)}`;return url.href; }
  async function copyText(value,message) {
    try { await navigator.clipboard.writeText(value);setStatus(message,'success'); }
    catch { setStatus('Copying is not available in this browser. Press and hold the Meadow Code to copy it.','error'); }
  }
  async function shareProfile() {
    if (!ownProfile?.meadowCode || ownProfile.privacy === 'private') return;
    const shareData = { title:`${ownProfile.displayName} · My Sprite Tracker`,text:`Visit my Sprite Profile with Meadow Code ${ownProfile.meadowCode}.`,url:profileUrl(ownProfile.meadowCode) };
    if (navigator.share) {
      try { await navigator.share(shareData);setStatus('Profile shared.','success');return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    await copyText(shareData.url,'Profile link copied.');
  }

  async function renderFromRoute() {
    quickButton.classList.toggle('is-active',!page.hidden && !routeCode());
    if (page.hidden) return;
    setupNotice.hidden = configured();
    const code = routeCode();
    if (code) await visitProfile(code);
    else await loadOwnProfile();
  }

  quickButton.addEventListener('click',() => {
    if (location.hash === '#profile') window.scrollTo({ top:0,behavior:'smooth' });
    else location.hash = '#profile';
  });
  lookupCode.addEventListener('input',() => { const clean = cleanCode(lookupCode.value);if (lookupCode.value !== clean) lookupCode.value = clean; });
  lookupForm.addEventListener('submit',(event) => {
    event.preventDefault();
    const code = cleanCode(lookupCode.value);
    if (code.length !== 8) return setStatus('Enter the full 8-character Meadow Code.','error');
    const hash = `#profile/${code}`;
    if (location.hash === hash) visitProfile(code);else location.hash = hash;
  });
  showMineButton.addEventListener('click',() => { location.hash = '#profile'; });
  openAccountButton.addEventListener('click',() => account?.openAccount?.());
  manageAccountButton.addEventListener('click',() => account?.openAccount?.());
  editButton.addEventListener('click',openEditor);
  shareButton.addEventListener('click',shareProfile);
  heroShareButton.addEventListener('click',shareProfile);
  ownerCodeRow.addEventListener('click',() => { if (ownProfile?.meadowCode) copyText(ownProfile.meadowCode,'Meadow Code copied.'); });
  editCloseButton.addEventListener('click',closeEditor);
  editDialog.addEventListener('cancel',(event) => { event.preventDefault();closeEditor(); });
  editDialog.addEventListener('close',() => {
    document.documentElement.classList.remove('profile-edit-open');
    document.body.classList.remove('profile-edit-open');
    revokePreview();
  });
  editDialog.addEventListener('click',(event) => { if (event.target === editDialog) closeEditor(); });
  editForm.addEventListener('submit',saveProfile);
  pictureInput.addEventListener('change',choosePicture);
  removePictureButton.addEventListener('click',() => {
    pendingImageBlob = null;revokePreview();draftImagePath = '';removeExistingImage = true;pictureInput.value = '';renderEditAvatar();setEditStatus('Picture will be removed when you save.');
  });
  bioInput.addEventListener('input',() => { bioCount.textContent = String(bioInput.value.length); });
  editForm.querySelectorAll('input[name="profileAvatar"]').forEach((input) => input.addEventListener('change',renderEditAvatar));
  favoriteSearch.addEventListener('input',renderFavoriteResults);
  favoriteSearch.addEventListener('keydown',(event) => {
    if (event.key !== 'Escape') return;
    favoriteSearch.value = '';favoriteResults.hidden = true;favoriteSearch.setAttribute('aria-expanded','false');
  });
  window.addEventListener('sprite-profile-view-opened',renderFromRoute);
  window.addEventListener('hashchange',renderFromRoute);
  window.addEventListener('sprite-cloud-status-changed',renderCloudState);
  window.addEventListener('sprite-cloud-session-changed',() => {
    ownProfile = null;ownProfileUserId = '';loadingOwnUserId = '';renderQuickAvatar();renderCloudState();renderFromRoute();
  });

  setAvatar(quickAvatar,'sprite');
  setAvatar(heroAvatar,'sprite');
  setAvatar(ownerAvatar,'sprite');
  setAvatar(visitorAvatar,'sprite');
  setAvatar(editAvatar,'sprite');
  setupNotice.hidden = configured();
  showOwnerMode();
  renderFromRoute();
  if (session() && configured()) loadOwnProfile({ pageStatus:false });
})();
