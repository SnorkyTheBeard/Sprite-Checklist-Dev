(() => {
  'use strict';

  const baseData = Array.isArray(window.SPRITE_DATA) ? window.SPRITE_DATA : [];
  const rarities = ['Rare','Epic','Legendary','Mythic'];
  const UNOWNED_PAGE = 'Unowned';
  const pageTabs = [...rarities,UNOWNED_PAGE];
  const defaultRarity = 'Rare';
  const hasOwn = (object,key) => Object.prototype.hasOwnProperty.call(object || {},key);
  const seasonCatalog = Array.isArray(window.SPRITE_SEASONS) && window.SPRITE_SEASONS.length
    ? window.SPRITE_SEASONS
        .filter((season) => season?.id && season?.label)
        .map((season) => ({ id:String(season.id), label:String(season.label) }))
    : [{ id:'chapter-7-season-3', label:'Chapter 7 Season 3' }];
  const CURRENT_SEASON_ID = seasonCatalog.some((season) => season.id === window.CURRENT_SPRITE_SEASON)
    ? window.CURRENT_SPRITE_SEASON
    : seasonCatalog[0].id;
  const SEASON_FEATURE_VISIBLE = true;
  const SEASON_VIEW_ALL = 'all';
  const APP_VIEW_TRACKER = 'tracker';
  const APP_VIEW_VAULT = 'vault';
  const APP_VIEW_JOURNAL = 'journal';
  const APP_VIEW_HUNTS = 'hunts';
  const APP_VIEW_DUST = 'dust';

  function appStorageScope() {
    const firstPathPart = decodeURIComponent(location.pathname.split('/').filter(Boolean)[0] || 'root');
    return firstPathPart.toLowerCase().replace(/[^a-z0-9_-]+/g,'-') || 'root';
  }

  const STORAGE_SCOPE = appStorageScope();
  const PROGRESS_KEY = `galaxy_sprite_tracker_progress_v2_${STORAGE_SCOPE}`;
  const VIEW_MODES_KEY = `galaxy_sprite_tracker_view_modes_v1_${STORAGE_SCOPE}`;
  const MISSING_VIEW_KEY = `galaxy_sprite_tracker_missing_view_v1_${STORAGE_SCOPE}`;
  const RECENT_MISSING_KEY = `galaxy_sprite_tracker_recent_missing_v1_${STORAGE_SCOPE}`;
  const SEASON_VIEW_KEY = `galaxy_sprite_tracker_season_view_v1_${STORAGE_SCOPE}`;
  const SPRITE_CARD_EDITS_KEY = `galaxy_sprite_tracker_sprite_cards_v1_${STORAGE_SCOPE}`;
  const PRE_RESTORE_PROGRESS_KEY = `galaxy_sprite_tracker_progress_before_restore_v1_${STORAGE_SCOPE}`;
  const HUNT_MODE_KEY = `galaxy_sprite_tracker_hunt_mode_v1_${STORAGE_SCOPE}`;
  const HUNT_CART_KEY = `galaxy_sprite_tracker_hunt_cart_v1_${STORAGE_SCOPE}`;
  const HUNT_HISTORY_KEY = `galaxy_sprite_tracker_hunt_history_v1_${STORAGE_SCOPE}`;
  const DUST_LEDGER_KEY = `galaxy_sprite_tracker_dust_ledger_v1_${STORAGE_SCOPE}`;
  const JOURNAL_FALLBACK_KEY = `galaxy_sprite_tracker_collection_journal_v1_${STORAGE_SCOPE}`;
  const JOURNAL_DB_NAME = `galaxy-sprite-tracker-journal-${STORAGE_SCOPE}`;
  const JOURNAL_DB_STORE = 'entries';
  const MAX_JOURNAL_ENTRIES = 500;
  const LEGACY_PROGRESS_KEY = 'galaxy_sprite_tracker_progress_v1';
  const BACKUP_FORMAT = 'my-sprite-tracker-backup';
  const BACKUP_VERSION = 4;
  const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
  const MAX_HUNT_HISTORY = 300;
  const MAX_DUST_RECEIPTS = 1000;
  const SEASON_VIEWS = [...seasonCatalog.map((season) => season.id),SEASON_VIEW_ALL];
  const CARD_REORDER_MIME = 'application/x-sprite-card';
  const GITHUB_TOKEN_SESSION_KEY = `galaxy_sprite_tracker_github_token_${STORAGE_SCOPE}`;
  const GITHUB_API_VERSION = '2026-03-10';
  const GITHUB_PUBLISH_TARGET = {
    owner:'SnorkyTheBeard',
    repo:'Sprite-Checklist-Dev',
    branch:'main'
  };

  function clearRetiredEditorStorage(storage) {
    if (!storage) return;
    const prefixes = [
      'galaxy_sprite_tracker_design_',
      'galaxy_sprite_tracker_owner_unlocked_',
      'galaxy_sprite_tracker_cloud_sync_'
    ];
    const keys = [];
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch {
      /* Storage can be unavailable in strict private-browsing modes. */
    }
  }

  clearRetiredEditorStorage(window.localStorage);
  clearRetiredEditorStorage(window.sessionStorage);

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  }

  function loadProgress() {
    const current = readJson(PROGRESS_KEY);
    if (current) return current;
    if (!STORAGE_SCOPE.startsWith('sprite-checklist')) return {};
    const legacy = readJson(LEGACY_PROGRESS_KEY);
    if (!legacy) return {};
    try { localStorage.setItem(PROGRESS_KEY,JSON.stringify(legacy)); } catch { /* Keep it in memory. */ }
    return legacy;
  }

  function loadMissingView() {
    const hashView = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    if (hashView === 'unowned' || hashView === 'unmastered') return hashView;
    try {
      return localStorage.getItem(MISSING_VIEW_KEY) === 'unmastered' ? 'unmastered' : 'unowned';
    } catch {
      return 'unowned';
    }
  }

  function loadAppView() {
    const hashView = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    if (hashView === APP_VIEW_VAULT && SEASON_FEATURE_VISIBLE) return APP_VIEW_VAULT;
    if (hashView === APP_VIEW_JOURNAL) return APP_VIEW_JOURNAL;
    if (hashView === APP_VIEW_HUNTS) return APP_VIEW_HUNTS;
    if (hashView === APP_VIEW_DUST) return APP_VIEW_DUST;
    return APP_VIEW_TRACKER;
  }

  function loadHuntMode() {
    const saved = readJson(HUNT_MODE_KEY) || {};
    const startedAt = validIsoDate(saved.startedAt);
    const sessionStartedAt = validIsoDate(saved.sessionStartedAt) || startedAt;
    const lastDurationMs = Number.isFinite(Number(saved.lastDurationMs))
      ? Math.max(0,Math.min(Number(saved.lastDurationMs),7 * 24 * 60 * 60 * 1000))
      : 0;
    return {
      active:saved.active === true && Boolean(startedAt),
      startedAt,
      sessionStartedAt,
      lastDurationMs
    };
  }

  function normalizeHuntCart(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0,250).flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const familyId = String(item.familyId || '').slice(0,200);
      const variantId = String(item.variantId || '').slice(0,200);
      if (!familyId || !variantId) return [];
      return [{
        id:String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0,200),
        familyId,
        variantId,
        level:Math.max(1,Math.min(5,Math.round(Number(item.level) || 1))),
        addedAt:validIsoDate(item.addedAt) || new Date().toISOString()
      }];
    });
  }

  function normalizeHuntHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0,MAX_HUNT_HISTORY).flatMap((hunt) => {
      if (!hunt || typeof hunt !== 'object') return [];
      const completedAt = validIsoDate(hunt.completedAt);
      if (!completedAt) return [];
      const items = Array.isArray(hunt.items) ? hunt.items.slice(0,250).flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        return [{
          familyId:String(item.familyId || '').slice(0,200),
          variantId:String(item.variantId || '').slice(0,200),
          familyName:String(item.familyName || 'Sprite').slice(0,80),
          variantName:String(item.variantName || 'Variant').slice(0,80),
          rarity:rarities.includes(item.rarity) ? item.rarity : defaultRarity,
          level:Math.max(1,Math.min(5,Math.round(Number(item.level) || 1))),
          dust:Math.max(0,Math.min(1000000,Math.round(Number(item.dust) || 0)))
        }];
      }) : [];
      return [{
        id:String(hunt.id || `${Date.parse(completedAt)}-hunt`).slice(0,200),
        startedAt:validIsoDate(hunt.startedAt),
        completedAt,
        durationMs:Math.max(0,Math.min(7 * 24 * 60 * 60 * 1000,Number(hunt.durationMs) || 0)),
        dustEarned:Math.max(0,Math.min(100000000,Math.round(Number(hunt.dustEarned) || 0))),
        items
      }];
    });
  }

  function normalizeDustLedger(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0,MAX_DUST_RECEIPTS).flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const createdAt = validIsoDate(entry.createdAt);
      const allowedTypes = new Set(['deposit','purchase','adjustment-in','adjustment-out']);
      const type = allowedTypes.has(entry.type) ? entry.type : '';
      const amount = Math.max(0,Math.min(100000000,Math.round(Number(entry.amount) || 0)));
      if (!createdAt || !type || !amount) return [];
      return [{
        id:String(entry.id || `${Date.parse(createdAt)}-${type}`).slice(0,200),
        type,
        amount,
        note:String(entry.note || (type === 'deposit'
          ? 'Hunt deposit'
          : (type === 'purchase' ? 'Sprite Dust purchase' : 'Manual balance adjustment'))).slice(0,100),
        createdAt,
        huntId:String(entry.huntId || '').slice(0,200)
      }];
    });
  }

  function loadStoredArray(key,normalizer) {
    try { return normalizer(JSON.parse(localStorage.getItem(key) || '[]')); }
    catch { return []; }
  }

  function loadRecentMissingChanges() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(RECENT_MISSING_KEY) || 'null');
      return {
        unowned:Array.isArray(saved?.unowned) ? saved.unowned.slice(0,4) : [],
        unmastered:Array.isArray(saved?.unmastered) ? saved.unmastered.slice(0,4) : []
      };
    } catch {
      return { unowned:[], unmastered:[] };
    }
  }

  function loadSpriteCardEdits() {
    const saved = readJson(SPRITE_CARD_EDITS_KEY);
    return {
      families:saved?.families && typeof saved.families === 'object' ? saved.families : {},
      customFamilies:Array.isArray(saved?.customFamilies) ? saved.customFamilies : [],
      lastPublishedSnapshot:saved?.lastPublishedSnapshot || ''
    };
  }

  function loadViewModes() {
    return readJson(VIEW_MODES_KEY) || {};
  }

  function loadSeasonView() {
    try {
      const saved = localStorage.getItem(SEASON_VIEW_KEY);
      if (!SEASON_FEATURE_VISIBLE) return CURRENT_SEASON_ID;
      if (saved === 'current' || saved === 'previous') return CURRENT_SEASON_ID;
      return SEASON_VIEWS.includes(saved) ? saved : CURRENT_SEASON_ID;
    } catch {
      return CURRENT_SEASON_ID;
    }
  }

  const DEFAULT_HEADER = {
    kicker:'',
    title:'Sprite Checklist',
    subtitle:'',
    collectedLabel:'In Collection',
    masteredLabel:'Mastered',
    masterPrompt:'Tap crown to master',
    footerNote:'Progress is saved on this device.',
    showSummary:true,
    summaryPositions:{
      mode:'normal',
      collected:{ x:25, y:78 },
      mastered:{ x:75, y:78 }
    }
  };

  const DEFAULT_PAGES = {
    ...Object.fromEntries(rarities.map((rarity) => [rarity,{
      eyebrow:'Sprite Checklist',
      title:`${rarity} Sprites`,
      description:''
    }])),
    [UNOWNED_PAGE]:{
      eyebrow:'Sprite Checklist',
      title:'Unowned/Unmastered',
      description:'See every Sprite still missing from your collection or waiting to be mastered.'
    }
  };

  const DEFAULT_VARIANT_BACKGROUNDS = {
    base:'assets/variant-backgrounds/variant-well-base.webp',
    gold:'assets/variant-backgrounds/variant-well-gold.webp',
    gummy:'assets/variant-backgrounds/variant-well-gummy.webp',
    galaxy:'assets/variant-backgrounds/variant-well-galaxy.webp',
    cube:'assets/variant-backgrounds/variant-well-cube.webp',
    gem:'assets/variant-backgrounds/variant-well-gem.webp',
    quack:'assets/variant-backgrounds/variant-well-quack.webp',
    holofoil:'assets/variant-backgrounds/variant-well-holofoil.webp'
  };

  const FEATURED_VARIANT_BACKGROUNDS = Object.freeze({
    'custom-john-wick':'assets/variant-backgrounds/variant-well-john-wick.webp?v=92'
  });

  const DEFAULT_PAGE_BACKGROUNDS = {
    Rare:{ enabled:true, color:'#0752c7', image:'assets/page-backgrounds/page-bg-rare-lifty-lodge-v113.webp', mode:'cover' },
    Epic:{ enabled:true, color:'#43128d', image:'assets/page-backgrounds/page-bg-epic-wonkeeland-v113.webp', mode:'cover' },
    Legendary:{ enabled:true, color:'#1a0d05', image:'assets/page-backgrounds/page-bg-legendary.webp', mode:'cover' },
    Mythic:{ enabled:true, color:'#100c08', image:'assets/page-backgrounds/page-bg-mythic.webp', mode:'cover' }
  };

  const DEFAULT_MISSING_PAGE_BACKGROUNDS = {
    unowned:{ enabled:true, color:'#06101f', image:'assets/page-backgrounds/page-bg-unowned.webp?v=93', mode:'cover' },
    unmastered:{ enabled:true, color:'#100a18', image:'assets/page-backgrounds/page-bg-unmastered.webp?v=93', mode:'cover' }
  };

  const DEFAULT_THEME = {
    bodyFont:'playful', headingFont:'playful', buttonFont:'system', summaryFont:'body',
    customFontData:'', customFontName:'',
    baseSize:17, titleSize:56, pageTitleSize:38, groupTitleSize:20, spriteLabelSize:23, checklistButtonSize:13,
    textColor:'#f9f001', mutedColor:'#c8c3e5',
    bodyBgColor:'#050505', bodyBgImage:'', bodyBgMode:'cover', useBuiltInBodyArt:false, showStars:true,
    headerBgColor:'#21184d', headerBgImage:'', headerBgMode:'cover', headerBgPosition:'center', headerTextColor:'#fff', headerOpacity:100, headerHeight:220,
    collectionStyle:'open', collectionBgColor:'#f3dfb4', collectionBgImage:'', collectionBgMode:'cover', useBuiltInCollectionArt:true, collectionTextColor:'#2a2144', collectionBorderColor:'#ffe097', collectionRadius:24,
    cardBgColor:'#fffaf0', cardBgImage:'', cardBgMode:'cover', cardTextColor:'#33234e', cardBorderColor:'#bca8cf', cardRadius:20,
    wellBgColor:'#e7ddfa', wellBgImage:'', wellBgMode:'cover', useBuiltInWellArt:true, wellBorderColor:'#b9a8d5',
    useVariantBackgrounds:true, variantBgMode:'cover', variantBackgrounds:DEFAULT_VARIANT_BACKGROUNDS,
    tabBgColor:'#14133d', tabActiveColor:'#ffcf55',
    summaryStyle:'text', summaryTextEffect:'shadow', summaryEffectColor:'#000', summaryEffectStrength:6, summaryNumberSize:20, summaryLabelSize:12, summaryNumberColor:'#fff', summaryLabelColor:'#c8c3e5', summaryBgColor:'#302b5c', summaryBorderColor:'#564d80', summaryRadius:16, summaryOpacity:100, summaryShowBars:false,
    buttonBgColor:'#fff', buttonTextColor:'#33234e', accentColor:'#59c8ff',
    leftArt:'', rightArt:'', artWidth:120,
    pageBackgrounds:DEFAULT_PAGE_BACKGROUNDS,
    pageHeaderBackgrounds:Object.fromEntries(rarities.map((rarity) => [rarity,{ enabled:false, image:'', mode:'cover', position:'center' }]))
  };

  const FONT_OPTIONS = {
    system:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif',
    rounded:'"Trebuchet MS","Arial Rounded MT Bold",Arial,sans-serif',
    storybook:'Georgia,"Times New Roman",serif',
    playful:'"Sprite Playful","Trebuchet MS",cursive',
    bold:'Impact,"Arial Black",sans-serif',
    mono:'"Courier New",monospace',
    custom:'"UserCustomFont",sans-serif'
  };

  function cloneJson(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch { return {}; }
  }

  function normalizePoint(value,fallback) {
    return {
      x:Math.max(7,Math.min(93,Number(value?.x) || fallback.x)),
      y:Math.max(10,Math.min(92,Number(value?.y) || fallback.y))
    };
  }

  function normalizeDesign(stored) {
    const source = stored && typeof stored === 'object' ? cloneJson(stored) : {};
    const storedTheme = source.theme || {};
    const summaryPositions = source.header?.summaryPositions || {};
    return {
      _meta:{ ...(source._meta || {}) },
      header:{
        ...DEFAULT_HEADER,
        ...(source.header || {}),
        summaryPositions:{
          mode:summaryPositions.mode === 'free' ? 'free' : 'normal',
          collected:normalizePoint(summaryPositions.collected,DEFAULT_HEADER.summaryPositions.collected),
          mastered:normalizePoint(summaryPositions.mastered,DEFAULT_HEADER.summaryPositions.mastered)
        }
      },
      pages:Object.fromEntries(rarities.map((rarity) => [rarity,{ ...DEFAULT_PAGES[rarity], ...(source.pages?.[rarity] || {}) }])),
      families:source.families && typeof source.families === 'object' ? source.families : {},
      customFamilies:Array.isArray(source.customFamilies) ? source.customFamilies : [],
      theme:{
        ...DEFAULT_THEME,
        ...storedTheme,
        variantBackgrounds:{ ...DEFAULT_VARIANT_BACKGROUNDS, ...(storedTheme.variantBackgrounds || {}) },
        pageBackgrounds:Object.fromEntries(rarities.map((rarity) => [rarity,{ ...DEFAULT_PAGE_BACKGROUNDS[rarity], ...(storedTheme.pageBackgrounds?.[rarity] || {}) }])),
        pageHeaderBackgrounds:Object.fromEntries(rarities.map((rarity) => [rarity,{ ...DEFAULT_THEME.pageHeaderBackgrounds[rarity], ...(storedTheme.pageHeaderBackgrounds?.[rarity] || {}) }]))
      }
    };
  }

  function normalizeVariantBackgroundKey(value) {
    return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }

  function applyArtConfig(target,config) {
    if (!config || typeof config !== 'object') return target;
    const theme = target.theme;

    const copyImage = (entry,imageKey,fitKey,fitTarget) => {
      if (!entry || typeof entry !== 'object') return;
      if (hasOwn(entry,'image') && entry.image !== null) theme[imageKey] = String(entry.image || '');
      if (entry.fit) theme[fitTarget || fitKey] = entry.fit;
    };

    copyImage(config.siteBackground,'bodyBgImage','bodyBgMode');
    copyImage(config.mainHeader,'headerBgImage','headerBgMode');
    if (config.mainHeader?.position) theme.headerBgPosition = config.mainHeader.position;

    Object.entries(config.text || {}).forEach(([key,value]) => {
      if (hasOwn(DEFAULT_HEADER,key) && value !== null) target.header[key] = value;
    });
    Object.entries(config.pages || {}).forEach(([rarity,values]) => {
      if (!rarities.includes(rarity) || !values || typeof values !== 'object') return;
      ['eyebrow','title','description'].forEach((key) => {
        if (hasOwn(values,key) && values[key] !== null) target.pages[rarity][key] = values[key];
      });
    });

    Object.entries(config.rarityBackgrounds || {}).forEach(([rarity,entry]) => {
      if (!rarities.includes(rarity) || entry === null || entry === undefined) return;
      const page = theme.pageBackgrounds[rarity];
      page.enabled = true;
      if (typeof entry === 'string') page.image = entry;
      else if (typeof entry === 'object') {
        if (hasOwn(entry,'image')) page.image = String(entry.image || '');
        if (entry.fit) page.mode = entry.fit;
        if (entry.color) page.color = entry.color;
        if (hasOwn(entry,'enabled')) page.enabled = Boolean(entry.enabled);
      }
    });

    Object.entries(config.rarityHeaders || {}).forEach(([rarity,entry]) => {
      if (!rarities.includes(rarity) || entry === null || entry === undefined) return;
      const header = theme.pageHeaderBackgrounds[rarity];
      if (typeof entry === 'string') {
        header.image = entry;
        header.enabled = Boolean(entry);
      } else if (typeof entry === 'object') {
        if (hasOwn(entry,'image')) header.image = String(entry.image || '');
        if (entry.fit) header.mode = entry.fit;
        if (entry.position) header.position = entry.position;
        header.enabled = hasOwn(entry,'enabled') ? Boolean(entry.enabled) : Boolean(header.image);
      }
    });

    Object.entries(config.variantBackgrounds || {}).forEach(([rawKey,value]) => {
      if (value === null) return;
      const key = normalizeVariantBackgroundKey(rawKey);
      if (key) theme.variantBackgrounds[key] = String(value || '');
    });

    Object.entries(config.groupBackgrounds || {}).forEach(([familyId,entry]) => {
      if (!entry || typeof entry !== 'object') return;
      const family = target.families[familyId] ||= {};
      if (hasOwn(entry,'visible')) family.visible = Boolean(entry.visible);
      if (hasOwn(entry,'image')) {
        family.customBg = Boolean(entry.image || entry.color);
        family.bgImage = String(entry.image || '');
      }
      if (entry.fit) family.bgMode = entry.fit;
      if (entry.color) {
        family.customBg = true;
        family.bgColor = entry.color;
      }
    });

    Object.entries(config.sprites || {}).forEach(([familyId,variants]) => {
      if (!variants || typeof variants !== 'object') return;
      const family = target.families[familyId] ||= {};
      family.variants ||= {};
      Object.entries(variants).forEach(([variantId,entry]) => {
        if (!entry || typeof entry !== 'object') return;
        const variant = family.variants[variantId] ||= {};
        if (hasOwn(entry,'image') && entry.image !== null) variant.image = String(entry.image || '');
        if (hasOwn(entry,'visible')) variant.visible = Boolean(entry.visible);
        if (hasOwn(entry,'cardBackground')) {
          variant.customCard = Boolean(entry.cardBackground || entry.cardColor);
          variant.cardImage = String(entry.cardBackground || '');
        }
        if (entry.cardFit) variant.cardMode = entry.cardFit;
        if (entry.cardColor) {
          variant.customCard = true;
          variant.cardColor = entry.cardColor;
        }
      });
    });

    if (config.sideArt && typeof config.sideArt === 'object') {
      if (hasOwn(config.sideArt,'left') && config.sideArt.left !== null) theme.leftArt = String(config.sideArt.left || '');
      if (hasOwn(config.sideArt,'right') && config.sideArt.right !== null) theme.rightArt = String(config.sideArt.right || '');
      if (config.sideArt.width !== null && config.sideArt.width !== undefined) theme.artWidth = Number(config.sideArt.width) || theme.artWidth;
    }
    return target;
  }

  const design = applyArtConfig(
    normalizeDesign(window.PUBLISHED_DESIGN && typeof window.PUBLISHED_DESIGN === 'object' ? window.PUBLISHED_DESIGN : {}),
    window.SPRITE_ART_CONFIG
  );
  const johnWickFamilyId = 'custom-john-wick';
  const hasJohnWickFamily = baseData.some((family) => family?.id === johnWickFamilyId)
    || design.customFamilies.some((family) => family?.id === johnWickFamilyId);
  if (!hasJohnWickFamily) {
    design.customFamilies.push({
      id:johnWickFamilyId,
      name:'John Wick',
      rarity:'Mythic',
      seasonId:CURRENT_SEASON_ID,
      variants:[{ id:'base', name:'Base', image:'' }]
    });
    design.families[johnWickFamilyId] = {
      ...(design.families[johnWickFamilyId] || {}),
      name:'John Wick',
      rarity:'Mythic',
      seasonId:CURRENT_SEASON_ID,
      visible:true,
      deleted:false,
      variants:{
        ...(design.families[johnWickFamilyId]?.variants || {}),
        base:{
          ...(design.families[johnWickFamilyId]?.variants?.base || {}),
          image:'published-assets/sprite-custom-john-wick-base.webp',
          rarityPercentage:'0%'
        }
      },
      addedVariants:Array.isArray(design.families[johnWickFamilyId]?.addedVariants)
        ? design.families[johnWickFamilyId].addedVariants
        : [],
      order:Array.isArray(design.families[johnWickFamilyId]?.order)
        ? design.families[johnWickFamilyId].order
        : ['base']
    };
  }
  let state = loadProgress();
  let spriteCardEdits = loadSpriteCardEdits();
  let spriteViewModes = loadViewModes();
  let vaultSeasonView = loadSeasonView();
  let appView = loadAppView();
  let seasonView = appView === APP_VIEW_VAULT ? vaultSeasonView : CURRENT_SEASON_ID;
  let spriteEditMode = false;
  let missingView = loadMissingView();
  let recentMissingChanges = loadRecentMissingChanges();
  let activeRarity = rarityFromHash() || defaultRarity;
  let toastTimer = 0;
  let appViewTransitionTimer = 0;
  let pendingRestore = null;
  let showcaseObjectUrl = '';
  let showcaseFile = null;
  let showcaseGenerationToken = 0;
  let journalEntries = [];
  let journalReady = false;
  let pendingJournalEntries = [];
  let journalWriteQueue = Promise.resolve();
  let journalInitialization = null;
  let pendingLocationDetails = null;
  let pendingCollectionCountReset = null;
  let huntMode = loadHuntMode();
  let huntTimerInterval = 0;
  let huntCart = loadStoredArray(HUNT_CART_KEY,normalizeHuntCart);
  let huntHistory = loadStoredArray(HUNT_HISTORY_KEY,normalizeHuntHistory);
  let dustLedger = loadStoredArray(DUST_LEDGER_KEY,normalizeDustLedger);

  const tabsEl = document.getElementById('rarityTabs');
  const collectionsEl = document.getElementById('collections');
  const pageTitleEl = document.getElementById('activePageTitle');
  const pageEyebrowEl = document.getElementById('pageEyebrow');
  const pageDescriptionEl = document.getElementById('pageDescription');
  const missingRecentChangesEl = document.getElementById('missingRecentChanges');
  const missingRecentListEl = document.getElementById('missingRecentList');
  const missingRecentDescriptionEl = document.getElementById('missingRecentDescription');
  const pageCountEl = document.getElementById('pageCount');
  const collectedTotalEl = document.getElementById('collectedTotal');
  const masteredTotalEl = document.getElementById('masteredTotal');
  const collectedBarEl = document.getElementById('collectedBar');
  const masteredBarEl = document.getElementById('masteredBar');
  const resetDialog = document.getElementById('resetDialog');
  const statusToast = document.getElementById('statusToast');
  const appMenuBtn = document.getElementById('appMenuBtn');
  const appMenuDialog = document.getElementById('appMenuDialog');
  const closeAppMenuBtn = document.getElementById('closeAppMenuBtn');
  const seasonVaultPage = document.getElementById('seasonVaultPage');
  const collectionJournalPage = document.getElementById('collectionJournalPage');
  const huntHistoryPage = document.getElementById('huntHistoryPage');
  const spriteDustPage = document.getElementById('spriteDustPage');
  const journalTopLocation = document.getElementById('journalTopLocation');
  const journalTopLocationCount = document.getElementById('journalTopLocationCount');
  const journalLocationsLogged = document.getElementById('journalLocationsLogged');
  const journalEntryCount = document.getElementById('journalEntryCount');
  const journalLocationEmpty = document.getElementById('journalLocationEmpty');
  const journalZoneTopCount = document.getElementById('journalZoneTopCount');
  const journalZoneBottomCount = document.getElementById('journalZoneBottomCount');
  const journalZoneBossCount = document.getElementById('journalZoneBossCount');
  const journalActionFilter = document.getElementById('journalActionFilter');
  const clearJournalActivityBtn = document.getElementById('clearJournalActivityBtn');
  const journalEntryList = document.getElementById('journalEntryList');
  const journalEmptyState = document.getElementById('journalEmptyState');
  const locationFoundDialog = document.getElementById('locationFoundDialog');
  const locationFoundForm = document.getElementById('locationFoundForm');
  const locationFoundTitle = document.getElementById('locationFoundTitle');
  const locationFoundSpriteName = document.getElementById('locationFoundSpriteName');
  const locationFoundSelect = document.getElementById('locationFoundSelect');
  const locationCollectedAt = document.getElementById('locationCollectedAt');
  const locationMasteredAt = document.getElementById('locationMasteredAt');
  const locationMasteredAtLabel = document.getElementById('locationMasteredAtLabel');
  const huntModeBtn = document.getElementById('huntModeBtn');
  const huntTimer = document.getElementById('huntTimer');
  const huntCartTray = document.getElementById('huntCartTray');
  const huntCartSummary = document.getElementById('huntCartSummary');
  const huntCheckoutBtn = document.getElementById('huntCheckoutBtn');
  const huntCheckoutDialog = document.getElementById('huntCheckoutDialog');
  const huntCheckoutForm = document.getElementById('huntCheckoutForm');
  const huntCheckoutTitle = document.getElementById('huntCheckoutTitle');
  const huntCheckoutDuration = document.getElementById('huntCheckoutDuration');
  const huntCheckoutItems = document.getElementById('huntCheckoutItems');
  const huntCheckoutDustTotal = document.getElementById('huntCheckoutDustTotal');
  const huntCheckoutWarning = document.getElementById('huntCheckoutWarning');
  const completeHuntOrderBtn = document.getElementById('completeHuntOrderBtn');
  const huntHistoryList = document.getElementById('huntHistoryList');
  const huntHistoryEmpty = document.getElementById('huntHistoryEmpty');
  const huntHistoryTotal = document.getElementById('huntHistoryTotal');
  const huntHistorySpriteTotal = document.getElementById('huntHistorySpriteTotal');
  const huntHistoryDustTotal = document.getElementById('huntHistoryDustTotal');
  const spriteDustBalanceBtn = document.getElementById('spriteDustBalanceBtn');
  const spriteDustBalance = document.getElementById('spriteDustBalance');
  const spriteDustAccountBalance = document.getElementById('spriteDustAccountBalance');
  const dustReceiptList = document.getElementById('dustReceiptList');
  const dustReceiptEmpty = document.getElementById('dustReceiptEmpty');
  const dustPurchaseDialog = document.getElementById('dustPurchaseDialog');
  const dustPurchaseForm = document.getElementById('dustPurchaseForm');
  const dustPurchaseTitle = document.getElementById('dustPurchaseTitle');
  const dustPurchaseAmount = document.getElementById('dustPurchaseAmount');
  const dustPurchaseNote = document.getElementById('dustPurchaseNote');
  const dustPurchaseStatus = document.getElementById('dustPurchaseStatus');
  const dustBalanceDialog = document.getElementById('dustBalanceDialog');
  const dustBalanceForm = document.getElementById('dustBalanceForm');
  const dustBalanceTitle = document.getElementById('dustBalanceTitle');
  const dustBalanceAmount = document.getElementById('dustBalanceAmount');
  const dustBalanceStatus = document.getElementById('dustBalanceStatus');
  const collectionCountResetDialog = document.getElementById('collectionCountResetDialog');
  const collectionCountResetForm = document.getElementById('collectionCountResetForm');
  const collectionCountResetTitle = document.getElementById('collectionCountResetTitle');
  const collectionCountResetMessage = document.getElementById('collectionCountResetMessage');
  const floatingHomeBtn = document.getElementById('floatingHomeBtn');
  const spriteSearchForm = document.getElementById('spriteSearchForm');
  const spriteSearchInput = document.getElementById('spriteSearchInput');
  const spriteSearchResults = document.getElementById('spriteSearchResults');
  const spriteSearchStatus = document.getElementById('spriteSearchStatus');
  const clearSpriteSearchBtn = document.getElementById('clearSpriteSearchBtn');
  const spriteEditorToggle = document.getElementById('spriteEditorToggle');
  const spriteViewToggle = document.getElementById('spriteViewToggle');
  const addSpriteDialog = document.getElementById('addSpriteDialog');
  const addSpriteForm = document.getElementById('addSpriteForm');
  const addSpriteFamilyId = document.getElementById('addSpriteFamilyId');
  const newSpriteName = document.getElementById('newSpriteName');
  const addSpriteGroupBtn = document.getElementById('addSpriteGroupBtn');
  const addSpriteGroupDialog = document.getElementById('addSpriteGroupDialog');
  const addSpriteGroupForm = document.getElementById('addSpriteGroupForm');
  const newSpriteGroupName = document.getElementById('newSpriteGroupName');
  const addSpriteGroupRarity = document.getElementById('addSpriteGroupRarity');
  const publishSpritesBtn = document.getElementById('publishSpritesBtn');
  const publishSpritesDialog = document.getElementById('publishSpritesDialog');
  const publishSpritesForm = document.getElementById('publishSpritesForm');
  const githubTokenInput = document.getElementById('githubTokenInput');
  const publishSpritesStatus = document.getElementById('publishSpritesStatus');
  const showcaseBtn = document.getElementById('showcaseBtn');
  const showcaseDialog = document.getElementById('showcaseDialog');
  const showcaseForm = document.getElementById('showcaseForm');
  const showcaseStatusSelect = document.getElementById('showcaseStatus');
  const showcaseRaritySelect = document.getElementById('showcaseRarity');
  const showcaseSeasonSelect = document.getElementById('showcaseSeason');
  const showcaseSortSelect = document.getElementById('showcaseSort');
  const showcaseMatchCount = document.getElementById('showcaseMatchCount');
  const showcaseStatusMessage = document.getElementById('showcaseStatusMessage');
  const showcasePreviewWrap = document.getElementById('showcasePreviewWrap');
  const showcasePreview = document.getElementById('showcasePreview');
  const generateShowcaseBtn = document.getElementById('generateShowcaseBtn');
  const shareShowcaseBtn = document.getElementById('shareShowcaseBtn');
  const backupBtn = document.getElementById('backupBtn');
  const backupDialog = document.getElementById('backupDialog');
  const backupFileInput = document.getElementById('backupFileInput');
  const backupRestoreStatus = document.getElementById('backupRestoreStatus');
  const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
  const undoRestoreBtn = document.getElementById('undoRestoreBtn');
  const seasonViewSelect = document.getElementById('seasonViewSelect');
  const seasonVaultTitle = document.getElementById('seasonVaultTitle');
  const seasonVaultMode = document.getElementById('seasonVaultMode');
  const seasonVaultCollected = document.getElementById('seasonVaultCollected');
  const seasonVaultMastered = document.getElementById('seasonVaultMastered');
  const seasonVaultCollectedBar = document.getElementById('seasonVaultCollectedBar');
  const seasonVaultMasteredBar = document.getElementById('seasonVaultMasteredBar');

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY,JSON.stringify(state));
      return true;
    } catch {
      showToast('Progress could not be saved in this browser.');
      return false;
    }
  }

  function saveHuntMode() {
    try { localStorage.setItem(HUNT_MODE_KEY,JSON.stringify(huntMode)); } catch { /* Hunt Mode can continue for this visit. */ }
  }

  function saveHuntCart() {
    try { localStorage.setItem(HUNT_CART_KEY,JSON.stringify(huntCart)); } catch { showToast('The Hunt cart could not be saved.'); }
  }

  function saveHuntHistory() {
    try { localStorage.setItem(HUNT_HISTORY_KEY,JSON.stringify(huntHistory)); } catch { showToast('Hunt History could not be saved.'); }
  }

  function saveDustLedger() {
    try { localStorage.setItem(DUST_LEDGER_KEY,JSON.stringify(dustLedger)); } catch { showToast('The Sprite Dust account could not be saved.'); }
  }

  function huntElapsedMs() {
    if (!huntMode.active || !huntMode.startedAt) return huntMode.lastDurationMs || 0;
    return Math.max(0,Date.now() - Date.parse(huntMode.startedAt));
  }

  function formatHuntDuration(milliseconds) {
    const totalSeconds = Math.max(0,Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const two = (value) => String(value).padStart(2,'0');
    return hours ? `${two(hours)}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
  }

  function updateHuntTimer() {
    const elapsed = huntElapsedMs();
    huntTimer.textContent = formatHuntDuration(elapsed);
    huntTimer.hidden = !huntMode.active && !huntMode.lastDurationMs;
  }

  function applyHuntMode() {
    window.clearInterval(huntTimerInterval);
    huntTimerInterval = 0;
    huntModeBtn.classList.toggle('is-active',huntMode.active);
    huntModeBtn.setAttribute('aria-pressed',String(huntMode.active));
    huntModeBtn.setAttribute('aria-label',huntMode.active ? 'End Hunt' : 'Start Hunt');
    huntModeBtn.title = huntMode.active ? 'End Hunt' : 'Start Hunt';
    document.body.classList.toggle('hunt-mode-active',huntMode.active);
    document.querySelectorAll('.card').forEach((card) => {
      const huntOnly = huntMode.active && appView !== APP_VIEW_VAULT;
      const vaultOnly = appView === APP_VIEW_VAULT;
      const imageButton = card.querySelector('.image-button');
      const collectButton = card.querySelector('.collect-button');
      const crownButton = card.querySelector('.crown-button');
      const collectionCountButton = card.querySelector('.collection-count-emblem');
      if (imageButton) {
        imageButton.disabled = huntOnly || vaultOnly;
        imageButton.tabIndex = huntOnly || vaultOnly ? -1 : 0;
      }
      if (collectButton) {
        collectButton.disabled = huntOnly;
        collectButton.tabIndex = huntOnly ? -1 : 0;
      }
      if (crownButton) {
        crownButton.disabled = huntOnly || vaultOnly;
        crownButton.tabIndex = huntOnly || vaultOnly ? -1 : 0;
      }
      if (collectionCountButton) {
        const canReset = !huntOnly && !vaultOnly && Number(collectionCountButton.textContent) > 0;
        collectionCountButton.disabled = !canReset;
        collectionCountButton.tabIndex = canReset ? 0 : -1;
      }
    });
    updateHuntTimer();
    renderHuntCartTray();
    if (huntMode.active) huntTimerInterval = window.setInterval(updateHuntTimer,1000);
  }

  function toggleHuntMode() {
    if (huntMode.active) {
      if (huntCart.length) openHuntCheckout();
      else finishEmptyHunt();
      return;
    }
    const resume = Boolean(huntCart.length && huntMode.lastDurationMs);
    if (spriteEditMode) {
      spriteEditMode = false;
      document.body.classList.remove('sprite-edit-mode');
      spriteEditorToggle.setAttribute('aria-pressed','false');
      spriteEditorToggle.textContent = 'Edit sprites';
      renderCollections();
    }
    const now = Date.now();
    huntMode = {
      active:true,
      startedAt:new Date(now - (resume ? huntMode.lastDurationMs : 0)).toISOString(),
      sessionStartedAt:resume ? (huntMode.sessionStartedAt || new Date(now - huntMode.lastDurationMs).toISOString()) : new Date(now).toISOString(),
      lastDurationMs:resume ? huntMode.lastDurationMs : 0
    };
    saveHuntMode();
    applyHuntMode();
    if (spriteSearchInput.value.trim()) renderSpriteSearchResults();
    showToast(resume ? 'Hunt resumed' : 'Hunt started · add Sprites to your cart');
  }

  function huntItemInfo(item) {
    const family = allFamilies().find((entry) => entry.id === item.familyId);
    const variant = family && orderedVariants(family).find((entry) => entry.id === item.variantId);
    if (!family || !variant) return null;
    return {
      family,
      variant,
      familyName:familyView(family).name || 'Sprite',
      variantName:variantView(family,variant).name || 'Variant',
      rarity:familyRarity(family),
      dust:spriteDustAtLevel(family,variant,item.level)
    };
  }

  function huntCartDustTotal() {
    return huntCart.reduce((total,item) => total + (huntItemInfo(item)?.dust || 0),0);
  }

  function renderHuntCartTray() {
    const count = huntCart.length;
    huntCartTray.hidden = !huntMode.active && !count;
    huntCartSummary.textContent = `${count} ${count === 1 ? 'Sprite' : 'Sprites'} · ${formatDust(huntCartDustTotal())} Dust`;
    huntCheckoutBtn.disabled = !count;
    huntCheckoutBtn.textContent = huntMode.active ? 'Checkout' : 'Review cart';
  }

  function addSpriteToHuntCart(family,variant) {
    if (!huntMode.active) return showToast('Start Hunt Mode before adding Sprites to the cart.');
    huntCart.push({
      id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,
      familyId:family.id,
      variantId:variant.id,
      level:1,
      addedAt:new Date().toISOString()
    });
    saveHuntCart();
    renderHuntCartTray();
    if (spriteSearchInput.value.trim()) {
      spriteSearchInput.value = '';
      clearSpriteSearchBtn.hidden = true;
      closeSpriteSearchResults();
      spriteSearchInput.focus({ preventScroll:true });
    }
    showToast(`${familyView(family).name} · ${variantView(family,variant).name} added to Hunt cart`);
  }

  function freezeHuntTimer() {
    if (huntMode.active) huntMode.lastDurationMs = huntElapsedMs();
    huntMode.active = false;
    huntMode.startedAt = '';
    saveHuntMode();
    applyHuntMode();
  }

  function resumeHuntFromCheckout() {
    if (huntCheckoutDialog.open) huntCheckoutDialog.close();
    if (huntMode.active) return;
    const elapsed = Math.max(0,huntMode.lastDurationMs || 0);
    huntMode.active = true;
    huntMode.startedAt = new Date(Date.now() - elapsed).toISOString();
    huntMode.sessionStartedAt ||= new Date(Date.now() - elapsed).toISOString();
    saveHuntMode();
    applyHuntMode();
    showToast('Hunt resumed');
  }

  function updateHuntCartLevel(itemId,level) {
    const item = huntCart.find((entry) => entry.id === itemId);
    if (!item) return;
    item.level = Math.max(1,Math.min(5,Math.round(Number(level) || 1)));
    saveHuntCart();
    renderHuntCheckout();
    renderHuntCartTray();
  }

  function removeHuntCartItem(itemId) {
    huntCart = huntCart.filter((item) => item.id !== itemId);
    saveHuntCart();
    renderHuntCheckout();
    renderHuntCartTray();
  }

  function renderHuntCheckout() {
    huntCheckoutItems.replaceChildren();
    let missingDust = false;
    huntCart.forEach((item) => {
      const info = huntItemInfo(item);
      if (!info) return;
      if (!info.dust) missingDust = true;
      const row = document.createElement('article');
      row.className = 'hunt-checkout-item';
      row.dataset.rarity = info.rarity;
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      const detail = document.createElement('span');
      name.textContent = `${info.familyName} · ${info.variantName}`;
      detail.textContent = info.rarity;
      copy.append(name,detail);
      const levelLabel = document.createElement('label');
      const levelCaption = document.createElement('span');
      const levelSelect = document.createElement('select');
      levelCaption.textContent = 'Level';
      [1,2,3,4,5].forEach((level) => {
        const option = document.createElement('option');
        option.value = String(level);
        option.textContent = String(level);
        option.selected = item.level === level;
        levelSelect.appendChild(option);
      });
      levelSelect.addEventListener('change',() => updateHuntCartLevel(item.id,levelSelect.value));
      levelLabel.append(levelCaption,levelSelect);
      const dust = document.createElement('strong');
      dust.className = 'hunt-checkout-item-dust';
      dust.textContent = `${formatDust(info.dust)} Dust`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'hunt-checkout-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label',`Remove ${info.familyName} ${info.variantName} from Hunt cart`);
      remove.addEventListener('click',() => removeHuntCartItem(item.id));
      row.append(copy,levelLabel,dust,remove);
      huntCheckoutItems.appendChild(row);
    });
    huntCheckoutDuration.textContent = `Hunt time: ${formatHuntDuration(huntMode.lastDurationMs || huntElapsedMs())}`;
    huntCheckoutDustTotal.textContent = formatDust(huntCartDustTotal());
    huntCheckoutWarning.hidden = !missingDust;
    completeHuntOrderBtn.disabled = !huntCart.length;
  }

  function openHuntCheckout() {
    if (!huntCart.length) return showToast('Your Hunt cart is empty.');
    freezeHuntTimer();
    renderHuntCheckout();
    document.documentElement.classList.add('hunt-checkout-open');
    document.body.classList.add('hunt-checkout-open');
    if (!huntCheckoutDialog.open) huntCheckoutDialog.showModal();
    requestAnimationFrame(() => {
      try { huntCheckoutTitle.focus({ preventScroll:true }); }
      catch { huntCheckoutTitle.focus(); }
    });
  }

  function huntHistoryEntry(items,dustEarned) {
    const completedAt = new Date().toISOString();
    return {
      id:`hunt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      startedAt:huntMode.sessionStartedAt || '',
      completedAt,
      durationMs:Math.max(0,huntMode.lastDurationMs || huntElapsedMs()),
      dustEarned:Math.max(0,Math.round(dustEarned || 0)),
      items
    };
  }

  function resetHuntSession() {
    huntCart = [];
    huntMode = { active:false, startedAt:'', sessionStartedAt:'', lastDurationMs:0 };
    saveHuntCart();
    saveHuntMode();
    applyHuntMode();
  }

  function finishEmptyHunt() {
    freezeHuntTimer();
    const hunt = huntHistoryEntry([],0);
    huntHistory.unshift(hunt);
    huntHistory = normalizeHuntHistory(huntHistory);
    saveHuntHistory();
    resetHuntSession();
    renderHuntHistory();
    showToast(`Hunt saved · ${formatHuntDuration(hunt.durationMs)}`);
  }

  function completeHuntOrder(event) {
    event.preventDefault();
    if (!huntCart.length) return;
    freezeHuntTimer();
    const completedAt = new Date().toISOString();
    const historyItems = [];
    huntCart.forEach((item) => {
      const info = huntItemInfo(item);
      if (!info) return;
      const current = variantState(item.familyId,item.variantId);
      const before = snapshotVariantState(current);
      current.collected = true;
      current.collectedAt ||= completedAt;
      current.collectionCount = Math.min(1000000,(Number(current.collectionCount) || 0) + 1);
      recordJournalEntry(before.collected ? 'recollected' : 'collected',info.family,info.variant,before,current,{ timestamp:completedAt });
      historyItems.push({
        familyId:item.familyId,
        variantId:item.variantId,
        familyName:info.familyName,
        variantName:info.variantName,
        rarity:info.rarity,
        level:item.level,
        dust:info.dust
      });
    });
    const dustEarned = historyItems.reduce((total,item) => total + item.dust,0);
    const hunt = huntHistoryEntry(historyItems,dustEarned);
    huntHistory.unshift(hunt);
    huntHistory = normalizeHuntHistory(huntHistory);
    if (dustEarned > 0) {
      dustLedger.unshift({
        id:`deposit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type:'deposit',
        amount:dustEarned,
        note:`Hunt deposit · ${historyItems.length} ${historyItems.length === 1 ? 'Sprite' : 'Sprites'}`,
        createdAt:completedAt,
        huntId:hunt.id
      });
      dustLedger = normalizeDustLedger(dustLedger);
    }
    saveProgress();
    saveHuntHistory();
    saveDustLedger();
    scheduleJournalSave();
    if (huntCheckoutDialog.open) huntCheckoutDialog.close();
    resetHuntSession();
    renderAll();
    goHomeToRare({ focusSearch:true, announce:false });
    showToast(`Order complete · ${historyItems.length} Sprites · ${formatDust(dustEarned)} Dust`);
  }

  function currentSpriteViewMode() {
    if (appView === APP_VIEW_VAULT) return 'card';
    return spriteViewModes[activeRarity] === 'list' ? 'list' : 'card';
  }

  function applySpriteViewMode() {
    const listView = currentSpriteViewMode() === 'list';
    document.body.classList.toggle('sprite-list-view',listView);
    spriteViewToggle.setAttribute('aria-pressed',String(listView));
    spriteViewToggle.textContent = listView ? 'Card view' : 'List view';
    spriteViewToggle.setAttribute('aria-label',`Use ${listView ? 'card' : 'list'} view on the ${activeRarity} page`);
  }

  function setSpriteViewMode(mode) {
    spriteViewModes[activeRarity] = mode === 'list' ? 'list' : 'card';
    try { localStorage.setItem(VIEW_MODES_KEY,JSON.stringify(spriteViewModes)); } catch { /* The choice can remain active for this visit. */ }
    applySpriteViewMode();
    renderCollections();
    updateCounters();
    showToast(`${activeRarity}: ${currentSpriteViewMode() === 'list' ? 'list' : 'card'} view`);
  }

  function lockPageForAppMenu() {
    document.documentElement.classList.add('app-menu-open');
    document.body.classList.add('app-menu-open');
  }

  function unlockPageForAppMenu() {
    if (!document.body.classList.contains('app-menu-open')) return;
    document.documentElement.classList.remove('app-menu-open');
    document.body.classList.remove('app-menu-open');
  }

  function openAppMenu() {
    if (appMenuDialog.open) return;
    lockPageForAppMenu();
    appMenuBtn.setAttribute('aria-expanded','true');
    appMenuDialog.showModal();
  }

  function closeAppMenu() {
    if (appMenuDialog.open) appMenuDialog.close();
  }

  function playAppViewTransition() {
    window.clearTimeout(appViewTransitionTimer);
    document.body.classList.remove('app-view-entering');
    void document.body.offsetWidth;
    document.body.classList.add('app-view-entering');
    appViewTransitionTimer = window.setTimeout(() => {
      document.body.classList.remove('app-view-entering');
    },320);
  }

  function applyAppView() {
    const vaultOpen = appView === APP_VIEW_VAULT;
    const journalOpen = appView === APP_VIEW_JOURNAL;
    const huntsOpen = appView === APP_VIEW_HUNTS;
    const dustOpen = appView === APP_VIEW_DUST;
    const featureOpen = journalOpen || huntsOpen || dustOpen;
    document.body.classList.toggle('vault-view',vaultOpen);
    document.body.classList.toggle('tracker-view',!vaultOpen && !featureOpen);
    document.body.classList.toggle('journal-view',journalOpen);
    document.body.classList.toggle('hunt-history-view',huntsOpen);
    document.body.classList.toggle('dust-account-view',dustOpen);
    document.querySelectorAll('.tracker-primary-view').forEach((element) => {
      element.hidden = vaultOpen || featureOpen;
    });
    seasonVaultPage.hidden = !SEASON_FEATURE_VISIBLE || !vaultOpen;
    collectionJournalPage.hidden = !journalOpen;
    huntHistoryPage.hidden = !huntsOpen;
    spriteDustPage.hidden = !dustOpen;
    tabsEl.hidden = featureOpen;
    document.getElementById('mainContent').hidden = featureOpen;
    document.querySelector('.app-shell > footer').hidden = featureOpen;
    document.querySelectorAll('[data-app-view]').forEach((button) => {
      const selected = button.dataset.appView === appView;
      button.classList.toggle('is-active',selected);
      if (selected) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }

  function setAppView(view,{ announce = true, season = null } = {}) {
    const next = view === APP_VIEW_VAULT && SEASON_FEATURE_VISIBLE
      ? APP_VIEW_VAULT
      : ([APP_VIEW_JOURNAL,APP_VIEW_HUNTS,APP_VIEW_DUST].includes(view) ? view : APP_VIEW_TRACKER);
    const changed = appView !== next;
    if (next === APP_VIEW_VAULT && season !== null) vaultSeasonView = sanitizeSeasonView(season);
    appView = next;
    seasonView = appView === APP_VIEW_VAULT ? vaultSeasonView : CURRENT_SEASON_ID;
    if (appView === APP_VIEW_VAULT && spriteEditMode) {
      spriteEditMode = false;
      document.body.classList.remove('sprite-edit-mode');
    }
    /* Render the destination while the menu still covers the page, then reveal it. */
    renderAll();
    const viewHash = appView === APP_VIEW_VAULT
      ? '#vault'
      : (appView === APP_VIEW_JOURNAL
          ? '#journal'
          : (appView === APP_VIEW_HUNTS
              ? '#hunts'
              : (appView === APP_VIEW_DUST
                  ? '#dust'
                  : (isUnownedPage() ? `#${missingView}` : `#${activeRarity.toLowerCase()}`))));
    if (location.hash !== viewHash) history.replaceState({ appView, rarity:activeRarity },'',viewHash);
    if (changed) window.scrollTo({ top:0, behavior:'auto' });
    closeAppMenu();
    if (changed) playAppViewTransition();
    if (announce && changed) {
      const label = appView === APP_VIEW_VAULT
        ? 'Sprite Vault'
        : (appView === APP_VIEW_JOURNAL
            ? 'Collection Journal'
            : (appView === APP_VIEW_HUNTS ? 'Hunt History' : (appView === APP_VIEW_DUST ? 'Sprite Dust' : 'Current Tracker')));
      showToast(label);
    }
  }

  function goHomeToRare({ focusSearch = false, announce = true } = {}) {
    if (appMenuDialog.open) closeAppMenu();
    if (huntCheckoutDialog.open) huntCheckoutDialog.close();
    if (dustPurchaseDialog.open) dustPurchaseDialog.close();
    appView = APP_VIEW_TRACKER;
    seasonView = CURRENT_SEASON_ID;
    activeRarity = defaultRarity;
    missingView = 'unowned';
    renderAll();
    if (location.hash !== '#rare') history.replaceState({ appView:APP_VIEW_TRACKER, rarity:defaultRarity },'','#rare');
    requestAnimationFrame(() => {
      window.scrollTo({ top:0, left:0, behavior:'auto' });
      if (focusSearch) {
        try { spriteSearchInput.focus({ preventScroll:true }); }
        catch { spriteSearchInput.focus(); }
      }
    });
    if (announce) showToast('Rare Current Tracker');
  }

  function applySeasonViewControls() {
    const syncOptions = (select,includeAll = true) => {
      const wanted = [
        ...seasonCatalog.map((season) => ({
          value:season.id,
          label:`${season.label}${season.id === CURRENT_SEASON_ID ? ' · Current' : ' · Archived'}`
        })),
        ...(includeAll ? [{ value:SEASON_VIEW_ALL, label:'All Seasons' }] : [])
      ];
      const current = [...select.options].map((option) => `${option.value}:${option.textContent}`).join('|');
      const next = wanted.map((option) => `${option.value}:${option.label}`).join('|');
      if (current !== next) {
        select.replaceChildren(...wanted.map((option) => {
          const element = document.createElement('option');
          element.value = option.value;
          element.textContent = option.label;
          return element;
        }));
      }
    };
    syncOptions(seasonViewSelect);
    syncOptions(showcaseSeasonSelect);
    seasonVaultPage.hidden = !SEASON_FEATURE_VISIBLE || appView !== APP_VIEW_VAULT;
    document.querySelector('.showcase-season-filter').hidden = !SEASON_FEATURE_VISIBLE;
    seasonViewSelect.value = seasonView;
    const isAllSeasons = seasonView === SEASON_VIEW_ALL;
    const isArchivedSeason = seasonView !== CURRENT_SEASON_ID && !isAllSeasons;
    const stats = overallStats(seasonView);
    const percentage = (value) => stats.total ? Math.round((value / stats.total) * 100) : 0;
    seasonVaultTitle.textContent = seasonViewLabel();
    seasonVaultMode.textContent = isAllSeasons ? 'Complete collection' : (isArchivedSeason ? 'Archived season' : 'Current season');
    seasonVaultCollected.textContent = `${stats.collected} / ${stats.total}`;
    seasonVaultMastered.textContent = `${stats.mastered} / ${stats.total}`;
    seasonVaultCollectedBar.style.width = `${percentage(stats.collected)}%`;
    seasonVaultMasteredBar.style.width = `${percentage(stats.mastered)}%`;
    document.body.classList.toggle('previous-season-view',isArchivedSeason);
    document.body.classList.toggle('all-seasons-view',isAllSeasons);
    document.body.dataset.seasonMode = isAllSeasons ? 'all' : (isArchivedSeason ? 'archived' : 'current');
    document.body.dataset.seasonView = seasonView;
  }

  function setSeasonView(mode,{ announce = true } = {}) {
    const next = sanitizeSeasonView(mode);
    const changed = seasonView !== next;
    seasonView = next;
    if (appView === APP_VIEW_VAULT) vaultSeasonView = next;
    try { localStorage.setItem(SEASON_VIEW_KEY,vaultSeasonView); } catch { /* The view can remain active for this visit. */ }
    renderAll();
    if (announce && changed) showToast(seasonViewLabel());
  }

  function saveSpriteCardEdits() {
    try {
      localStorage.setItem(SPRITE_CARD_EDITS_KEY,JSON.stringify(spriteCardEdits));
      updatePublishButton();
      return true;
    } catch {
      showToast('The sprite change could not be saved. Try a smaller image.');
      return false;
    }
  }

  function familyCardEdits(familyId) {
    spriteCardEdits.families ||= {};
    const existing = spriteCardEdits.families[familyId];
    const edits = existing && typeof existing === 'object' && !Array.isArray(existing)
      ? existing
      : (spriteCardEdits.families[familyId] = {});
    if (!Array.isArray(edits.added)) edits.added = [];
    if (!Array.isArray(edits.deleted)) edits.deleted = [];
    if (!Array.isArray(edits.order)) edits.order = [];
    if (!Array.isArray(edits.publishedAdded)) edits.publishedAdded = [];
    if (!edits.images || typeof edits.images !== 'object' || Array.isArray(edits.images)) edits.images = {};
    if (!edits.percentages || typeof edits.percentages !== 'object' || Array.isArray(edits.percentages)) edits.percentages = {};
    if (!edits.dustLevels || typeof edits.dustLevels !== 'object' || Array.isArray(edits.dustLevels)) edits.dustLevels = {};
    if (!edits.archived || typeof edits.archived !== 'object' || Array.isArray(edits.archived)) edits.archived = {};
    return edits;
  }

  function rarityFromHash() {
    const value = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    if (value === 'unmastered') return UNOWNED_PAGE;
    return pageTabs.find((page) => page.toLowerCase() === value) || null;
  }

  function isUnownedPage() {
    return activeRarity === UNOWNED_PAGE;
  }

  function activeThemeRarity() {
    return rarities.includes(activeRarity) ? activeRarity : defaultRarity;
  }

  function allFamilies() {
    const publishedCustom = Array.isArray(design.customFamilies) ? design.customFamilies : [];
    const localCustom = Array.isArray(spriteCardEdits.customFamilies) ? spriteCardEdits.customFamilies : [];
    const unique = new Map();
    [...baseData,...publishedCustom,...localCustom].forEach((family) => {
      if (family?.id && !unique.has(family.id)) unique.set(family.id,family);
    });
    return [...unique.values()];
  }

  function familyRarity(family) {
    return design.families[family.id]?.rarity || family.rarity;
  }

  function familyView(family) {
    const custom = design.families[family.id] || {};
    const cardEdits = spriteCardEdits.families?.[family.id] || {};
    const savedSeason = hasOwn(cardEdits,'seasonId') ? cardEdits.seasonId : (custom.seasonId || family.seasonId);
    const seasonId = SEASON_VIEWS.includes(savedSeason) && savedSeason !== SEASON_VIEW_ALL
      ? savedSeason
      : CURRENT_SEASON_ID;
    return {
      name:hasOwn(custom,'name') ? custom.name : family.name,
      visible:hasOwn(custom,'visible') ? Boolean(custom.visible) : true,
      deleted:Boolean(custom.deleted),
      seasonId,
      archived:seasonId !== CURRENT_SEASON_ID,
      customBg:Boolean(custom.customBg),
      bgColor:custom.bgColor || design.theme.collectionBgColor,
      bgImage:hasOwn(custom,'bgImage') ? custom.bgImage : '',
      bgMode:custom.bgMode || 'cover'
    };
  }

  function variantView(family,variant) {
    const custom = design.families[family.id]?.variants?.[variant.id] || {};
    const cardEdits = spriteCardEdits.families?.[family.id] || {};
    return {
      name:hasOwn(custom,'name') ? custom.name : variant.name,
      image:hasOwn(cardEdits.images,variant.id) ? cardEdits.images[variant.id] : (hasOwn(custom,'image') ? custom.image : variant.image),
      rarityPercentage:hasOwn(cardEdits.percentages,variant.id) ? cardEdits.percentages[variant.id] : String(custom.rarityPercentage || ''),
      dustLevels:normalizeDustLevels(hasOwn(cardEdits.dustLevels,variant.id) ? cardEdits.dustLevels[variant.id] : custom.dustLevels),
      visible:hasOwn(custom,'visible') ? Boolean(custom.visible) : true,
      deleted:Boolean(custom.deleted) || (Array.isArray(cardEdits.deleted) && cardEdits.deleted.includes(variant.id)),
      seasonId:SEASON_VIEWS.includes(cardEdits.seasons?.[variant.id])
        ? cardEdits.seasons[variant.id]
        : (SEASON_VIEWS.includes(custom.seasonId)
          ? custom.seasonId
          : (SEASON_VIEWS.includes(variant.seasonId) ? variant.seasonId : '')),
      archived:false,
      customCard:Boolean(custom.customCard),
      cardColor:custom.cardColor || design.theme.cardBgColor,
      cardImage:hasOwn(custom,'cardImage') ? custom.cardImage : '',
      cardMode:custom.cardMode || 'cover'
    };
  }

  function familyVariants(family) {
    const base = Array.isArray(family.variants) ? family.variants : [];
    const added = Array.isArray(design.families[family.id]?.addedVariants) ? design.families[family.id].addedVariants : [];
    const locallyAdded = Array.isArray(spriteCardEdits.families?.[family.id]?.added) ? spriteCardEdits.families[family.id].added : [];
    const unique = new Map();
    [...base,...added,...locallyAdded].forEach((variant) => {
      if (variant?.id && !unique.has(variant.id)) unique.set(variant.id,variant);
    });
    return [...unique.values()].filter((variant) => !variantView(family,variant).deleted);
  }

  function orderedVariants(family) {
    const variants = familyVariants(family);
    const byId = new Map(variants.map((variant) => [variant.id,variant]));
    const localOrder = spriteCardEdits.families?.[family.id]?.order;
    const saved = Array.isArray(localOrder) && localOrder.length
      ? localOrder
      : (Array.isArray(design.families[family.id]?.order) ? design.families[family.id].order : []);
    const order = [
      ...saved.filter((id,index) => byId.has(id) && saved.indexOf(id) === index),
      ...variants.map((variant) => variant.id).filter((id) => !saved.includes(id))
    ];
    return order.map((id) => byId.get(id)).filter(Boolean);
  }

  function visibleVariants(family) {
    return orderedVariants(family).filter((variant) => {
      const view = variantView(family,variant);
      return !view.deleted && view.visible;
    });
  }

  function isPreviousSeasonSprite(family,variant) {
    return spriteSeasonId(family,variant) !== CURRENT_SEASON_ID;
  }

  function spriteSeasonId(family,variant) {
    return variantView(family,variant).seasonId || familyView(family).seasonId || CURRENT_SEASON_ID;
  }

  function variantsForSeason(family,mode = seasonView) {
    return visibleVariants(family).filter((variant) => {
      if (mode === SEASON_VIEW_ALL) return true;
      return spriteSeasonId(family,variant) === mode;
    });
  }

  function familyMatchesSeason(family,mode = seasonView) {
    const group = familyView(family);
    if (group.deleted || !group.visible) return false;
    return variantsForSeason(family,mode).length > 0;
  }

  function vaultedSpriteCount() {
    return allFamilies().reduce((total,family) => {
      const group = familyView(family);
      if (group.deleted || !group.visible) return total;
      return total + visibleVariants(family).filter((variant) => isPreviousSeasonSprite(family,variant)).length;
    },0);
  }

  function seasonViewLabel(mode = seasonView) {
    if (mode === SEASON_VIEW_ALL) return 'All Seasons';
    return seasonCatalog.find((season) => season.id === mode)?.label || seasonCatalog[0].label;
  }

  function saveCardEditOrRestore(previousEdits) {
    if (saveSpriteCardEdits()) return true;
    spriteCardEdits = previousEdits;
    return false;
  }

  function uniqueVariantId(family,name) {
    const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'new-sprite';
    const reserved = new Set([
      ...(Array.isArray(family.variants) ? family.variants : []),
      ...(Array.isArray(design.families[family.id]?.addedVariants) ? design.families[family.id].addedVariants : []),
      ...(Array.isArray(spriteCardEdits.families?.[family.id]?.added) ? spriteCardEdits.families[family.id].added : [])
    ].map((variant) => variant?.id).filter(Boolean));
    let id = base;
    let suffix = 2;
    while (reserved.has(id)) id = `${base}-${suffix++}`;
    return id;
  }

  function uniqueFamilyId(name) {
    const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'new-group';
    const base = `custom-${slug}`;
    const reserved = new Set(allFamilies().map((family) => family.id));
    let id = base;
    let suffix = 2;
    while (reserved.has(id)) id = `${base}-${suffix++}`;
    return id;
  }

  function openAddSpriteGroupDialog() {
    newSpriteGroupName.value = '';
    addSpriteGroupRarity.textContent = activeRarity;
    addSpriteGroupDialog.showModal();
    setTimeout(() => newSpriteGroupName.focus(),0);
  }

  function addSpriteGroup(name) {
    const previousEdits = cloneJson(spriteCardEdits);
    const id = uniqueFamilyId(name);
    spriteCardEdits.customFamilies ||= [];
    spriteCardEdits.customFamilies.push({
      id,
      name,
      rarity:activeRarity,
      seasonId:CURRENT_SEASON_ID,
      variants:[{ id:'base', name:'Base', image:'' }]
    });
    familyCardEdits(id).order = ['base'];
    if (!saveCardEditOrRestore(previousEdits)) return null;
    return id;
  }

  function openAddSpriteDialog(familyId) {
    const family = allFamilies().find((item) => item.id === familyId);
    if (!family) return;
    addSpriteFamilyId.value = familyId;
    newSpriteName.value = '';
    document.getElementById('addSpriteDialogTitle').textContent = `Add sprite to ${familyView(family).name || 'this row'}`;
    addSpriteDialog.showModal();
    setTimeout(() => newSpriteName.focus(),0);
  }

  function addSpriteCard(family,name) {
    const previousEdits = cloneJson(spriteCardEdits);
    const edits = familyCardEdits(family.id);
    const id = uniqueVariantId(family,name);
    const currentOrder = orderedVariants(family).map((variant) => variant.id);
    edits.added.push({ id, name, image:'' });
    edits.order = [...currentOrder,id];
    if (!saveCardEditOrRestore(previousEdits)) return null;
    return id;
  }

  function saveVariantOrder(family,order,message = 'Sprite cards moved') {
    const previousEdits = cloneJson(spriteCardEdits);
    familyCardEdits(family.id).order = order;
    if (!saveCardEditOrRestore(previousEdits)) return false;
    renderCollections();
    updateCounters();
    showToast(message);
    return true;
  }

  function moveSpriteCard(family,variantId,offset) {
    const visible = variantsForSeason(family);
    const from = visible.findIndex((variant) => variant.id === variantId);
    const target = from + offset;
    if (from < 0 || target < 0 || target >= visible.length) return;
    const order = orderedVariants(family).map((variant) => variant.id);
    const fromIndex = order.indexOf(variantId);
    const targetIndex = order.indexOf(visible[target].id);
    [order[fromIndex],order[targetIndex]] = [order[targetIndex],order[fromIndex]];
    saveVariantOrder(family,order);
  }

  function reorderSpriteCard(family,sourceId,targetId,placeAfter) {
    const order = orderedVariants(family).map((variant) => variant.id);
    const from = order.indexOf(sourceId);
    if (from < 0 || sourceId === targetId || !order.includes(targetId)) return;
    order.splice(from,1);
    const target = order.indexOf(targetId);
    order.splice(target + (placeAfter ? 1 : 0),0,sourceId);
    saveVariantOrder(family,order);
  }

  function variantState(familyId,variantId) {
    state[familyId] ||= {};
    state[familyId][variantId] ||= { collected:false, mastered:false };
    const current = state[familyId][variantId];
    if (!Number.isFinite(Number(current.collectionCount)) || Number(current.collectionCount) < 0) {
      current.collectionCount = current.collected ? 1 : 0;
    } else {
      current.collectionCount = Math.min(1000000,Math.round(Number(current.collectionCount)));
    }
    return current;
  }

  function validIsoDate(value) {
    if (typeof value !== 'string' || !value || value.length > 40) return '';
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : '';
  }

  function cleanLocation(value) {
    return typeof value === 'string' ? value.trim().slice(0,80) : '';
  }

  const TOP_MAP_LOCATIONS = new Set([
    'Top of Map','Lifty Lodge','Latte Landing','Wonkee Land','Wonkeeland',
    'Battlewoods','The Battlewoods','Frosted Flats','Golden Grove','Shaken Sanctuary'
  ]);
  const BOTTOM_MAP_LOCATIONS = new Set([
    'Bottom of Map','Cluster Coast','Sunken Shores','Heatwave Harbor',
    'Sinister Strip','Calamari Canyon','Chopped Shop'
  ]);

  function locationZone(value) {
    const location = cleanLocation(value);
    if (location === 'Boss Fight') return 'Boss Fight';
    if (TOP_MAP_LOCATIONS.has(location)) return 'Top of Map';
    if (BOTTOM_MAP_LOCATIONS.has(location)) return 'Bottom of Map';
    return '';
  }

  function snapshotVariantState(current) {
    const mastered = current?.mastered === true;
    const rawCollectionCount = Number(current?.collectionCount);
    const collectionCount = Number.isFinite(rawCollectionCount) && rawCollectionCount >= 0
      ? Math.min(1000000,Math.round(rawCollectionCount))
      : (current?.collected ? 1 : 0);
    return {
      collected:current?.collected === true || mastered,
      mastered,
      collectedAt:validIsoDate(current?.collectedAt),
      masteredAt:validIsoDate(current?.masteredAt),
      locationFound:cleanLocation(current?.locationFound),
      collectionCount
    };
  }

  function applyVariantSnapshot(current,snapshot) {
    const clean = snapshotVariantState(snapshot);
    current.collected = clean.collected;
    current.mastered = clean.mastered;
    if (clean.collectedAt) current.collectedAt = clean.collectedAt;
    else delete current.collectedAt;
    if (clean.masteredAt) current.masteredAt = clean.masteredAt;
    else delete current.masteredAt;
    if (clean.locationFound) current.locationFound = clean.locationFound;
    else delete current.locationFound;
    current.collectionCount = clean.collectionCount;
    if (!current.collected) {
      current.mastered = false;
      delete current.collectedAt;
      delete current.masteredAt;
      delete current.locationFound;
    } else if (!current.mastered) {
      delete current.masteredAt;
    }
    return current;
  }

  function journalId() {
    const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    return `${Date.now()}-${random}`;
  }

  function openJournalDatabase() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
    return new Promise((resolve,reject) => {
      const request = indexedDB.open(JOURNAL_DB_NAME,1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(JOURNAL_DB_STORE)) {
          database.createObjectStore(JOURNAL_DB_STORE,{ keyPath:'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Journal database unavailable'));
    });
  }

  async function readJournalDatabase() {
    const database = await openJournalDatabase();
    try {
      return await new Promise((resolve,reject) => {
        const transaction = database.transaction(JOURNAL_DB_STORE,'readonly');
        const request = transaction.objectStore(JOURNAL_DB_STORE).getAll();
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error || new Error('Journal could not be read'));
      });
    } finally {
      database.close();
    }
  }

  async function writeJournalDatabase(entries) {
    const database = await openJournalDatabase();
    try {
      await new Promise((resolve,reject) => {
        const transaction = database.transaction(JOURNAL_DB_STORE,'readwrite');
        const store = transaction.objectStore(JOURNAL_DB_STORE);
        store.clear();
        entries.forEach((entry) => store.put(entry));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('Journal could not be saved'));
        transaction.onabort = () => reject(transaction.error || new Error('Journal save was interrupted'));
      });
    } finally {
      database.close();
    }
  }

  function readJournalFallback() {
    try {
      const value = JSON.parse(localStorage.getItem(JOURNAL_FALLBACK_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function journalEntryTimestamp(entry) {
    return Date.parse(entry?.timestamp || '') || 0;
  }

  function normalizeJournalEntries(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0,MAX_JOURNAL_ENTRIES).flatMap((entry) => {
      if (!entry || typeof entry !== 'object' || !safeBackupKey(entry.familyId) || !safeBackupKey(entry.variantId)) return [];
      const timestamp = validIsoDate(entry.timestamp);
      if (!timestamp) return [];
      const type = ['collected','recollected','uncollected','mastered','unmastered','details'].includes(entry.type) ? entry.type : '';
      if (!type) return [];
      return [{
        id:String(entry.id || journalId()).slice(0,160),
        timestamp,
        type,
        familyId:String(entry.familyId),
        variantId:String(entry.variantId),
        familyName:String(entry.familyName || 'Sprite').slice(0,80),
        variantName:String(entry.variantName || 'Variant').slice(0,80),
        rarity:rarities.includes(entry.rarity) ? entry.rarity : defaultRarity,
        seasonId:String(entry.seasonId || CURRENT_SEASON_ID).slice(0,80),
        before:snapshotVariantState(entry.before),
        after:snapshotVariantState(entry.after),
        undone:entry.undone === true,
        undoneAt:validIsoDate(entry.undoneAt)
      }];
    }).sort((a,b) => journalEntryTimestamp(b) - journalEntryTimestamp(a));
  }

  async function initializeJournal() {
    let stored = [];
    try {
      stored = await readJournalDatabase();
    } catch {
      stored = readJournalFallback();
    }
    const pending = pendingJournalEntries;
    pendingJournalEntries = [];
    journalEntries = normalizeJournalEntries([...pending,...stored]).slice(0,MAX_JOURNAL_ENTRIES);
    journalReady = true;
    if (pending.length) scheduleJournalSave();
    renderJournal();
  }

  function scheduleJournalSave() {
    journalWriteQueue = journalWriteQueue.catch(() => {}).then(async () => {
      if (!journalReady) return;
      const clean = normalizeJournalEntries(journalEntries).slice(0,MAX_JOURNAL_ENTRIES);
      journalEntries = clean;
      try {
        await writeJournalDatabase(clean);
        try { localStorage.removeItem(JOURNAL_FALLBACK_KEY); } catch { /* IndexedDB is the durable store. */ }
      } catch {
        try { localStorage.setItem(JOURNAL_FALLBACK_KEY,JSON.stringify(clean)); } catch { /* Keep the in-memory journal. */ }
      }
    });
    return journalWriteQueue;
  }

  function replaceJournalEntries(entries) {
    journalEntries = normalizeJournalEntries(entries).slice(0,MAX_JOURNAL_ENTRIES);
    journalReady = true;
    renderJournal();
    return scheduleJournalSave();
  }

  async function clearJournalActivity() {
    const storedEntries = journalReady ? journalEntries : pendingJournalEntries;
    if (!storedEntries.length) return;
    if (!window.confirm('Clear all Collection Journal activity? This will not change your collection, mastery, locations, Hunt History, or Sprite Dust.')) return;
    pendingJournalEntries = [];
    journalActionFilter.value = 'all';
    await replaceJournalEntries([]);
  }

  function recordJournalEntry(type,family,variant,before,current,{ timestamp = null } = {}) {
    const familyInfo = familyView(family);
    const variantInfo = variantView(family,variant);
    const entry = {
      id:journalId(),
      timestamp:validIsoDate(timestamp) || new Date().toISOString(),
      type,
      familyId:family.id,
      variantId:variant.id,
      familyName:familyInfo.name || family.name || 'Sprite',
      variantName:variantInfo.name || variant.name || 'Variant',
      rarity:familyRarity(family),
      seasonId:spriteSeasonId(family,variant),
      before:snapshotVariantState(before),
      after:snapshotVariantState(current),
      undone:false,
      undoneAt:''
    };
    if (journalReady) journalEntries.unshift(entry);
    else pendingJournalEntries.unshift(entry);
    if (journalReady) {
      journalEntries = normalizeJournalEntries(journalEntries).slice(0,MAX_JOURNAL_ENTRIES);
      scheduleJournalSave();
      renderJournal();
    }
    return entry;
  }

  function updateJournalEntry(entryId,current,{ timestamp = null } = {}) {
    const entry = [...pendingJournalEntries,...journalEntries].find((item) => item.id === entryId);
    if (!entry) return;
    entry.after = snapshotVariantState(current);
    if (timestamp) entry.timestamp = validIsoDate(timestamp) || entry.timestamp;
    if (journalReady) {
      scheduleJournalSave();
      renderJournal();
    }
  }

  function journalSprite(entry) {
    const family = allFamilies().find((item) => item.id === entry.familyId);
    const variant = family && orderedVariants(family).find((item) => item.id === entry.variantId);
    return { family,variant };
  }

  function variantSnapshotsMatch(left,right) {
    return JSON.stringify(snapshotVariantState(left)) === JSON.stringify(snapshotVariantState(right));
  }

  function journalActionText(type) {
    return ({
      collected:'Added to collection',
      recollected:'Collected again',
      uncollected:'Removed from collection',
      mastered:'Marked Mastered',
      unmastered:'Mastery removed',
      details:'Collection details updated'
    })[type] || 'Collection updated';
  }

  function journalFilterMatches(entry,filter) {
    if (filter === 'all') return true;
    if (filter === 'collected') return entry.type === 'collected' || entry.type === 'recollected';
    if (filter === 'mastered') return entry.type === 'mastered';
    if (filter === 'removed') return entry.type === 'uncollected' || entry.type === 'unmastered';
    return entry.type === filter;
  }

  function formatJournalDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat(undefined,{
      month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'
    }).format(date);
  }

  function journalCurrentLocationStats() {
    const counts = new Map();
    let logged = 0;
    Object.values(state || {}).forEach((variants) => {
      Object.values(variants || {}).forEach((current) => {
        const location = locationZone(current?.locationFound);
        if (!current?.collected || !location) return;
        logged += 1;
        counts.set(location,(counts.get(location) || 0) + 1);
      });
    });
    const ranked = [...counts.entries()].sort((left,right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    return { logged,ranked,counts };
  }

  function renderJournal() {
    if (!collectionJournalPage) return;
    const visibleEntries = (journalReady ? journalEntries : pendingJournalEntries)
      .filter((entry) => !entry.undone)
      .sort((a,b) => journalEntryTimestamp(b) - journalEntryTimestamp(a));
    const locationStats = journalCurrentLocationStats();
    const top = locationStats.ranked[0];
    journalTopLocation.textContent = top?.[0] || 'No locations yet';
    journalTopLocationCount.textContent = top
      ? `${top[1]} ${top[1] === 1 ? 'Sprite was' : 'Sprites were'} collected here.`
      : 'Add a location when you collect a Sprite.';
    journalLocationsLogged.textContent = String(locationStats.logged);
    journalEntryCount.textContent = String(visibleEntries.length);
    clearJournalActivityBtn.disabled = !journalReady || !(journalEntries.length || pendingJournalEntries.length);
    journalZoneTopCount.textContent = String(locationStats.counts.get('Top of Map') || 0);
    journalZoneBottomCount.textContent = String(locationStats.counts.get('Bottom of Map') || 0);
    journalZoneBossCount.textContent = String(locationStats.counts.get('Boss Fight') || 0);
    journalLocationEmpty.hidden = Boolean(locationStats.ranked.length);

    const filter = journalActionFilter?.value || 'all';
    const filtered = visibleEntries.filter((entry) => journalFilterMatches(entry,filter)).slice(0,150);
    journalEntryList.replaceChildren();
    journalEmptyState.hidden = Boolean(filtered.length);
    if (!journalReady && !filtered.length) {
      journalEmptyState.querySelector('strong').textContent = 'Opening your journal…';
      journalEmptyState.querySelector('span').textContent = 'Your saved activity will appear in a moment.';
    } else if (!visibleEntries.length) {
      journalEmptyState.querySelector('strong').textContent = 'Your journal is ready.';
      journalEmptyState.querySelector('span').textContent = 'Collect or master a Sprite and its time will appear here automatically.';
    } else if (!filtered.length) {
      journalEmptyState.querySelector('strong').textContent = 'No matching activity.';
      journalEmptyState.querySelector('span').textContent = 'Choose another filter to see more journal entries.';
    }

    filtered.forEach((entry) => {
      const { family,variant } = journalSprite(entry);
      const current = state[entry.familyId]?.[entry.variantId];
      const familyInfo = family ? familyView(family) : null;
      const variantInfo = family && variant ? variantView(family,variant) : null;
      const row = document.createElement('article');
      row.className = 'journal-entry';
      row.dataset.rarity = entry.rarity;
      const thumb = document.createElement('div');
      thumb.className = 'journal-entry-thumb';
      const imageSource = displayImageSource(variantInfo?.image);
      if (imageSource) {
        const image = document.createElement('img');
        image.src = imageSource;
        image.alt = '';
        image.loading = 'lazy';
        image.width = 72;
        image.height = 72;
        thumb.appendChild(image);
      } else {
        thumb.textContent = (entry.familyName || 'S').slice(0,1).toUpperCase();
      }
      const copy = document.createElement('div');
      copy.className = 'journal-entry-copy';
      const name = document.createElement('h4');
      name.textContent = `${familyInfo?.name || entry.familyName} · ${variantInfo?.name || entry.variantName}`;
      const action = document.createElement('strong');
      action.textContent = journalActionText(entry.type);
      const time = document.createElement('time');
      time.dateTime = entry.timestamp;
      time.textContent = formatJournalDate(entry.timestamp);
      copy.append(name,action,time);
      const location = locationZone(entry.after?.locationFound) || cleanLocation(entry.after?.locationFound);
      if (location) {
        const place = document.createElement('span');
        place.className = 'journal-entry-location';
        place.textContent = `Found at ${location}`;
        copy.appendChild(place);
      }
      const actions = document.createElement('div');
      actions.className = 'journal-entry-actions';
      if (current?.collected && family && variant) {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = current.locationFound ? 'Edit details' : 'Add location';
        edit.addEventListener('click',() => openLocationDetails(family,variant));
        actions.appendChild(edit);
      }
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'journal-undo-button';
      const canUndo = Boolean(current) && variantSnapshotsMatch(current,entry.after);
      undo.textContent = canUndo ? 'Undo' : 'Changed later';
      undo.disabled = !canUndo;
      undo.setAttribute('aria-label',canUndo ? `Undo ${journalActionText(entry.type)} for ${entry.familyName} ${entry.variantName}` : 'This entry cannot be undone because the Sprite changed again later');
      undo.addEventListener('click',() => undoJournalEntry(entry.id));
      actions.appendChild(undo);
      row.append(thumb,copy,actions);
      journalEntryList.appendChild(row);
    });
  }

  function dustBalanceValue() {
    return dustLedger.reduce((balance,receipt) => {
      const direction = receipt.type === 'purchase' || receipt.type === 'adjustment-out' ? -1 : 1;
      return balance + (direction * receipt.amount);
    },0);
  }

  function renderHuntHistory() {
    if (!huntHistoryPage) return;
    huntHistory = normalizeHuntHistory(huntHistory);
    const spriteTotal = huntHistory.reduce((total,hunt) => total + hunt.items.length,0);
    const dustTotal = huntHistory.reduce((total,hunt) => total + hunt.dustEarned,0);
    huntHistoryTotal.textContent = String(huntHistory.length);
    huntHistorySpriteTotal.textContent = String(spriteTotal);
    huntHistoryDustTotal.textContent = formatDust(dustTotal);
    huntHistoryList.replaceChildren();
    huntHistoryEmpty.hidden = Boolean(huntHistory.length);
    document.getElementById('clearHuntHistoryBtn').disabled = !huntHistory.length;

    huntHistory.forEach((hunt,index) => {
      const card = document.createElement('article');
      card.className = 'hunt-history-card';
      const header = document.createElement('header');
      const copy = document.createElement('div');
      const title = document.createElement('h3');
      const time = document.createElement('time');
      const remove = document.createElement('button');
      title.textContent = `Hunt ${huntHistory.length - index}`;
      time.dateTime = hunt.completedAt;
      time.textContent = formatJournalDate(hunt.completedAt);
      copy.append(title,time);
      remove.type = 'button';
      remove.className = 'hunt-history-delete';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label',`Delete Hunt from ${time.textContent}`);
      remove.addEventListener('click',() => {
        if (!window.confirm('Delete this Hunt from Hunt History? Its Sprite Dust receipt will stay in the account.')) return;
        huntHistory = huntHistory.filter((entry) => entry.id !== hunt.id);
        saveHuntHistory();
        renderHuntHistory();
        showToast('Hunt deleted');
      });
      header.append(copy,remove);

      const metrics = document.createElement('div');
      metrics.className = 'hunt-history-metrics';
      const duration = document.createElement('strong');
      const sprites = document.createElement('strong');
      const dust = document.createElement('strong');
      duration.innerHTML = `<span>Time</span>${formatHuntDuration(hunt.durationMs)}`;
      sprites.innerHTML = `<span>Sprites</span>${hunt.items.length}`;
      dust.innerHTML = `<span>Dust</span>${formatDust(hunt.dustEarned)}`;
      metrics.append(duration,sprites,dust);

      const items = document.createElement('div');
      items.className = 'hunt-history-items';
      if (!hunt.items.length) {
        const empty = document.createElement('span');
        empty.textContent = 'Timer-only Hunt · no Sprites checked out';
        items.appendChild(empty);
      } else {
        hunt.items.forEach((item) => {
          const row = document.createElement('span');
          row.dataset.rarity = item.rarity;
          row.textContent = `${item.familyName} · ${item.variantName} · L${item.level} · ${formatDust(item.dust)} Dust`;
          items.appendChild(row);
        });
      }
      card.append(header,metrics,items);
      huntHistoryList.appendChild(card);
    });
  }

  function renderDustAccount() {
    if (!spriteDustPage) return;
    dustLedger = normalizeDustLedger(dustLedger);
    const balance = Math.max(0,dustBalanceValue());
    spriteDustBalance.textContent = formatDust(balance);
    spriteDustAccountBalance.textContent = formatDust(balance);
    dustReceiptList.replaceChildren();
    dustReceiptEmpty.hidden = Boolean(dustLedger.length);
    document.getElementById('recordDustPurchaseBtn').disabled = balance < 1;

    dustLedger.forEach((receipt) => {
      const row = document.createElement('article');
      const debit = receipt.type === 'purchase' || receipt.type === 'adjustment-out';
      const adjustment = receipt.type === 'adjustment-in' || receipt.type === 'adjustment-out';
      row.className = `dust-receipt dust-receipt-${debit ? 'purchase' : 'deposit'}${adjustment ? ' dust-receipt-adjustment' : ''}`;
      const icon = document.createElement('span');
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      const time = document.createElement('time');
      const amount = document.createElement('strong');
      icon.className = 'dust-receipt-icon';
      icon.textContent = adjustment ? '↕' : (receipt.type === 'deposit' ? '↓' : '↑');
      title.textContent = receipt.note;
      time.dateTime = receipt.createdAt;
      time.textContent = formatJournalDate(receipt.createdAt);
      copy.append(title,time);
      amount.className = 'dust-receipt-amount';
      amount.textContent = `${debit ? '−' : '+'}${formatDust(receipt.amount)}`;
      row.append(icon,copy,amount);
      dustReceiptList.appendChild(row);
    });
  }

  function openDustPurchaseDialog() {
    const balance = Math.max(0,dustBalanceValue());
    if (!balance) return showToast('There is no Sprite Dust available to spend.');
    dustPurchaseForm.reset();
    dustPurchaseAmount.max = String(balance);
    dustPurchaseStatus.textContent = `Available: ${formatDust(balance)} Dust`;
    dustPurchaseStatus.dataset.state = '';
    document.documentElement.classList.add('dust-purchase-open');
    document.body.classList.add('dust-purchase-open');
    if (!dustPurchaseDialog.open) dustPurchaseDialog.showModal();
    requestAnimationFrame(() => {
      try { dustPurchaseTitle.focus({ preventScroll:true }); }
      catch { dustPurchaseTitle.focus(); }
    });
  }

  function openDustBalanceDialog() {
    const balance = Math.max(0,dustBalanceValue());
    dustBalanceForm.reset();
    dustBalanceAmount.value = String(balance);
    dustBalanceStatus.textContent = '';
    dustBalanceStatus.dataset.state = '';
    document.documentElement.classList.add('dust-balance-open');
    document.body.classList.add('dust-balance-open');
    if (!dustBalanceDialog.open) dustBalanceDialog.showModal();
    requestAnimationFrame(() => {
      try { dustBalanceTitle.focus({ preventScroll:true }); }
      catch { dustBalanceTitle.focus(); }
    });
  }

  function saveDustBalance(event) {
    event.preventDefault();
    const requestedBalance = Math.round(Number(dustBalanceAmount.value));
    const currentBalance = Math.max(0,dustBalanceValue());
    if (!Number.isFinite(requestedBalance) || requestedBalance < 0 || requestedBalance > 100000000) {
      dustBalanceStatus.dataset.state = 'error';
      dustBalanceStatus.textContent = 'Enter a whole Sprite Dust balance from 0 to 100,000,000.';
      return;
    }
    const difference = requestedBalance - currentBalance;
    if (difference) {
      dustLedger.unshift({
        id:`adjustment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type:difference > 0 ? 'adjustment-in' : 'adjustment-out',
        amount:Math.abs(difference),
        note:'Manual balance adjustment',
        createdAt:new Date().toISOString(),
        huntId:''
      });
      dustLedger = normalizeDustLedger(dustLedger);
      saveDustLedger();
    }
    dustBalanceDialog.close();
    renderDustAccount();
  }

  function recordDustPurchase(event) {
    event.preventDefault();
    const amount = Math.round(Number(dustPurchaseAmount.value));
    const note = dustPurchaseNote.value.trim();
    const balance = Math.max(0,dustBalanceValue());
    if (!Number.isFinite(amount) || amount < 1) {
      dustPurchaseStatus.dataset.state = 'error';
      dustPurchaseStatus.textContent = 'Enter a whole Sprite Dust amount greater than 0.';
      return;
    }
    if (amount > balance) {
      dustPurchaseStatus.dataset.state = 'error';
      dustPurchaseStatus.textContent = `That is more than the available ${formatDust(balance)} Dust.`;
      return;
    }
    if (!note) return;
    dustLedger.unshift({
      id:`purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type:'purchase',
      amount,
      note,
      createdAt:new Date().toISOString(),
      huntId:''
    });
    dustLedger = normalizeDustLedger(dustLedger);
    saveDustLedger();
    dustPurchaseDialog.close();
    renderDustAccount();
    showToast(`${formatDust(amount)} Sprite Dust purchase recorded`);
  }

  function undoJournalEntry(entryId) {
    const entry = journalEntries.find((item) => item.id === entryId && !item.undone);
    if (!entry) return;
    const { family,variant } = journalSprite(entry);
    const current = state[entry.familyId]?.[entry.variantId];
    if (!current || !variantSnapshotsMatch(current,entry.after)) {
      showToast('This Sprite changed again later, so that entry cannot be undone safely.');
      return;
    }
    applyVariantSnapshot(current,entry.before);
    entry.undone = true;
    entry.undoneAt = new Date().toISOString();
    saveProgress();
    scheduleJournalSave();
    renderAll();
    showToast(`${family && variant ? variantView(family,variant).name : entry.variantName}: change undone`);
  }

  function isoToLocalDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,16);
  }

  function localDateTimeToIso(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : '';
  }

  function openLocationDetails(family,variant,journalEntryId = '',{ newlyCollected = false } = {}) {
    const current = variantState(family.id,variant.id);
    if (!current.collected) return;
    pendingLocationDetails = {
      familyId:family.id,
      variantId:variant.id,
      journalEntryId,
      newlyCollected,
      before:snapshotVariantState(current)
    };
    const name = `${familyView(family).name || 'Sprite'} · ${variantView(family,variant).name || 'Variant'}`;
    locationFoundTitle.textContent = newlyCollected ? 'Where did you find it?' : 'Edit collection details';
    locationFoundSpriteName.textContent = name;
    locationFoundSelect.value = locationZone(current.locationFound) || '';
    locationCollectedAt.value = isoToLocalDateTime(current.collectedAt || new Date().toISOString());
    locationMasteredAt.value = isoToLocalDateTime(current.masteredAt || '');
    locationMasteredAtLabel.hidden = !current.mastered;
    document.documentElement.classList.add('journal-dialog-open');
    document.body.classList.add('journal-dialog-open');
    if (!locationFoundDialog.open) locationFoundDialog.showModal();
    requestAnimationFrame(() => {
      try { locationFoundTitle.focus({ preventScroll:true }); }
      catch { locationFoundTitle.focus(); }
    });
  }

  function closeLocationDetails() {
    pendingLocationDetails = null;
    if (locationFoundDialog.open) locationFoundDialog.close();
  }

  function saveLocationDetails(event) {
    event.preventDefault();
    if (!pendingLocationDetails) return closeLocationDetails();
    const { familyId,variantId,journalEntryId,newlyCollected,before } = pendingLocationDetails;
    const family = allFamilies().find((item) => item.id === familyId);
    const variant = family && orderedVariants(family).find((item) => item.id === variantId);
    if (!family || !variant) return closeLocationDetails();
    const current = variantState(familyId,variantId);
    const collectedAt = localDateTimeToIso(locationCollectedAt.value) || current.collectedAt || new Date().toISOString();
    const masteredAt = current.mastered ? (localDateTimeToIso(locationMasteredAt.value) || current.masteredAt || collectedAt) : '';
    current.collectedAt = collectedAt;
    if (current.mastered) current.masteredAt = masteredAt;
    else delete current.masteredAt;
    const location = cleanLocation(locationFoundSelect.value);
    if (location) current.locationFound = location;
    else delete current.locationFound;
    if (journalEntryId && newlyCollected) {
      updateJournalEntry(journalEntryId,current,{ timestamp:collectedAt });
    } else if (!variantSnapshotsMatch(before,current)) {
      recordJournalEntry('details',family,variant,before,current,{ timestamp:new Date().toISOString() });
    }
    saveProgress();
    closeLocationDetails();
    renderJournal();
    showToast(location ? `Location saved: ${location}` : 'Collection time saved');
  }

  function imageMode(mode) {
    if (mode === 'contain') return { size:'contain', repeat:'no-repeat' };
    if (mode === 'tile') return { size:'600px 600px', repeat:'repeat' };
    if (mode === 'repeat') return { size:'auto', repeat:'repeat' };
    if (mode === 'stretch') return { size:'100% 100%', repeat:'no-repeat' };
    return { size:'cover', repeat:'no-repeat' };
  }

  function imagePosition(position) {
    if (position === 'upper') return 'center 20%';
    if (position === 'top') return 'center top';
    if (position === 'bottom') return 'center bottom';
    return 'center';
  }

  function displayImageSource(source) {
    const value = String(source || '');
    const version = Number(design._meta?.publishedAt || 0);
    if (!value || !version || !/^(?:\.\/)?published-assets\//.test(value)) return value;
    return `${value}${value.includes('?') ? '&' : '?'}v=${version}`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function isImageFile(file) {
    return Boolean(file && (file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name || '')));
  }

  function droppedImageFile(dataTransfer) {
    if (!dataTransfer) return null;
    return [...dataTransfer.files].find(isImageFile)
      || [...dataTransfer.items].map((item) => item.kind === 'file' ? item.getAsFile() : null).find(isImageFile)
      || null;
  }

  function hasDroppedImage(dataTransfer) {
    if (!dataTransfer) return false;
    return [...dataTransfer.files].some(isImageFile)
      || [...dataTransfer.items].some((item) => item.kind === 'file' && (!item.type || item.type.startsWith('image/')))
      || [...dataTransfer.types].includes('Files');
  }

  async function resizeSpriteImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise((resolve,reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('invalid-image');
      const maxWidth = 768;
      const maxHeight = 768;
      const targetBytes = 180000;
      const sourceType = String(file.type || '').toLowerCase();
      if (['image/png','image/jpeg','image/webp','image/avif'].includes(sourceType)
        && image.naturalWidth <= maxWidth
        && image.naturalHeight <= maxHeight
        && file.size <= targetBytes) return readFileAsDataUrl(file);

      let scale = Math.min(1,maxWidth / image.naturalWidth,maxHeight / image.naturalHeight);
      let quality = .9;
      let bestResult = '';
      let bestBytes = Infinity;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas-unavailable');
      for (let attempt = 0; attempt < 18; attempt += 1) {
        canvas.width = Math.max(1,Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1,Math.round(image.naturalHeight * scale));
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.clearRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        const result = canvas.toDataURL('image/webp',quality);
        const encodedLength = Math.max(0,result.length - result.indexOf(',') - 1);
        const estimatedBytes = Math.ceil(encodedLength * .75);
        if (estimatedBytes < bestBytes) {
          bestResult = result;
          bestBytes = estimatedBytes;
        }
        if (estimatedBytes <= targetBytes) return result;
        if (quality > .72) quality = Math.max(.72,quality - .05);
        else {
          const shrink = Math.max(.7,Math.min(.9,Math.sqrt(targetBytes / estimatedBytes) * .96));
          scale *= shrink;
          quality = .9;
        }
      }
      if (!bestResult) throw new Error('image-conversion-failed');
      return bestResult;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function replaceSpriteImage(family,variant,file) {
    if (!isImageFile(file)) throw new Error('not-an-image');
    showToast('Preparing sprite image…');
    const image = await resizeSpriteImage(file);
    const previousEdits = cloneJson(spriteCardEdits);
    familyCardEdits(family.id).images[variant.id] = image;
    if (!saveCardEditOrRestore(previousEdits)) return false;
    renderCollections();
    updateCounters();
    showToast('Sprite image saved');
    return true;
  }

  function normalizeRarityPercentage(value) {
    const raw = String(value || '').trim().replace(/%$/,'').trim();
    if (!raw) return '';
    if (!/^\d{1,3}(?:\.\d{1,6})?$/.test(raw)) return null;
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0 || number > 100) return null;
    const [whole,fraction = ''] = raw.split('.');
    const normalizedFraction = fraction.replace(/0+$/,'');
    return `${Number(whole)}${normalizedFraction ? `.${normalizedFraction}` : ''}%`;
  }

  function saveRarityPercentage(family,variant,value) {
    const percentage = normalizeRarityPercentage(value);
    if (percentage === null) {
      showToast('Enter a percentage from 0 to 100, such as 0.07.');
      return false;
    }
    const previousEdits = cloneJson(spriteCardEdits);
    familyCardEdits(family.id).percentages[variant.id] = percentage;
    if (!saveCardEditOrRestore(previousEdits)) return false;
    renderCollections();
    updateCounters();
    showToast(percentage ? `${variantView(family,variant).name}: ${percentage}` : 'Rarity percentage removed');
    return true;
  }

  function normalizeDustLevels(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.fromEntries([1,2,3,4,5].flatMap((level) => {
      const amount = Number(source[level] ?? source[String(level)]);
      if (!Number.isFinite(amount) || amount < 0) return [];
      return [[String(level),Math.min(1000000,Math.round(amount))]];
    }));
  }

  function saveSpriteDustLevels(family,variant,fields) {
    const levels = {};
    let invalid = false;
    [1,2,3,4,5].forEach((level) => {
      const raw = String(fields[level]?.value || '').trim();
      if (!raw) return;
      if (!/^\d{1,7}$/.test(raw) || Number(raw) > 1000000) invalid = true;
      else levels[String(level)] = Math.round(Number(raw));
    });
    if (invalid) {
      showToast('Enter whole Sprite Dust amounts from 0 to 1,000,000.');
      return false;
    }
    const previousEdits = cloneJson(spriteCardEdits);
    familyCardEdits(family.id).dustLevels[variant.id] = levels;
    if (!saveCardEditOrRestore(previousEdits)) return false;
    renderCollections();
    updateCounters();
    showToast(Object.keys(levels).length ? `${variantView(family,variant).name}: Dust values saved` : 'Sprite Dust values removed');
    return true;
  }

  function spriteDustAtLevel(family,variant,level = 1) {
    return Number(variantView(family,variant).dustLevels[String(Math.max(1,Math.min(5,Number(level) || 1)))]) || 0;
  }

  function formatDust(value) {
    return Math.max(0,Math.round(Number(value) || 0)).toLocaleString();
  }

  function spriteCardEditsFingerprint() {
    return JSON.stringify({
      families:spriteCardEdits.families || {},
      customFamilies:Array.isArray(spriteCardEdits.customFamilies) ? spriteCardEdits.customFamilies : []
    });
  }

  function hasUnpublishedSpriteChanges() {
    const families = spriteCardEdits.families || {};
    const hasFamilyChanges = Object.values(families).some((edits) => edits && typeof edits === 'object' && (
      (Array.isArray(edits.added) && edits.added.length)
      || (Array.isArray(edits.deleted) && edits.deleted.length)
      || (Array.isArray(edits.order) && edits.order.length)
      || (edits.images && typeof edits.images === 'object' && Object.keys(edits.images).length)
      || (edits.percentages && typeof edits.percentages === 'object' && Object.keys(edits.percentages).length)
      || (edits.dustLevels && typeof edits.dustLevels === 'object' && Object.keys(edits.dustLevels).length)
      || (edits.archived && typeof edits.archived === 'object' && Object.keys(edits.archived).length)
      || hasOwn(edits,'archivedGroup')
    ));
    const hasNewGroups = Array.isArray(spriteCardEdits.customFamilies) && spriteCardEdits.customFamilies.length > 0;
    const hasChanges = hasFamilyChanges || hasNewGroups;
    return Boolean(hasChanges && spriteCardEdits.lastPublishedSnapshot !== spriteCardEditsFingerprint());
  }

  function updatePublishButton() {
    if (!publishSpritesBtn) return;
    const pending = hasUnpublishedSpriteChanges();
    publishSpritesBtn.disabled = !pending;
    publishSpritesBtn.textContent = pending ? 'Publish sprite changes' : 'No changes to publish';
  }

  function setPublishStatus(message,state = '') {
    publishSpritesStatus.textContent = message;
    publishSpritesStatus.dataset.state = state;
  }

  function setPublishBusy(busy) {
    const submit = document.getElementById('confirmPublishSpritesBtn');
    const cancel = document.getElementById('cancelPublishSpritesBtn');
    githubTokenInput.disabled = busy;
    submit.disabled = busy;
    cancel.disabled = busy;
    submit.textContent = busy ? 'Publishing…' : 'Publish changes';
  }

  async function githubRequest(token,path,options = {}) {
    const response = await fetch(`https://api.github.com${path}`,{
      method:options.method || 'GET',
      headers:{
        Accept:'application/vnd.github+json',
        Authorization:`Bearer ${token}`,
        'X-GitHub-Api-Version':GITHUB_API_VERSION,
        ...(options.body ? { 'Content-Type':'application/json' } : {})
      },
      body:options.body ? JSON.stringify(options.body) : undefined,
      cache:'no-store'
    });
    const text = await response.text();
    let result = null;
    try { result = text ? JSON.parse(text) : null; } catch { result = null; }
    if (!response.ok) {
      const error = new Error(result?.message || `GitHub returned ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function decodeBase64Utf8(value) {
    const binary = atob(String(value || '').replace(/\s/g,''));
    const bytes = Uint8Array.from(binary,(character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function parsePublishedDesignFile(source) {
    const text = String(source || '').replace(/^\uFEFF/,'');
    const equals = text.indexOf('=');
    const semicolon = text.lastIndexOf(';');
    if (!/window\.PUBLISHED_DESIGN\s*=/.test(text) || equals < 0 || semicolon <= equals) throw new Error('The published design file could not be read.');
    const parsed = JSON.parse(text.slice(equals + 1,semicolon).trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The published design file is invalid.');
    return parsed;
  }

  function cleanAssetPart(value,fallback) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || fallback;
  }

  function publishedImageAsset(familyId,variantId,dataUrl) {
    const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpe?g|webp|avif|gif));base64,([a-z0-9+/=\s]+)$/i);
    if (!match) throw new Error('One sprite image could not be prepared for publishing.');
    const mime = match[1].toLowerCase();
    const extension = mime === 'image/jpeg' || mime === 'image/jpg' ? 'jpg' : mime.split('/')[1];
    return {
      path:`published-assets/sprite-${cleanAssetPart(familyId,'group')}-${cleanAssetPart(variantId,'sprite')}.${extension}`,
      content:match[2].replace(/\s/g,'')
    };
  }

  function buildPublishedSpriteDesign(basePublishedDesign) {
    const nextDesign = cloneJson(basePublishedDesign);
    nextDesign.seasons = cloneJson(seasonCatalog);
    nextDesign.currentSeasonId = CURRENT_SEASON_ID;
    nextDesign.families ||= {};
    nextDesign.customFamilies = Array.isArray(nextDesign.customFamilies) ? nextDesign.customFamilies : [];
    const assets = [];

    (Array.isArray(spriteCardEdits.customFamilies) ? spriteCardEdits.customFamilies : []).forEach((localFamily) => {
      if (!localFamily?.id) return;
      const publishedFamily = nextDesign.customFamilies.find((family) => family.id === localFamily.id);
      const familyRecord = {
        id:localFamily.id,
        name:localFamily.name || 'New sprite group',
        rarity:rarities.includes(localFamily.rarity) ? localFamily.rarity : defaultRarity,
        seasonId:SEASON_VIEWS.includes(localFamily.seasonId) ? localFamily.seasonId : CURRENT_SEASON_ID,
        variants:Array.isArray(localFamily.variants) && localFamily.variants.length
          ? cloneJson(localFamily.variants)
          : [{ id:'base', name:'Base', image:'' }]
      };
      if (publishedFamily) Object.assign(publishedFamily,familyRecord);
      else nextDesign.customFamilies.push(familyRecord);
      const familyDesign = nextDesign.families[localFamily.id] ||= {};
      familyDesign.name = familyRecord.name;
      familyDesign.rarity = familyRecord.rarity;
      familyDesign.seasonId = familyRecord.seasonId;
      familyDesign.visible = true;
      familyDesign.deleted = false;
      familyDesign.variants ||= {};
      familyRecord.variants.forEach((variant) => {
        if (!variant?.id) return;
        familyDesign.variants[variant.id] ||= {};
        familyDesign.variants[variant.id].deleted = false;
      });
    });

    Object.entries(spriteCardEdits.families || {}).forEach(([familyId,rawEdits]) => {
      if (!rawEdits || typeof rawEdits !== 'object' || Array.isArray(rawEdits)) return;
      const edits = rawEdits;
      const family = nextDesign.families[familyId] ||= {};
      family.variants ||= {};
      family.addedVariants = Array.isArray(family.addedVariants) ? family.addedVariants : [];
      if (hasOwn(edits,'archivedGroup')) family.archived = Boolean(edits.archivedGroup);

      (Array.isArray(edits.added) ? edits.added : []).forEach((variant) => {
        if (!variant?.id) return;
        const existing = family.addedVariants.find((item) => item.id === variant.id);
        if (existing) {
          existing.name = variant.name || existing.name;
        } else {
          family.addedVariants.push({ id:variant.id, name:variant.name || 'New sprite', image:'' });
        }
        family.variants[variant.id] ||= {};
        family.variants[variant.id].deleted = false;
      });

      Object.entries(edits.archived && typeof edits.archived === 'object' ? edits.archived : {}).forEach(([variantId,archived]) => {
        family.variants[variantId] ||= {};
        family.variants[variantId].archived = Boolean(archived);
      });

      (Array.isArray(edits.deleted) ? edits.deleted : []).forEach((variantId) => {
        const addedIndex = family.addedVariants.findIndex((item) => item.id === variantId);
        if (addedIndex >= 0) {
          family.addedVariants.splice(addedIndex,1);
          delete family.variants[variantId];
        } else {
          family.variants[variantId] ||= {};
          family.variants[variantId].deleted = true;
        }
      });

      if (Array.isArray(edits.order) && edits.order.length) {
        const deleted = new Set(Array.isArray(edits.deleted) ? edits.deleted : []);
        family.order = edits.order.filter((id,index,array) => id && !deleted.has(id) && array.indexOf(id) === index);
      }

      Object.entries(edits.images && typeof edits.images === 'object' ? edits.images : {}).forEach(([variantId,dataUrl]) => {
        if (Array.isArray(edits.deleted) && edits.deleted.includes(variantId)) return;
        const asset = publishedImageAsset(familyId,variantId,dataUrl);
        assets.push(asset);
        family.variants[variantId] ||= {};
        family.variants[variantId].image = asset.path;
        family.variants[variantId].deleted = false;
      });

      Object.entries(edits.percentages && typeof edits.percentages === 'object' ? edits.percentages : {}).forEach(([variantId,percentage]) => {
        if (Array.isArray(edits.deleted) && edits.deleted.includes(variantId)) return;
        family.variants[variantId] ||= {};
        if (percentage) family.variants[variantId].rarityPercentage = String(percentage);
        else delete family.variants[variantId].rarityPercentage;
      });

      Object.entries(edits.dustLevels && typeof edits.dustLevels === 'object' ? edits.dustLevels : {}).forEach(([variantId,levels]) => {
        if (Array.isArray(edits.deleted) && edits.deleted.includes(variantId)) return;
        family.variants[variantId] ||= {};
        const cleanLevels = normalizeDustLevels(levels);
        if (Object.keys(cleanLevels).length) family.variants[variantId].dustLevels = cleanLevels;
        else delete family.variants[variantId].dustLevels;
      });
    });
    nextDesign._meta = { ...(nextDesign._meta || {}), publishedAt:Date.now() };
    return { nextDesign, assets };
  }

  function githubPublishError(error) {
    if (error?.status === 401) return 'GitHub did not accept that token. Check it and try again.';
    if (error?.status === 403) return 'That token cannot write to this repository. Give it Contents: Read and write permission.';
    if (error?.status === 404) return 'The repository or branch was not available to that token. Make sure Sprite-Checklist-Clean is selected.';
    if (error?.status === 409 || error?.status === 422) return 'The repository changed while publishing. Wait a moment, then try again.';
    return error?.message || 'The sprite changes could not be published.';
  }

  async function publishSpriteChanges(token) {
    if (!hasUnpublishedSpriteChanges()) throw new Error('There are no new sprite changes to publish.');
    const { owner,repo,branch } = GITHUB_PUBLISH_TARGET;
    const repository = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const reference = await githubRequest(token,`${repository}/git/ref/heads/${encodeURIComponent(branch)}`);
    const headSha = reference?.object?.sha;
    if (!headSha) throw new Error('GitHub did not return the current branch.');
    const headCommit = await githubRequest(token,`${repository}/git/commits/${headSha}`);
    const baseTreeSha = headCommit?.tree?.sha;
    if (!baseTreeSha) throw new Error('GitHub did not return the current file tree.');
    const publishedFile = await githubRequest(token,`${repository}/contents/published-design.js?ref=${encodeURIComponent(branch)}`);
    const basePublishedDesign = parsePublishedDesignFile(decodeBase64Utf8(publishedFile?.content));
    const { nextDesign,assets } = buildPublishedSpriteDesign(basePublishedDesign);
    const treeEntries = [];

    for (const asset of assets) {
      const blob = await githubRequest(token,`${repository}/git/blobs`,{
        method:'POST',
        body:{ content:asset.content, encoding:'base64' }
      });
      treeEntries.push({ path:asset.path, mode:'100644', type:'blob', sha:blob.sha });
    }

    const publishedSource = `// Generated by Sprite Checklist. Artwork is stored in published-assets.\nwindow.PUBLISHED_DESIGN = ${JSON.stringify(nextDesign)};\n`;
    const designBlob = await githubRequest(token,`${repository}/git/blobs`,{
      method:'POST',
      body:{ content:publishedSource, encoding:'utf-8' }
    });
    treeEntries.push({ path:'published-design.js', mode:'100644', type:'blob', sha:designBlob.sha });
    const tree = await githubRequest(token,`${repository}/git/trees`,{
      method:'POST',
      body:{ base_tree:baseTreeSha, tree:treeEntries }
    });
    const commit = await githubRequest(token,`${repository}/git/commits`,{
      method:'POST',
      body:{ message:'Publish sprite card changes', tree:tree.sha, parents:[headSha] }
    });
    await githubRequest(token,`${repository}/git/refs/heads/${encodeURIComponent(branch)}`,{
      method:'PATCH',
      body:{ sha:commit.sha, force:false }
    });

    design.families = cloneJson(nextDesign.families || {});
    design.customFamilies = cloneJson(nextDesign.customFamilies || []);
    design._meta = { ...(design._meta || {}), ...(nextDesign._meta || {}) };
    Object.entries(nextDesign.families || {}).forEach(([familyId,family]) => {
      if (!spriteCardEdits.families?.[familyId]) return;
      familyCardEdits(familyId).publishedAdded = (Array.isArray(family.addedVariants) ? family.addedVariants : []).map((variant) => variant.id);
    });
    spriteCardEdits.lastPublishedSnapshot = spriteCardEditsFingerprint();
    saveSpriteCardEdits();
    renderAll();
    return commit.sha;
  }

  function openPublishSpritesDialog() {
    if (!hasUnpublishedSpriteChanges()) return showToast('There are no new sprite changes to publish.');
    try { githubTokenInput.value = sessionStorage.getItem(GITHUB_TOKEN_SESSION_KEY) || ''; } catch { githubTokenInput.value = ''; }
    setPublishBusy(false);
    setPublishStatus(`Ready to publish to ${GITHUB_PUBLISH_TARGET.owner}/${GITHUB_PUBLISH_TARGET.repo}.`);
    publishSpritesDialog.showModal();
    setTimeout(() => githubTokenInput.focus(),0);
  }

  function safeCssUrl(source) {
    return displayImageSource(source).replace(/["\n\r]/g,'');
  }

  function applyCustomBackground(element,color,image,mode) {
    const source = safeCssUrl(image);
    const sizing = imageMode(mode);
    element.style.backgroundColor = color || 'transparent';
    element.style.backgroundImage = source ? `url("${source}")` : 'none';
    element.style.backgroundPosition = 'center';
    element.style.backgroundSize = sizing.size;
    element.style.backgroundRepeat = sizing.repeat;
  }

  function applyImageSurface(root,prefix,image,mode,builtInFallback = '') {
    const source = safeCssUrl(image);
    const sizing = imageMode(mode);
    root.style.setProperty(`--theme-${prefix}-image`,source ? `url("${source}")` : (builtInFallback || 'none'));
    root.style.setProperty(`--theme-${prefix}-size`,sizing.size);
    root.style.setProperty(`--theme-${prefix}-repeat`,sizing.repeat);
  }

  function colorWithOpacity(color,percentage) {
    const match = String(color || '').match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!match) return color || 'transparent';
    const channels = match.slice(1).map((part) => parseInt(part,16));
    const alpha = Math.max(0,Math.min(100,Number(percentage ?? 100))) / 100;
    return `rgba(${channels.join(',')},${alpha})`;
  }

  function summaryTextShadow(theme) {
    const strength = Math.max(0,Math.min(20,Number(theme.summaryEffectStrength) || 0));
    if (!strength || theme.summaryTextEffect === 'none') return 'none';
    const color = theme.summaryEffectColor || '#000';
    if (theme.summaryTextEffect === 'glow') return `0 0 ${Math.max(2,Math.round(strength / 2))}px ${color},0 0 ${strength}px ${color}`;
    return `0 ${Math.max(1,Math.round(strength / 3))}px ${strength}px ${color}`;
  }

  function setCss(root,name,value,unit = '') {
    if (value !== undefined && value !== null && value !== '') root.style.setProperty(name,`${value}${unit}`);
  }

  function summaryFont(theme) {
    if (theme.summaryFont === 'heading') return 'var(--font-heading)';
    if (theme.summaryFont === 'button') return 'var(--font-button)';
    if (theme.summaryFont === 'body') return 'var(--font-body)';
    return FONT_OPTIONS[theme.summaryFont] || 'var(--font-body)';
  }

  function applyTheme() {
    const theme = design.theme;
    const root = document.documentElement;
    let customFontStyle = document.getElementById('userCustomFontStyle');
    if (!customFontStyle) {
      customFontStyle = document.createElement('style');
      customFontStyle.id = 'userCustomFontStyle';
      document.head.appendChild(customFontStyle);
    }
    customFontStyle.textContent = theme.customFontData
      ? `@font-face{font-family:"UserCustomFont";src:url("${safeCssUrl(theme.customFontData)}");font-display:swap;}`
      : '';

    setCss(root,'--font-body',FONT_OPTIONS[theme.bodyFont] || FONT_OPTIONS.playful);
    setCss(root,'--font-heading',FONT_OPTIONS[theme.headingFont] || FONT_OPTIONS.playful);
    setCss(root,'--font-button',FONT_OPTIONS[theme.buttonFont] || FONT_OPTIONS.system);
    setCss(root,'--font-summary',summaryFont(theme));
    setCss(root,'--theme-base-size',theme.baseSize,'px');
    setCss(root,'--theme-title-size',theme.titleSize,'px');
    setCss(root,'--theme-page-title-size',theme.pageTitleSize,'px');
    setCss(root,'--theme-group-title-size',theme.groupTitleSize,'px');
    setCss(root,'--theme-sprite-label-size',theme.spriteLabelSize,'px');
    setCss(root,'--theme-checklist-button-size',theme.checklistButtonSize,'px');
    setCss(root,'--theme-text',theme.textColor);
    setCss(root,'--theme-muted',theme.mutedColor);
    setCss(root,'--theme-body-bg',theme.bodyBgColor);
    setCss(root,'--theme-header-text',theme.headerTextColor);
    setCss(root,'--theme-header-height',theme.headerHeight,'px');
    setCss(root,'--theme-header-surface',colorWithOpacity(theme.headerBgColor,theme.headerOpacity));
    setCss(root,'--theme-collection-bg',theme.collectionBgColor);
    setCss(root,'--theme-collection-text',theme.collectionTextColor);
    setCss(root,'--theme-collection-border',theme.collectionBorderColor);
    setCss(root,'--theme-collection-radius',theme.collectionRadius,'px');
    setCss(root,'--theme-card-bg',theme.cardBgColor);
    setCss(root,'--theme-card-text',theme.cardTextColor);
    setCss(root,'--theme-card-border',theme.cardBorderColor);
    setCss(root,'--theme-card-radius',theme.cardRadius,'px');
    setCss(root,'--theme-well-bg',theme.wellBgColor);
    setCss(root,'--theme-well-border',theme.wellBorderColor);
    setCss(root,'--theme-tab-bg',theme.tabBgColor);
    setCss(root,'--theme-tab-active',theme.tabActiveColor);
    setCss(root,'--theme-summary-surface',colorWithOpacity(theme.summaryBgColor,theme.summaryOpacity));
    setCss(root,'--theme-summary-border',theme.summaryBorderColor);
    setCss(root,'--theme-summary-number',theme.summaryNumberColor);
    setCss(root,'--theme-summary-label',theme.summaryLabelColor);
    setCss(root,'--theme-summary-radius',theme.summaryRadius,'px');
    setCss(root,'--theme-summary-number-size',theme.summaryNumberSize,'px');
    setCss(root,'--theme-summary-label-size',theme.summaryLabelSize,'px');
    setCss(root,'--theme-summary-text-shadow',summaryTextShadow(theme));
    setCss(root,'--theme-button-bg',theme.buttonBgColor);
    setCss(root,'--theme-button-text',theme.buttonTextColor);
    setCss(root,'--theme-accent',theme.accentColor);
    setCss(root,'--theme-art-width',theme.artWidth,'px');

    applyImageSurface(root,'body',theme.bodyBgImage,theme.bodyBgMode);
    const themeRarity = activeThemeRarity();
    document.body.dataset.rarity = themeRarity.toLowerCase();
    document.body.dataset.page = activeRarity.toLowerCase();
    document.body.dataset.missingView = isUnownedPage() ? missingView : '';
    const pageHeader = theme.pageHeaderBackgrounds?.[themeRarity] || {};
    const usePageHeader = Boolean(pageHeader.enabled && pageHeader.image);
    applyImageSurface(root,'header',usePageHeader ? pageHeader.image : theme.headerBgImage,usePageHeader ? pageHeader.mode : theme.headerBgMode);
    root.style.setProperty('--theme-header-position',imagePosition(usePageHeader ? pageHeader.position : theme.headerBgPosition));
    applyImageSurface(root,'collection',theme.collectionBgImage,theme.collectionBgMode,theme.useBuiltInCollectionArt ? 'linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,0))' : 'none');
    applyImageSurface(root,'card',theme.cardBgImage,theme.cardBgMode);
    applyImageSurface(root,'well',theme.wellBgImage,theme.wellBgMode,theme.useBuiltInWellArt ? 'radial-gradient(circle at 40% 25%,#fff 0,#e7ddfa 42%,#b8a1e8 100%)' : 'none');
    const page = isUnownedPage()
      ? DEFAULT_MISSING_PAGE_BACKGROUNDS[missingView]
      : (theme.pageBackgrounds?.[themeRarity] || {});
    root.style.setProperty('--theme-page-bg',page.enabled ? page.color || 'transparent' : 'transparent');
    applyImageSurface(root,'page',page.enabled ? page.image : '',page.mode || 'cover');

    document.body.classList.toggle('hide-stars',!theme.showStars);
    document.body.classList.toggle('collection-open',theme.collectionStyle !== 'boxed');
    const hero = document.getElementById('hero');
    hero.classList.toggle('summary-text-only',theme.summaryStyle !== 'boxed');
    hero.classList.toggle('summary-bars-hidden',!theme.summaryShowBars);
    const leftArt = document.getElementById('leftCustomArt');
    const rightArt = document.getElementById('rightCustomArt');
    leftArt.src = displayImageSource(theme.leftArt);
    rightArt.src = displayImageSource(theme.rightArt);
    leftArt.hidden = !theme.leftArt;
    rightArt.hidden = !theme.rightArt;
  }

  function renderOptionalText(element,value) {
    const text = String(value ?? '');
    element.textContent = text;
    element.hidden = !text;
  }

  function applySummaryPositions() {
    const hero = document.getElementById('hero');
    const positions = design.header.summaryPositions;
    const free = positions.mode === 'free' && design.header.showSummary;
    hero.classList.toggle('summary-free-positioning',free);
    ['collected','mastered'].forEach((key) => {
      const box = document.querySelector(`[data-summary-box="${key}"]`);
      if (!box) return;
      if (free) {
        box.style.setProperty('--summary-x',`${positions[key].x}%`);
        box.style.setProperty('--summary-y',`${positions[key].y}%`);
      } else {
        box.style.removeProperty('--summary-x');
        box.style.removeProperty('--summary-y');
      }
    });
  }

  function renderHeader() {
    renderOptionalText(document.getElementById('headerKicker'),design.header.kicker);
    renderOptionalText(document.getElementById('headerTitle'),'My Sprite Tracker');
    renderOptionalText(document.getElementById('headerSubtitle'),design.header.subtitle);
    document.getElementById('collectedLabel').textContent = design.header.collectedLabel || 'In Collection';
    document.getElementById('masteredLabel').textContent = design.header.masteredLabel || 'Mastered';
    document.getElementById('summary').hidden = !design.header.showSummary;
    renderOptionalText(document.getElementById('footerNote'),design.header.footerNote);
    applySummaryPositions();
  }

  function variantBackgroundSource(variant,family = null) {
    const featured = family?.id ? FEATURED_VARIANT_BACKGROUNDS[family.id] : '';
    if (featured) return featured;
    if (!design.theme.useVariantBackgrounds) return '';
    const backgrounds = design.theme.variantBackgrounds || {};
    const idKey = normalizeVariantBackgroundKey(variant.id);
    if (idKey && hasOwn(backgrounds,idKey)) return backgrounds[idKey] || '';
    const nameKey = normalizeVariantBackgroundKey(variant.name);
    return nameKey && hasOwn(backgrounds,nameKey) ? backgrounds[nameKey] || '' : '';
  }

  function applyVariantBackground(element,variant,family = null) {
    const source = variantBackgroundSource(variant,family);
    if (!source) return;
    applyCustomBackground(element,design.theme.wellBgColor,source,design.theme.variantBgMode || 'cover');
    element.classList.add('has-variant-background');
  }

  function crownSvg() {
    return '<svg viewBox="0 0 64 52" aria-hidden="true"><path d="M8 42 4 14l17 13L32 5l11 22 17-13-4 28H8Z"/><path d="M10 46h44"/></svg>';
  }

  function updateCard(card,current,family,variant) {
    const view = variantView(family,variant);
    const variantName = view.name || 'Unnamed';
    const groupName = familyView(family).name || 'sprite';
    card.classList.toggle('collected',Boolean(current.collected));
    card.classList.toggle('mastered',Boolean(current.mastered));
    const collectedAction = `${current.collected ? 'Remove' : 'Mark'} ${variantName} ${groupName} ${current.collected ? 'from collection' : 'as collected'}`;
    const masteredAction = `${current.mastered ? 'Remove mastery from' : 'Mark'} ${variantName} ${groupName}${current.mastered ? '' : ' as mastered'}`;
    const imageButton = card.querySelector('.image-button');
    const collectButton = card.querySelector('.collect-button');
    const crownButton = card.querySelector('.crown-button');
    const collectionCountEmblem = card.querySelector('.collection-count-emblem');
    const vaultDisplay = appView === APP_VIEW_VAULT;
    const huntDisplay = huntMode.active && !vaultDisplay;
    card.setAttribute('aria-label',`${variantName} ${groupName}${current.mastered ? ', mastered' : ''}`);
    imageButton.disabled = vaultDisplay || huntDisplay;
    imageButton.tabIndex = vaultDisplay || huntDisplay ? -1 : 0;
    imageButton.setAttribute('aria-label',vaultDisplay
      ? `${variantName} ${groupName} display case`
      : (huntDisplay ? `${variantName} ${groupName} Hunt card` : (spriteEditMode ? `Upload image for ${variantName} ${groupName}` : collectedAction)));
    if (spriteEditMode || vaultDisplay || huntDisplay) imageButton.removeAttribute('aria-pressed');
    else imageButton.setAttribute('aria-pressed',String(Boolean(current.collected)));
    collectButton.setAttribute('aria-label',collectedAction);
    collectButton.setAttribute('aria-pressed',String(Boolean(current.collected)));
    collectButton.disabled = huntDisplay;
    collectButton.tabIndex = huntDisplay ? -1 : 0;
    crownButton.setAttribute('aria-label',masteredAction);
    crownButton.setAttribute('aria-pressed',String(Boolean(current.mastered)));
    crownButton.disabled = vaultDisplay || huntDisplay;
    crownButton.tabIndex = vaultDisplay || huntDisplay ? -1 : 0;
    if (vaultDisplay) crownButton.setAttribute('aria-hidden','true');
    else crownButton.removeAttribute('aria-hidden');
    collectButton.querySelector('.collect-label').textContent = design.header.collectedLabel || 'In Collection';
    const masterText = current.mastered ? (design.header.masteredLabel || 'Mastered') : design.header.masterPrompt;
    const masterLabel = card.querySelector('.master-label');
    masterLabel.textContent = masterText || '';
    masterLabel.hidden = !masterText;
    collectionCountEmblem.textContent = String(Math.max(0,Number(current.collectionCount) || 0));
    const collectionCount = Math.max(0,Number(current.collectionCount) || 0);
    const canResetCollectionCount = !vaultDisplay && !huntDisplay && collectionCount > 0;
    collectionCountEmblem.disabled = !canResetCollectionCount;
    collectionCountEmblem.tabIndex = canResetCollectionCount ? 0 : -1;
    collectionCountEmblem.setAttribute('aria-label',canResetCollectionCount
      ? `${collectionCount} lifetime collections. Reset count for ${variantName} ${groupName}`
      : `${collectionCount} lifetime collections`);
    collectionCountEmblem.title = canResetCollectionCount ? 'Reset times collected' : '';
  }

  function openCollectionCountReset(card,current,family,variant) {
    const collectionCount = Math.max(0,Number(current.collectionCount) || 0);
    if (!collectionCount || huntMode.active || appView === APP_VIEW_VAULT) return;
    const familyName = familyView(family).name || 'Sprite';
    const variantName = variantView(family,variant).name || 'Variant';
    pendingCollectionCountReset = { card,current,family,variant };
    collectionCountResetMessage.textContent = `Reset ${variantName} ${familyName} from ${collectionCount} times collected to 0? This will not remove it from your collection or change mastery.`;
    document.documentElement.classList.add('collection-count-reset-open');
    document.body.classList.add('collection-count-reset-open');
    collectionCountResetDialog.showModal();
    requestAnimationFrame(() => collectionCountResetTitle.focus());
  }

  function resetCollectionCount(event) {
    event.preventDefault();
    if (!pendingCollectionCountReset) return collectionCountResetDialog.close();
    const { card,current,family,variant } = pendingCollectionCountReset;
    current.collectionCount = 0;
    saveProgress();
    updateCard(card,current,family,variant);
    collectionCountResetDialog.close();
  }

  function saveRecentMissingChanges() {
    try {
      sessionStorage.setItem(RECENT_MISSING_KEY,JSON.stringify(recentMissingChanges));
    } catch {
      /* Recent actions can remain available for this visit. */
    }
  }

  function recentMissingEntryMatches(entry) {
    const current = state[entry.familyId]?.[entry.variantId];
    return Boolean(current)
      && Boolean(current.collected) === Boolean(entry.after?.collected)
      && Boolean(current.mastered) === Boolean(entry.after?.mastered);
  }

  function recordRecentMissingChange(family,variant,before,current) {
    if (!isUnownedPage() || !before) return;
    const mode = missingView === 'unmastered' ? 'unmastered' : 'unowned';
    const movedOut = mode === 'unmastered'
      ? !before.mastered && current.mastered
      : !before.collected && current.collected;
    if (!movedOut) return;
    const existing = recentMissingChanges[mode] || [];
    recentMissingChanges[mode] = [
      {
        id:`${family.id}:${variant.id}:${Date.now()}`,
        familyId:family.id,
        variantId:variant.id,
        before:snapshotVariantState(before),
        after:snapshotVariantState(current)
      },
      ...existing.filter((entry) => entry.familyId !== family.id || entry.variantId !== variant.id)
    ].slice(0,4);
    saveRecentMissingChanges();
  }

  function undoRecentMissingChange(mode,entryId) {
    const entries = recentMissingChanges[mode] || [];
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    const family = allFamilies().find((item) => item.id === entry.familyId);
    const variant = family && orderedVariants(family).find((item) => item.id === entry.variantId);
    const current = variantState(entry.familyId,entry.variantId);
    applyVariantSnapshot(current,entry.before);
    const journalEntry = [...pendingJournalEntries,...journalEntries].find((item) => !item.undone
      && item.familyId === entry.familyId
      && item.variantId === entry.variantId
      && variantSnapshotsMatch(item.after,entry.after));
    if (journalEntry) {
      journalEntry.undone = true;
      journalEntry.undoneAt = new Date().toISOString();
      scheduleJournalSave();
    }
    recentMissingChanges[mode] = entries.filter((item) => item.id !== entryId);
    saveProgress();
    saveRecentMissingChanges();
    renderTabs();
    renderCollections();
    updateCounters();
    showToast(`${variant ? variantView(family,variant).name : 'Sprite'} restored`);
  }

  function renderRecentMissingChanges() {
    if (!missingRecentChangesEl || !missingRecentListEl) return;
    if (!isUnownedPage()) {
      missingRecentChangesEl.hidden = true;
      missingRecentListEl.replaceChildren();
      return;
    }
    const mode = missingView === 'unmastered' ? 'unmastered' : 'unowned';
    const previousEntries = recentMissingChanges[mode] || [];
    const entries = previousEntries.filter(recentMissingEntryMatches);
    if (entries.length !== previousEntries.length) {
      recentMissingChanges[mode] = entries;
      saveRecentMissingChanges();
    }
    missingRecentChangesEl.hidden = !entries.length;
    missingRecentDescriptionEl.textContent = mode === 'unmastered'
      ? 'Sprites just marked Mastered'
      : 'Sprites just added to your collection';
    missingRecentListEl.replaceChildren();
    entries.forEach((entry) => {
      const family = allFamilies().find((item) => item.id === entry.familyId);
      const variant = family && orderedVariants(family).find((item) => item.id === entry.variantId);
      if (!family || !variant) return;
      const familyInfo = familyView(family);
      const view = variantView(family,variant);
      const row = document.createElement('div');
      row.className = 'missing-recent-item';
      const thumb = document.createElement('div');
      thumb.className = 'missing-recent-thumb';
      const imageSource = displayImageSource(view.image);
      if (imageSource) {
        const image = document.createElement('img');
        image.src = imageSource;
        image.alt = '';
        image.width = 52;
        image.height = 52;
        image.loading = 'lazy';
        thumb.appendChild(image);
      } else {
        thumb.textContent = (familyInfo.name || 'S').slice(0,1).toUpperCase();
      }
      const copy = document.createElement('div');
      copy.className = 'missing-recent-copy';
      const name = document.createElement('strong');
      name.textContent = `${familyInfo.name || 'Sprite'} · ${view.name || 'Variant'}`;
      const action = document.createElement('span');
      action.textContent = mode === 'unmastered' ? 'Marked Mastered' : 'Added to collection';
      copy.append(name,action);
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'missing-recent-undo';
      undo.textContent = 'Undo';
      undo.setAttribute('aria-label',`Undo change to ${familyInfo.name || 'Sprite'} ${view.name || 'variant'}`);
      undo.addEventListener('click',() => undoRecentMissingChange(mode,entry.id));
      row.append(thumb,copy,undo);
      missingRecentListEl.appendChild(row);
    });
  }

  function commitCardChange(card,family,variant,current,message,before = null,type = '') {
    recordRecentMissingChange(family,variant,before,current);
    const journalEntry = before && type ? recordJournalEntry(type,family,variant,before,current) : null;
    updateCard(card,current,family,variant);
    saveProgress();
    if (isUnownedPage()) renderCollections();
    updateCounters();
    showToast(`${variantView(family,variant).name || family.name}: ${message}`);
    return journalEntry;
  }

  function cardDropAfter(card,event) {
    const rect = card.getBoundingClientRect();
    return currentSpriteViewMode() === 'list'
      ? event.clientY > rect.top + rect.height / 2
      : event.clientX > rect.left + rect.width / 2;
  }

  function makeCard(family,variant,{ eager = false } = {}) {
    const current = variantState(family.id,variant.id);
    const view = variantView(family,variant);
    const familyInfo = familyView(family);
    const previousSeason = isPreviousSeasonSprite(family,variant);
    const rowVariants = variantsForSeason(family);
    const rowIndex = rowVariants.findIndex((item) => item.id === variant.id);
    const listView = currentSpriteViewMode() === 'list';
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.familyId = family.id;
    card.dataset.variantId = variant.id;
    card.dataset.rarity = familyRarity(family);
    card.classList.toggle('archived-sprite',previousSeason);
    if (view.customCard) applyCustomBackground(card,view.cardColor,view.cardImage,view.cardMode);

    const crown = document.createElement('button');
    crown.type = 'button';
    crown.className = 'crown-button';
    crown.innerHTML = crownSvg();
    const collectionCountEmblem = document.createElement('button');
    collectionCountEmblem.type = 'button';
    collectionCountEmblem.className = 'collection-count-emblem';
    const seasonBadge = document.createElement('span');
    seasonBadge.className = 'sprite-season-badge';
    seasonBadge.textContent = seasonViewLabel(spriteSeasonId(family,variant));
    seasonBadge.hidden = !SEASON_FEATURE_VISIBLE || !previousSeason;

    const imageWrap = document.createElement('div');
    imageWrap.className = 'image-wrap';
    if (appView !== APP_VIEW_VAULT) applyVariantBackground(imageWrap,variant,family);
    const imageButton = document.createElement('button');
    imageButton.type = 'button';
    imageButton.className = 'image-button';
    const imageSource = displayImageSource(view.image);
    if (imageSource) {
      const image = document.createElement('img');
      image.src = imageSource;
      image.alt = `${view.name || familyInfo.name || 'Sprite'} artwork`;
      image.width = 512;
      image.height = 512;
      image.loading = eager ? 'eager' : 'lazy';
      image.decoding = 'async';
      if (eager) image.fetchPriority = 'high';
      image.addEventListener('error', () => {
        image.remove();
        const fallback = document.createElement('span');
        fallback.className = 'image-fallback';
        fallback.textContent = 'Image unavailable';
        imageButton.prepend(fallback);
      },{ once:true });
      imageButton.appendChild(image);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'image-fallback';
      fallback.textContent = 'Artwork coming soon';
      imageButton.appendChild(fallback);
    }
    const badge = document.createElement('span');
    badge.className = 'check-badge';
    badge.setAttribute('aria-hidden','true');
    badge.textContent = '✓';
    imageButton.appendChild(badge);
    const uploadHint = document.createElement('span');
    uploadHint.className = 'sprite-image-edit-hint';
    uploadHint.textContent = 'Drop image or tap to upload';
    uploadHint.setAttribute('aria-hidden','true');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    imageWrap.append(imageButton,uploadHint,fileInput);

    const editorTools = document.createElement('div');
    editorTools.className = 'sprite-card-tools';
    editorTools.setAttribute('aria-label',`Move or archive ${view.name || 'sprite'} card`);
    const moveLeft = document.createElement('button');
    moveLeft.type = 'button';
    moveLeft.className = 'sprite-move-step';
    moveLeft.textContent = listView ? '↑' : '←';
    moveLeft.disabled = rowIndex <= 0;
    moveLeft.setAttribute('aria-label',`Move ${view.name || 'sprite'} ${listView ? 'up' : 'left'}`);
    const moveHandle = document.createElement('button');
    moveHandle.type = 'button';
    moveHandle.className = 'sprite-move-handle';
    moveHandle.textContent = 'Drag';
    moveHandle.draggable = true;
    moveHandle.setAttribute('aria-label',`Drag ${view.name || 'sprite'} to move it`);
    const moveRight = document.createElement('button');
    moveRight.type = 'button';
    moveRight.className = 'sprite-move-step';
    moveRight.textContent = listView ? '↓' : '→';
    moveRight.disabled = rowIndex < 0 || rowIndex === rowVariants.length - 1;
    moveRight.setAttribute('aria-label',`Move ${view.name || 'sprite'} ${listView ? 'down' : 'right'}`);
    editorTools.append(moveLeft,moveHandle,moveRight);
    const localCardEdits = familyCardEdits(family.id);
    const publishedAddedVariants = design.families[family.id]?.addedVariants || [];
    const isAddedCard =
      localCardEdits.added.some((item) => item?.id === variant.id)
      || localCardEdits.publishedAdded.includes(variant.id)
      || publishedAddedVariants.some((item) => item?.id === variant.id);

    if (isAddedCard) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'sprite-archive-button';
      deleteButton.textContent = '×';
      deleteButton.title = 'Delete added Sprite';
      deleteButton.setAttribute(
        'aria-label',
        `Delete ${view.name || 'sprite'} card`
      );

      deleteButton.addEventListener('click',() => {
        const spriteName = view.name || 'this Sprite';

        if (!window.confirm(
          `Delete ${spriteName}? This removes its artwork and saved progress.`
        )) return;

        const previousEdits = cloneJson(spriteCardEdits);
        const edits = familyCardEdits(family.id);
        const wasPublished =
          edits.publishedAdded.includes(variant.id)
          || publishedAddedVariants.some((item) => item?.id === variant.id);

        if (wasPublished) {
          if (!edits.deleted.includes(variant.id)) {
            edits.deleted.push(variant.id);
          }
        } else {
          edits.added = edits.added.filter(
            (item) => item?.id !== variant.id
          );
        }

        edits.order = edits.order.filter((id) => id !== variant.id);
        delete edits.images[variant.id];
        delete edits.percentages[variant.id];
        delete edits.dustLevels[variant.id];
        delete edits.archived[variant.id];

        if (!saveCardEditOrRestore(previousEdits)) return;

        if (state[family.id]) {
          delete state[family.id][variant.id];

          if (!Object.keys(state[family.id]).length) {
            delete state[family.id];
          }

          saveProgress();
        }

        renderCollections();
        updateCounters();
        showToast(`${spriteName} deleted`);
      });

      editorTools.append(deleteButton);
    }
    const percentageEditor = document.createElement('label');
    percentageEditor.className = 'sprite-percentage-editor';
    const percentageEditorLabel = document.createElement('span');
    percentageEditorLabel.textContent = 'Rarity %';
    const percentageInput = document.createElement('input');
    percentageInput.type = 'text';
    percentageInput.inputMode = 'decimal';
    percentageInput.maxLength = 10;
    percentageInput.placeholder = '0.07';
    percentageInput.value = String(view.rarityPercentage || '').replace(/%$/,'');
    percentageInput.setAttribute('aria-label',`Rarity percentage for ${view.name || 'sprite'} ${familyInfo.name || ''}`.trim());
    percentageEditor.append(percentageEditorLabel,percentageInput);

    const dustEditor = document.createElement('div');
    dustEditor.className = 'sprite-dust-editor';
    const dustEditorTitle = document.createElement('strong');
    dustEditorTitle.textContent = 'Dust by level';
    const dustEditorFields = {};
    const dustEditorGrid = document.createElement('div');
    [1,2,3,4,5].forEach((level) => {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      const input = document.createElement('input');
      caption.textContent = `L${level}`;
      input.type = 'number';
      input.min = '0';
      input.max = '1000000';
      input.step = '1';
      input.inputMode = 'numeric';
      input.placeholder = '0';
      input.value = hasOwn(view.dustLevels,String(level)) ? String(view.dustLevels[String(level)]) : '';
      input.setAttribute('aria-label',`Level ${level} Sprite Dust for ${view.name || 'sprite'} ${familyInfo.name || ''}`.trim());
      dustEditorFields[level] = input;
      label.append(caption,input);
      dustEditorGrid.appendChild(label);
    });
    const saveDustButton = document.createElement('button');
    saveDustButton.type = 'button';
    saveDustButton.textContent = 'Save dust';
    dustEditor.append(dustEditorTitle,dustEditorGrid,saveDustButton);

    const makeDustDetails = (className) => {
      const details = document.createElement('details');
      details.className = className;
      details.hidden = !Object.keys(view.dustLevels).length && !spriteEditMode;
      const summary = document.createElement('summary');
      const levelOne = Number(view.dustLevels['1']) || 0;
      summary.textContent = levelOne ? `${formatDust(levelOne)} Dust` : 'Dust —';
      summary.setAttribute('aria-label',`Show Sprite Dust by level for ${view.name || 'sprite'} ${familyInfo.name || ''}`.trim());
      const menu = document.createElement('span');
      menu.className = 'sprite-dust-level-menu';
      [1,2,3,4,5].forEach((level) => {
        const row = document.createElement('span');
        const label = document.createElement('span');
        const amount = document.createElement('strong');
        label.textContent = `Level ${level}`;
        amount.textContent = hasOwn(view.dustLevels,String(level)) ? `${formatDust(view.dustLevels[String(level)])} Dust` : 'Not set';
        row.append(label,amount);
        menu.appendChild(row);
      });
      details.append(summary,menu);
      details.addEventListener('toggle',() => {
        if (!details.open) return;
        document.querySelectorAll('details.sprite-dust-details[open],details.sprite-list-dust-details[open]').forEach((item) => {
          if (item !== details) item.open = false;
        });
      });
      return details;
    };

    const variantLine = document.createElement('div');
    variantLine.className = 'sprite-variant-line';
    const dustDetails = makeDustDetails('sprite-dust-details');
    const rarityPercentage = document.createElement('span');
    rarityPercentage.className = 'sprite-rarity-percentage';
    rarityPercentage.textContent = view.rarityPercentage || '';
    rarityPercentage.hidden = !view.rarityPercentage;
    const title = document.createElement('h4');
    title.textContent = view.name || '';
    title.hidden = !view.name;
    variantLine.append(dustDetails,rarityPercentage,title);

    const listLabel = document.createElement('div');
    listLabel.className = 'sprite-list-label';
    const listGroupName = document.createElement('strong');
    listGroupName.textContent = familyInfo.name || family.name || 'Sprite';
    const listVariantLine = document.createElement('div');
    listVariantLine.className = 'sprite-list-variant-line';
    const listDustDetails = makeDustDetails('sprite-list-dust-details');
    const listRarityPercentage = document.createElement('span');
    listRarityPercentage.className = 'sprite-list-rarity-percentage';
    listRarityPercentage.textContent = view.rarityPercentage || '';
    listRarityPercentage.hidden = !view.rarityPercentage;
    const listVariantName = document.createElement('span');
    listVariantName.className = 'sprite-list-variant-name';
    listVariantName.textContent = view.name || 'Unnamed';
    listVariantLine.append(listDustDetails,listRarityPercentage,listVariantName);
    listLabel.append(listGroupName,listVariantLine);

    const collect = document.createElement('button');
    collect.type = 'button';
    collect.className = 'collect-button';
    const box = document.createElement('span');
    box.className = 'box';
    box.setAttribute('aria-hidden','true');
    const collectLabel = document.createElement('span');
    collectLabel.className = 'collect-label';
    collect.append(box,collectLabel);

    const huntCartButton = document.createElement('button');
    huntCartButton.type = 'button';
    huntCartButton.className = 'hunt-add-cart-button';
    huntCartButton.innerHTML = '<span aria-hidden="true">+</span>';
    huntCartButton.setAttribute('aria-label',`Add ${view.name || 'sprite'} ${familyInfo.name || ''} to Hunt cart`.trim());

    const masterLabel = document.createElement('div');
    masterLabel.className = 'master-label';
    card.append(crown,collectionCountEmblem,seasonBadge,imageWrap,editorTools,percentageEditor,dustEditor,variantLine,listLabel,collect,huntCartButton,masterLabel);

    const toggleCollected = () => {
      if (huntMode.active) return;
      const before = snapshotVariantState(current);
      const collectedAt = new Date().toISOString();
      current.collected = !current.collected;
      if (current.collected) {
        current.collectedAt = current.collectedAt || collectedAt;
      } else {
        current.mastered = false;
        delete current.collectedAt;
        delete current.masteredAt;
        delete current.locationFound;
      }
      const type = current.collected ? 'collected' : 'uncollected';
      commitCardChange(card,family,variant,current,current.collected ? 'Added to collection' : 'Removed from collection',before,type);
    };
    imageButton.addEventListener('click',() => {
      if (huntMode.active) return;
      if (spriteEditMode) return fileInput.click();
      toggleCollected();
    });
    collect.addEventListener('click',toggleCollected);
    huntCartButton.addEventListener('click',() => addSpriteToHuntCart(family,variant));
    collectionCountEmblem.addEventListener('click',() => openCollectionCountReset(card,current,family,variant));
    crown.addEventListener('click',() => {
      if (huntMode.active) return;
      const before = snapshotVariantState(current);
      const changedAt = new Date().toISOString();
      current.mastered = !current.mastered;
      if (current.mastered) {
        current.collected = true;
        current.collectedAt = current.collectedAt || changedAt;
        current.masteredAt = changedAt;
      } else {
        delete current.masteredAt;
      }
      const type = current.mastered ? 'mastered' : 'unmastered';
      commitCardChange(card,family,variant,current,current.mastered ? 'Mastered' : 'Mastery removed',before,type);
    });
    [imageButton,collect,crown].forEach((button) => {
      button.addEventListener('pointerup',() => requestAnimationFrame(() => button.blur()));
    });
    moveLeft.addEventListener('click',() => moveSpriteCard(family,variant.id,-1));
    moveRight.addEventListener('click',() => moveSpriteCard(family,variant.id,1));
    percentageInput.addEventListener('change',() => {
      if (!saveRarityPercentage(family,variant,percentageInput.value)) {
        percentageInput.value = String(view.rarityPercentage || '').replace(/%$/,'');
        percentageInput.focus();
      }
    });
    percentageInput.addEventListener('keydown',(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        percentageInput.blur();
      }
    });
    saveDustButton.addEventListener('click',() => saveSpriteDustLevels(family,variant,dustEditorFields));

    const acceptImage = async (file) => {
      imageWrap.classList.add('drop-saving');
      uploadHint.textContent = 'Saving image…';
      try {
        await replaceSpriteImage(family,variant,file);
      } catch {
        showToast('Choose a PNG, JPG, WebP, GIF, or AVIF image.');
      } finally {
        imageWrap.classList.remove('drop-saving','drop-ready');
        uploadHint.textContent = 'Drop image or tap to upload';
        fileInput.value = '';
      }
    };
    fileInput.addEventListener('change',() => {
      if (fileInput.files?.[0]) acceptImage(fileInput.files[0]);
    });
    imageWrap.addEventListener('dragenter',(event) => {
      if (!spriteEditMode || !hasDroppedImage(event.dataTransfer)) return;
      event.preventDefault();
      imageWrap.classList.add('drop-ready');
    });
    imageWrap.addEventListener('dragover',(event) => {
      if (!spriteEditMode || !hasDroppedImage(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      imageWrap.classList.add('drop-ready');
    });
    imageWrap.addEventListener('dragleave',(event) => {
      if (!imageWrap.contains(event.relatedTarget)) imageWrap.classList.remove('drop-ready');
    });
    imageWrap.addEventListener('drop',(event) => {
      if (!spriteEditMode || !hasDroppedImage(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      const file = droppedImageFile(event.dataTransfer);
      if (file) acceptImage(file);
      else showToast('Drop an image file onto the sprite card.');
    });

    moveHandle.addEventListener('dragstart',(event) => {
      if (!spriteEditMode) return event.preventDefault();
      const payload = JSON.stringify({ familyId:family.id, variantId:variant.id });
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(CARD_REORDER_MIME,payload);
      event.dataTransfer.setData('text/plain',payload);
      card.classList.add('is-reordering');
    });
    moveHandle.addEventListener('dragend',() => {
      document.querySelectorAll('.card').forEach((item) => item.classList.remove('is-reordering','reorder-before','reorder-after'));
    });
    card.addEventListener('dragover',(event) => {
      if (!spriteEditMode || ![...event.dataTransfer.types].includes(CARD_REORDER_MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const placeAfter = cardDropAfter(card,event);
      card.classList.toggle('reorder-before',!placeAfter);
      card.classList.toggle('reorder-after',placeAfter);
    });
    card.addEventListener('dragleave',(event) => {
      if (!card.contains(event.relatedTarget)) card.classList.remove('reorder-before','reorder-after');
    });
    card.addEventListener('drop',(event) => {
      if (!spriteEditMode || ![...event.dataTransfer.types].includes(CARD_REORDER_MIME)) return;
      event.preventDefault();
      card.classList.remove('reorder-before','reorder-after');
      try {
        const payload = event.dataTransfer.getData(CARD_REORDER_MIME) || event.dataTransfer.getData('text/plain');
        const source = JSON.parse(payload);
        if (source.familyId !== family.id) return showToast('Sprite cards stay in their current row.');
        const placeAfter = cardDropAfter(card,event);
        reorderSpriteCard(family,source.variantId,variant.id,placeAfter);
      } catch {
        showToast('That sprite card could not be moved.');
      }
    });
    updateCard(card,current,family,variant);
    return card;
  }

  function familyStats(family,mode = seasonView) {
    const group = familyView(family);
    if (group.deleted || !group.visible || !familyMatchesSeason(family,mode)) return { total:0, collected:0, mastered:0 };
    return variantsForSeason(family,mode).reduce((totals,variant) => {
      const current = variantState(family.id,variant.id);
      totals.total += 1;
      totals.collected += current.collected ? 1 : 0;
      totals.mastered += current.mastered ? 1 : 0;
      return totals;
    },{ total:0, collected:0, mastered:0 });
  }

  function rarityStats(rarity,mode = seasonView) {
    return allFamilies().filter((family) => familyRarity(family) === rarity).reduce((totals,family) => {
      const stats = familyStats(family,mode);
      totals.total += stats.total;
      totals.collected += stats.collected;
      totals.mastered += stats.mastered;
      return totals;
    },{ total:0, collected:0, mastered:0 });
  }

  function overallStats(mode = seasonView) {
    return rarities.reduce((totals,rarity) => {
      const stats = rarityStats(rarity,mode);
      totals.total += stats.total;
      totals.collected += stats.collected;
      totals.mastered += stats.mastered;
      return totals;
    },{ total:0, collected:0, mastered:0 });
  }

  function unownedCount(mode = seasonView) {
    const overall = overallStats(mode);
    return Math.max(0,overall.total - overall.collected);
  }

  function unmasteredCount(mode = seasonView) {
    const overall = overallStats(mode);
    return Math.max(0,overall.total - overall.mastered);
  }

  function handleTabKeys(event) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const tabButtons = Array.from(tabsEl.querySelectorAll('[role="tab"]'));
    const currentIndex = tabButtons.indexOf(event.currentTarget);
    if (currentIndex < 0 || !tabButtons.length) return;
    let nextIndex = currentIndex;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabButtons.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabButtons.length - 1;
    const targetId = tabButtons[nextIndex].id;
    tabButtons[nextIndex].click();
    requestAnimationFrame(() => document.getElementById(targetId)?.focus());
  }

  function renderTabs() {
    tabsEl.replaceChildren();
    const missing = unownedCount();
    const unmastered = unmasteredCount();
    pageTabs.forEach((rarity) => {
      if (rarity === UNOWNED_PAGE) {
        const addMissingTab = (view,label,count) => {
          const button = document.createElement('button');
          const selected = isUnownedPage() && missingView === view;
          button.type = 'button';
          button.id = `tab-${view}`;
          button.className = 'tab missing-filter-tab';
          button.setAttribute('role','tab');
          button.setAttribute('aria-controls','checklistPage');
          button.setAttribute('aria-selected',String(selected));
          button.setAttribute('aria-label',`${count} ${label.toLowerCase()} Sprites`);
          button.tabIndex = selected ? 0 : -1;
          button.textContent = `${label} (${count})`;
          button.addEventListener('click',() => setMissingView(view,{ historyMode:'push', announce:true }));
          button.addEventListener('keydown',handleTabKeys);
          tabsEl.appendChild(button);
        };
        addMissingTab('unowned','Unowned',missing);
        addMissingTab('unmastered','Unmastered',unmastered);
        return;
      }
      const stats = rarity === UNOWNED_PAGE ? null : rarityStats(rarity);
      const button = document.createElement('button');
      const count = document.createElement('small');
      button.type = 'button';
      button.className = 'tab';
      button.id = `tab-${rarity.toLowerCase()}`;
      button.setAttribute('role','tab');
      button.setAttribute('aria-controls','checklistPage');
      button.setAttribute('aria-selected',String(rarity === activeRarity));
      button.tabIndex = rarity === activeRarity ? 0 : -1;
      button.append(document.createTextNode(rarity),count);
      count.textContent = `${stats.collected}/${stats.total}`;
      button.setAttribute(
        'aria-label',
        `${rarity} Sprites, ${stats.collected} of ${stats.total} collected`
      );
      button.addEventListener('click',() => switchRarity(rarity,{ historyMode:'push', announce:true }));
      button.addEventListener('keydown',handleTabKeys);
      tabsEl.appendChild(button);
    });
  }

  function renderCollections() {
    collectionsEl.replaceChildren();
    renderRecentMissingChanges();
    const page = design.pages[activeRarity] || DEFAULT_PAGES[activeRarity];
    renderOptionalText(pageEyebrowEl,isUnownedPage() ? '' : page.eyebrow);
    renderOptionalText(
      pageTitleEl,
      isUnownedPage() ? (missingView === 'unmastered' ? 'Unmastered Sprites' : 'Unowned Sprites') : page.title
    );
    renderOptionalText(pageDescriptionEl,isUnownedPage() ? '' : page.description);
    document.getElementById('checklistPage').setAttribute('aria-labelledby','activePageTitle');
    let eagerImagesRemaining = 2;
    const unownedPage = isUnownedPage();

    const appendCollectionGroups = (variantFilter = null) => {
      let appended = 0;
      allFamilies().filter((family) => unownedPage || familyRarity(family) === activeRarity).forEach((family) => {
        const group = familyView(family);
        if (!familyMatchesSeason(family)) return;
        const rowVariants = variantsForSeason(family).filter(
          (variant) => !variantFilter || variantFilter(family,variant)
        );
        if (!rowVariants.length && !spriteEditMode) return;
        const stats = familyStats(family);
        const section = document.createElement('section');
        section.className = 'collection';
        section.dataset.rarity = familyRarity(family);
        section.dataset.familyId = family.id;
        section.classList.toggle('archived-group',group.archived);
        if (group.customBg) {
          section.classList.add('has-custom-background');
          applyCustomBackground(section,group.bgColor,group.bgImage,group.bgMode);
        }

        const header = document.createElement('div');
        header.className = 'collection-head';
        const titleWrap = document.createElement('div');
        titleWrap.className = 'collection-title-wrap';
        const title = document.createElement('h3');
        title.textContent = group.name || '';
        title.hidden = !group.name;
        const groupSeasonBadge = document.createElement('span');
        groupSeasonBadge.className = 'group-season-badge';
        groupSeasonBadge.textContent = seasonViewLabel(group.seasonId);
        groupSeasonBadge.hidden = !SEASON_FEATURE_VISIBLE || !group.archived;
        titleWrap.append(title,groupSeasonBadge);
        const meta = document.createElement('div');
        const progressCounts = document.createElement('div');
        const masteredCount = document.createElement('span');
        const count = document.createElement('span');
        const hint = document.createElement('span');
        const headerActions = document.createElement('div');
        const addButton = document.createElement('button');
        meta.className = 'collection-meta';
        progressCounts.className = 'collection-progress-counts';
        progressCounts.setAttribute('aria-label',`${group.name || 'Sprite'} progress`);
        masteredCount.className = 'collection-count collection-mastered-count';
        masteredCount.textContent = `${stats.mastered} / ${stats.total} mastered`;
        count.className = 'collection-count';
        count.textContent = `${stats.collected} / ${stats.total} collected`;
        hint.className = 'row-hint';
        hint.setAttribute('aria-hidden','true');
        hint.textContent = '';
        progressCounts.append(masteredCount,count);
        meta.append(progressCounts,hint);
        headerActions.className = 'collection-head-actions';
        addButton.type = 'button';
        addButton.className = 'add-sprite-button';
        addButton.textContent = '+ Add sprite';
        addButton.hidden = seasonView !== CURRENT_SEASON_ID;
        addButton.addEventListener('click',() => openAddSpriteDialog(family.id));
        headerActions.append(meta,addButton);
        header.append(titleWrap,headerActions);

        const row = document.createElement('div');
        row.className = 'variant-row';
        row.setAttribute('aria-label',`${group.name || 'Sprite'} variants`);
        rowVariants.forEach((variant) => {
          const image = variantView(family,variant).image;
          const eager = Boolean(image && eagerImagesRemaining > 0);
          if (eager) eagerImagesRemaining -= 1;
          row.appendChild(makeCard(family,variant,{ eager }));
        });
        if (!rowVariants.length) {
          const empty = document.createElement('p');
          empty.className = 'empty-sprite-row';
          empty.textContent = 'No sprite cards in this row.';
          row.appendChild(empty);
        }
        section.append(header,row);
        collectionsEl.appendChild(section);
        appended += 1;
      });
      return appended;
    };

    const appendMissingEmpty = (message) => {
      const empty = document.createElement('p');
      empty.className = 'empty-sprite-row unowned-empty';
      if (seasonView !== CURRENT_SEASON_ID && seasonView !== SEASON_VIEW_ALL) {
        empty.classList.add('season-vault-empty');
      }
      empty.textContent = message;
      collectionsEl.appendChild(empty);
    };

    if (unownedPage) {
      const namedSeason = seasonView !== CURRENT_SEASON_ID && seasonView !== SEASON_VIEW_ALL;
      const showingUnmastered = missingView === 'unmastered';
      const appended = appendCollectionGroups(
        (family,variant) => showingUnmastered
          ? !variantState(family.id,variant.id).mastered
          : !variantState(family.id,variant.id).collected
      );
      if (!appended) {
        appendMissingEmpty(showingUnmastered
          ? (namedSeason
              ? `Every Sprite from ${seasonViewLabel()} is mastered!`
              : 'Every Sprite is mastered—amazing!')
          : (namedSeason
              ? `You own every Sprite from ${seasonViewLabel()}!`
              : 'You own every Sprite—your collection is complete!'));
      }
      return;
    }

    const appended = appendCollectionGroups();
    if (!appended && seasonView !== CURRENT_SEASON_ID && seasonView !== SEASON_VIEW_ALL) {
      appendMissingEmpty(`Nothing from this rarity is listed for ${seasonViewLabel()} yet.`);
    }
  }

  function updateCounters() {
    const overall = overallStats();
    const page = isUnownedPage() ? null : rarityStats(activeRarity);
    const missing = Math.max(0,overall.total - overall.collected);
    const unmastered = Math.max(0,overall.total - overall.mastered);
    collectedTotalEl.textContent = `${overall.collected} / ${overall.total}`;
    masteredTotalEl.textContent = `${overall.mastered} / ${overall.total}`;
    const selectedMissingCount = missingView === 'unmastered' ? unmastered : missing;
    const selectedMissingLabel = missingView === 'unmastered' ? 'unmastered' : 'unowned';
    pageCountEl.textContent = isUnownedPage() ? `${selectedMissingCount} ${selectedMissingLabel}` : `${page.collected} / ${page.total}`;
    pageCountEl.setAttribute(
      'aria-label',
      isUnownedPage()
        ? `${selectedMissingCount} Sprites ${missingView === 'unmastered' ? 'not mastered' : 'not in collection'}`
        : `${page.collected} of ${page.total} collected on this page`
    );
    collectedBarEl.style.width = `${overall.total ? overall.collected / overall.total * 100 : 0}%`;
    masteredBarEl.style.width = `${overall.total ? overall.mastered / overall.total * 100 : 0}%`;

    collectionsEl.querySelectorAll('.collection').forEach((section) => {
      const family = allFamilies().find((item) => item.id === section.dataset.familyId);
      if (!family) return;
      const stats = familyStats(family);
      section.querySelector('.collection-count:not(.collection-mastered-count)').textContent = `${stats.collected} / ${stats.total} collected`;
      section.querySelector('.collection-mastered-count').textContent = `${stats.mastered} / ${stats.total} mastered`;
    });
    tabsEl.querySelectorAll('.tab').forEach((tab) => {
      const rarity = rarities.find((name) => tab.id === `tab-${name.toLowerCase()}`);
      if (!rarity) return;
      const stats = rarityStats(rarity);
      tab.querySelector('small').textContent = `${stats.collected}/${stats.total}`;
    });
    const unownedTab = document.getElementById('tab-unowned');
    const unmasteredTab = document.getElementById('tab-unmastered');
    if (unownedTab) {
      unownedTab.textContent = `Unowned (${missing})`;
      unownedTab.setAttribute('aria-label',`${missing} unowned Sprites`);
    }
    if (unmasteredTab) {
      unmasteredTab.textContent = `Unmastered (${unmastered})`;
      unmasteredTab.setAttribute('aria-label',`${unmastered} unmastered Sprites`);
    }
  }

  function renderAll() {
    applyTheme();
    renderHeader();
    applyAppView();
    applySeasonViewControls();
    renderTabs();
    updatePageModeControls();
    applySpriteViewMode();
    renderCollections();
    updateCounters();
    updatePublishButton();
    renderJournal();
    renderHuntHistory();
    renderDustAccount();
    applyHuntMode();
  }

  function switchRarity(rarity,options = {}) {
    if (!pageTabs.includes(rarity)) return;
    const changed = activeRarity !== rarity;
    activeRarity = rarity;
    updatePageModeControls();
    applyTheme();
    renderTabs();
    applySpriteViewMode();
    renderCollections();
    updateCounters();
    const hash = options.hash || `#${rarity.toLowerCase()}`;
    if (options.historyMode === 'push' && location.hash !== hash) history.pushState({ rarity },'',hash);
    else if (location.hash !== hash) history.replaceState({ rarity },'',hash);
    const activeTab = document.getElementById(
      rarity === UNOWNED_PAGE ? `tab-${missingView}` : `tab-${rarity.toLowerCase()}`
    );
    activeTab?.scrollIntoView({ block:'nearest', inline:'center' });
    if (options.focusTab) activeTab?.focus();
    if (options.announce && changed) showToast(`${rarity} page`);
  }

  function setMissingView(view,options = {}) {
    const next = view === 'unmastered' ? 'unmastered' : 'unowned';
    const changed = missingView !== next || !isUnownedPage();
    missingView = next;
    try { localStorage.setItem(MISSING_VIEW_KEY,missingView); } catch { /* The choice can remain active for this visit. */ }
    switchRarity(UNOWNED_PAGE,{
      historyMode:options.historyMode,
      focusTab:options.focusTab,
      hash:`#${missingView}`,
      announce:false
    });
    if (options.announce && changed) showToast(`${missingView === 'unmastered' ? 'Unmastered' : 'Unowned'} Sprites`);
  }

  function normalizeSearchText(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }

  function searchableSprites() {
    return allFamilies().flatMap((family) => {
      const group = familyView(family);
      if (group.deleted || !group.visible) return [];
      const rarity = familyRarity(family);
      return orderedVariants(family).flatMap((variant) => {
        const view = variantView(family,variant);
        if (view.deleted || !view.visible) return [];
        const groupName = group.name || 'Unnamed sprite';
        const variantName = view.name || 'Unnamed variant';
        const seasonId = spriteSeasonId(family,variant);
        return [{
          familyId:family.id,
          variantId:variant.id,
          rarity,
          groupName,
          variantName,
          seasonId,
          archived:seasonId !== CURRENT_SEASON_ID,
          searchText:normalizeSearchText(`${groupName} ${variantName} ${rarity}`)
        }];
      });
    });
  }

  function findSpriteMatches(query) {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];
    const tokens = normalized.split(' ');
    return searchableSprites().filter((entry) => tokens.every((token) => entry.searchText.includes(token))).map((entry) => {
      const group = normalizeSearchText(entry.groupName);
      const variant = normalizeSearchText(entry.variantName);
      const combined = `${group} ${variant}`;
      const score = variant === normalized ? 0 : (group === normalized ? 1 : (combined.startsWith(normalized) ? 2 : 3));
      return { ...entry, score };
    }).sort((a,b) => a.score - b.score || a.groupName.localeCompare(b.groupName) || a.variantName.localeCompare(b.variantName)).slice(0,12);
  }

  function spriteSearchState(entry) {
    if (huntMode.active) {
      const copies = huntCart.filter((item) => item.familyId === entry.familyId && item.variantId === entry.variantId).length;
      return copies ? `${copies} in cart · Add again` : 'Add to Hunt cart';
    }
    const current = state[entry.familyId]?.[entry.variantId] || {};
    if (current.mastered) return design.header.masteredLabel || 'Mastered';
    if (current.collected) return design.header.collectedLabel || 'In Collection';
    return 'Not collected';
  }

  function closeSpriteSearchResults() {
    spriteSearchResults.hidden = true;
    spriteSearchInput.setAttribute('aria-expanded','false');
  }

  function openSpriteSearchResult(entry) {
    closeSpriteSearchResults();
    spriteSearchInput.blur();
    if (SEASON_FEATURE_VISIBLE && entry.seasonId !== CURRENT_SEASON_ID) {
      setAppView(APP_VIEW_VAULT,{ announce:false, season:entry.seasonId });
    } else if (seasonView !== CURRENT_SEASON_ID) {
      setSeasonView(CURRENT_SEASON_ID,{ announce:false });
    }
    switchRarity(entry.rarity,{ historyMode:'push' });
    requestAnimationFrame(() => {
      const card = [...document.querySelectorAll('.card')].find((item) => item.dataset.familyId === entry.familyId && item.dataset.variantId === entry.variantId);
      if (!card) return showToast('That sprite is currently hidden.');
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior:reducedMotion ? 'auto' : 'smooth', block:'center', inline:'center' });
      card.classList.add('search-target');
      setTimeout(() => card.classList.remove('search-target'),2600);
      card.querySelector('.collect-button')?.focus({ preventScroll:true });
      const message = `${entry.groupName} — ${entry.variantName} on the ${entry.rarity} page`;
      spriteSearchStatus.textContent = message;
      showToast(message);
    });
  }

  function addSpriteSearchResultToHunt(entry) {
    const family = allFamilies().find((item) => item.id === entry.familyId);
    const variant = family && orderedVariants(family).find((item) => item.id === entry.variantId);
    if (!family || !variant) return showToast('That Sprite is no longer available.');
    addSpriteToHuntCart(family,variant);
  }

  function renderSpriteSearchResults() {
    const query = spriteSearchInput.value.trim();
    clearSpriteSearchBtn.hidden = !query;
    spriteSearchResults.replaceChildren();
    if (!query) return closeSpriteSearchResults();
    const matches = findSpriteMatches(query);
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'sprite-search-empty';
      empty.textContent = 'No matching sprites';
      spriteSearchResults.appendChild(empty);
    } else {
      matches.forEach((entry) => {
        const button = document.createElement('button');
        const text = document.createElement('span');
        const title = document.createElement('strong');
        const detail = document.createElement('small');
        const status = document.createElement('span');
        button.type = 'button';
        button.className = 'sprite-search-result';
        button.setAttribute('role','option');
        title.textContent = `${entry.groupName} — ${entry.variantName}`;
        detail.textContent = `${entry.rarity} sprite`;
        status.className = 'sprite-search-result-status';
        status.textContent = spriteSearchState(entry);
        text.append(title,detail);
        button.append(text,status);
        button.addEventListener('click',() => huntMode.active ? addSpriteSearchResultToHunt(entry) : openSpriteSearchResult(entry));
        spriteSearchResults.appendChild(button);
      });
    }
    spriteSearchResults.hidden = false;
    spriteSearchInput.setAttribute('aria-expanded','true');
    spriteSearchStatus.textContent = `${matches.length} matching sprite${matches.length === 1 ? '' : 's'}`;
    return matches;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    statusToast.textContent = message;
    statusToast.classList.add('show');
    toastTimer = setTimeout(() => statusToast.classList.remove('show'),2400);
  }

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function downloadableFile(blob,filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  function safeBackupKey(value) {
    const key = String(value || '');
    return Boolean(key && key.length <= 200 && !['__proto__','prototype','constructor'].includes(key));
  }

  function sanitizeProgress(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This backup does not contain valid checklist progress.');
    const clean = {};
    let familyCount = 0;
    let variantCount = 0;
    Object.entries(value).forEach(([familyId,variants]) => {
      if (!safeBackupKey(familyId) || !variants || typeof variants !== 'object' || Array.isArray(variants)) return;
      familyCount += 1;
      if (familyCount > 500) throw new Error('This backup contains too many Sprite groups.');
      const cleanVariants = {};
      Object.entries(variants).forEach(([variantId,current]) => {
        if (!safeBackupKey(variantId) || !current || typeof current !== 'object' || Array.isArray(current)) return;
        variantCount += 1;
        if (variantCount > 5000) throw new Error('This backup contains too many Sprite cards.');
        cleanVariants[variantId] = snapshotVariantState(current);
      });
      clean[familyId] = cleanVariants;
    });
    return clean;
  }

  function sanitizeViewModes(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(pageTabs.flatMap((page) => (
      value[page] === 'list' || value[page] === 'card' ? [[page,value[page]]] : []
    )));
  }

  function sanitizeSeasonView(value) {
    if (!SEASON_FEATURE_VISIBLE) return CURRENT_SEASON_ID;
    if (value === 'current' || value === 'previous') return CURRENT_SEASON_ID;
    return SEASON_VIEWS.includes(value) ? value : CURRENT_SEASON_ID;
  }

  function progressSnapshotStats(progress) {
    return Object.values(progress || {}).reduce((totals,variants) => {
      if (!variants || typeof variants !== 'object') return totals;
      Object.values(variants).forEach((current) => {
        if (!current || typeof current !== 'object') return;
        totals.saved += 1;
        totals.collected += current.collected === true ? 1 : 0;
        totals.mastered += current.mastered === true ? 1 : 0;
      });
      return totals;
    },{ saved:0, collected:0, mastered:0 });
  }

  function sanitizeHuntModeBackup(value) {
    const source = value && typeof value === 'object' ? value : {};
    const startedAt = validIsoDate(source.startedAt);
    return {
      active:source.active === true && Boolean(startedAt),
      startedAt,
      sessionStartedAt:validIsoDate(source.sessionStartedAt) || startedAt,
      lastDurationMs:Math.max(0,Math.min(7 * 24 * 60 * 60 * 1000,Number(source.lastDurationMs) || 0))
    };
  }

  async function backupPayload() {
    if (journalInitialization) await journalInitialization;
    return {
      format:BACKUP_FORMAT,
      version:BACKUP_VERSION,
      exportedAt:new Date().toISOString(),
      app:'My Sprite Tracker',
      progress:sanitizeProgress(state),
      viewModes:sanitizeViewModes(spriteViewModes),
      seasonView:sanitizeSeasonView(vaultSeasonView),
      journal:normalizeJournalEntries(journalEntries),
      huntMode:sanitizeHuntModeBackup(huntMode),
      huntCart:normalizeHuntCart(huntCart),
      huntHistory:normalizeHuntHistory(huntHistory),
      dustLedger:normalizeDustLedger(dustLedger)
    };
  }

  async function downloadProgressBackup() {
    const payload = await backupPayload();
    const blob = new Blob([`${JSON.stringify(payload,null,2)}\n`],{ type:'application/json' });
    const date = payload.exportedAt.slice(0,10);
    downloadableFile(blob,`my-sprite-tracker-backup-${date}.json`);
    const stats = progressSnapshotStats(payload.progress);
    backupRestoreStatus.dataset.state = 'success';
    backupRestoreStatus.textContent = `Backup downloaded: ${stats.collected} collected and ${stats.mastered} mastered.`;
    showToast('Progress backup downloaded');
  }

  function readFileAsText(file) {
    if (typeof file?.text === 'function') return file.text();
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function parsedBackup(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('That is not a Sprite Tracker backup.');
    if (value.format !== BACKUP_FORMAT || ![1,2,3,BACKUP_VERSION].includes(value.version)) {
      throw new Error('That file is not a compatible Sprite Tracker backup.');
    }
    return {
      progress:sanitizeProgress(value.progress),
      viewModes:sanitizeViewModes(value.viewModes),
      seasonView:sanitizeSeasonView(value.seasonView),
      journal:value.version >= 2 ? normalizeJournalEntries(value.journal) : [],
      huntMode:value.version >= 3 ? sanitizeHuntModeBackup(value.huntMode) : sanitizeHuntModeBackup(huntMode),
      huntCart:value.version >= 3 ? normalizeHuntCart(value.huntCart) : normalizeHuntCart(huntCart),
      huntHistory:value.version >= 3 ? normalizeHuntHistory(value.huntHistory) : normalizeHuntHistory(huntHistory),
      dustLedger:value.version >= 3 ? normalizeDustLedger(value.dustLedger) : normalizeDustLedger(dustLedger)
    };
  }

  async function prepareBackupRestore(file) {
    pendingRestore = null;
    confirmRestoreBtn.disabled = true;
    backupRestoreStatus.dataset.state = '';
    if (!file) {
      backupRestoreStatus.textContent = 'No backup selected.';
      return;
    }
    if (file.size > MAX_BACKUP_BYTES) {
      backupRestoreStatus.dataset.state = 'error';
      backupRestoreStatus.textContent = 'That file is too large to be a checklist backup.';
      backupFileInput.value = '';
      return;
    }
    backupRestoreStatus.textContent = 'Checking backup…';
    try {
      const parsed = parsedBackup(JSON.parse(await readFileAsText(file)));
      const stats = progressSnapshotStats(parsed.progress);
      pendingRestore = parsed;
      confirmRestoreBtn.disabled = false;
      backupRestoreStatus.dataset.state = 'success';
      backupRestoreStatus.textContent = `Ready to restore ${stats.collected} collected and ${stats.mastered} mastered choices.`;
    } catch (error) {
      backupRestoreStatus.dataset.state = 'error';
      backupRestoreStatus.textContent = error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message;
      backupFileInput.value = '';
    }
  }

  function updateUndoRestoreButton() {
    undoRestoreBtn.hidden = !safeStorageGet(PRE_RESTORE_PROGRESS_KEY);
  }

  function lockPageForBackupDialog() {
    document.documentElement.classList.add('backup-dialog-open');
    document.body.classList.add('backup-dialog-open');
  }

  function unlockPageForBackupDialog() {
    if (!document.body.classList.contains('backup-dialog-open')) return;
    document.documentElement.classList.remove('backup-dialog-open');
    document.body.classList.remove('backup-dialog-open');
  }

  function openBackupDialog() {
    pendingRestore = null;
    backupFileInput.value = '';
    confirmRestoreBtn.disabled = true;
    backupRestoreStatus.dataset.state = '';
    backupRestoreStatus.textContent = 'No backup selected.';
    updateUndoRestoreButton();
    lockPageForBackupDialog();
    backupDialog.showModal();
  }

  async function restoreSelectedBackup() {
    if (!pendingRestore) return;
    if (journalInitialization) await journalInitialization;
    const safetyCopy = {
      progress:sanitizeProgress(state),
      viewModes:sanitizeViewModes(spriteViewModes),
      seasonView:sanitizeSeasonView(vaultSeasonView),
      journal:normalizeJournalEntries(journalEntries),
      huntMode:sanitizeHuntModeBackup(huntMode),
      huntCart:normalizeHuntCart(huntCart),
      huntHistory:normalizeHuntHistory(huntHistory),
      dustLedger:normalizeDustLedger(dustLedger)
    };
    try {
      localStorage.setItem(PRE_RESTORE_PROGRESS_KEY,JSON.stringify(safetyCopy));
    } catch {
      backupRestoreStatus.dataset.state = 'error';
      backupRestoreStatus.textContent = 'This browser could not create the safety copy, so nothing was restored.';
      return;
    }
    state = pendingRestore.progress;
    spriteViewModes = pendingRestore.viewModes;
    vaultSeasonView = pendingRestore.seasonView;
    huntMode = pendingRestore.huntMode;
    huntCart = pendingRestore.huntCart;
    huntHistory = pendingRestore.huntHistory;
    dustLedger = pendingRestore.dustLedger;
    seasonView = appView === APP_VIEW_VAULT ? vaultSeasonView : CURRENT_SEASON_ID;
    if (!saveProgress()) {
      state = safetyCopy.progress;
      spriteViewModes = safetyCopy.viewModes;
      vaultSeasonView = safetyCopy.seasonView;
      huntMode = safetyCopy.huntMode;
      huntCart = safetyCopy.huntCart;
      huntHistory = safetyCopy.huntHistory;
      dustLedger = safetyCopy.dustLedger;
      return;
    }
    try { localStorage.setItem(VIEW_MODES_KEY,JSON.stringify(spriteViewModes)); } catch { /* Progress is still safely restored. */ }
    try { localStorage.setItem(SEASON_VIEW_KEY,vaultSeasonView); } catch { /* The restored view remains active for this visit. */ }
    saveHuntMode();
    saveHuntCart();
    saveHuntHistory();
    saveDustLedger();
    await replaceJournalEntries(pendingRestore.journal);
    pendingRestore = null;
    backupDialog.close();
    renderAll();
    showToast('Progress restored from backup');
  }

  async function undoLastRestore() {
    const raw = safeStorageGet(PRE_RESTORE_PROGRESS_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      state = sanitizeProgress(saved.progress);
      spriteViewModes = sanitizeViewModes(saved.viewModes);
      vaultSeasonView = sanitizeSeasonView(saved.seasonView);
      huntMode = sanitizeHuntModeBackup(saved.huntMode);
      huntCart = normalizeHuntCart(saved.huntCart);
      huntHistory = normalizeHuntHistory(saved.huntHistory);
      dustLedger = normalizeDustLedger(saved.dustLedger);
      seasonView = appView === APP_VIEW_VAULT ? vaultSeasonView : CURRENT_SEASON_ID;
      if (!saveProgress()) throw new Error('Progress could not be saved.');
      localStorage.setItem(VIEW_MODES_KEY,JSON.stringify(spriteViewModes));
      localStorage.setItem(SEASON_VIEW_KEY,vaultSeasonView);
      saveHuntMode();
      saveHuntCart();
      saveHuntHistory();
      saveDustLedger();
      await replaceJournalEntries(saved.journal || []);
      localStorage.removeItem(PRE_RESTORE_PROGRESS_KEY);
      backupDialog.close();
      renderAll();
      showToast('Last progress restore undone');
    } catch {
      backupRestoreStatus.dataset.state = 'error';
      backupRestoreStatus.textContent = 'The undo copy could not be restored.';
    }
  }

  function showcaseSelection() {
    return {
      status:showcaseStatusSelect.value,
      rarity:showcaseRaritySelect.value,
      season:sanitizeSeasonView(showcaseSeasonSelect.value),
      sort:showcaseSortSelect.value
    };
  }

  function showcaseStatusLabel(status) {
    return {
      collected:'All collected',
      mastered:'Mastered',
      'collected-not-mastered':'Collected, not mastered',
      unowned:'Unowned'
    }[status] || 'Collected';
  }

  function showcaseImageStatusLabel(status) {
    return {
      collected:'Collected',
      mastered:'Mastered',
      'collected-not-mastered':'Collected, Not Mastered',
      unowned:'Unowned'
    }[status] || 'Collected';
  }

  function showcaseStatusMatches(current,status) {
    const collected = current?.collected === true || current?.mastered === true;
    const mastered = current?.mastered === true;
    if (status === 'mastered') return mastered;
    if (status === 'collected-not-mastered') return collected && !mastered;
    if (status === 'unowned') return !collected;
    return collected;
  }

  function percentageNumber(value) {
    const number = Number.parseFloat(String(value || '').replace('%',''));
    return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
  }

  function showcaseEntries(selection = showcaseSelection()) {
    const entries = [];
    allFamilies().forEach((family) => {
      const group = familyView(family);
      const rarity = familyRarity(family);
      if (group.deleted || !group.visible || !rarities.includes(rarity) || !familyMatchesSeason(family,selection.season)) return;
      if (selection.rarity !== 'all' && rarity !== selection.rarity) return;
      variantsForSeason(family,selection.season).forEach((variant) => {
        const current = state[family.id]?.[variant.id] || { collected:false, mastered:false };
        if (!showcaseStatusMatches(current,selection.status)) return;
        const view = variantView(family,variant);
        entries.push({
          familyId:family.id,
          variantId:variant.id,
          groupName:group.name || 'Unnamed Sprite',
          variantName:view.name || 'Unnamed variant',
          rarity,
          rarityPercentage:view.rarityPercentage || '',
          image:displayImageSource(view.image),
          background:displayImageSource(variantBackgroundSource(variant,family)),
          previousSeason:isPreviousSeasonSprite(family,variant),
          collected:current.collected === true || current.mastered === true,
          mastered:current.mastered === true
        });
      });
    });
    if (selection.sort === 'name') {
      entries.sort((a,b) => a.groupName.localeCompare(b.groupName) || a.variantName.localeCompare(b.variantName));
    } else if (selection.sort === 'rarest') {
      entries.sort((a,b) => percentageNumber(a.rarityPercentage) - percentageNumber(b.rarityPercentage)
        || a.groupName.localeCompare(b.groupName)
        || a.variantName.localeCompare(b.variantName));
    }
    return entries;
  }

  function updateShowcaseMatchCount() {
    const entries = showcaseEntries();
    showcaseMatchCount.textContent = `${entries.length} Sprite${entries.length === 1 ? '' : 's'} will be included.`;
    generateShowcaseBtn.disabled = !entries.length;
    return entries;
  }

  function clearShowcaseFile() {
    showcaseGenerationToken += 1;
    if (showcaseObjectUrl) URL.revokeObjectURL(showcaseObjectUrl);
    showcaseObjectUrl = '';
    showcaseFile = null;
    showcasePreview.removeAttribute('src');
    showcasePreviewWrap.hidden = true;
    generateShowcaseBtn.hidden = false;
    shareShowcaseBtn.hidden = true;
  }

  function openShowcaseDialog() {
    clearShowcaseFile();
    showcaseStatusSelect.value = isUnownedPage() ? 'unowned' : 'collected';
    showcaseRaritySelect.value = rarities.includes(activeRarity) ? activeRarity : 'all';
    showcaseSeasonSelect.value = CURRENT_SEASON_ID;
    showcaseSortSelect.value = 'app';
    showcaseStatusMessage.textContent = '';
    showcaseStatusMessage.dataset.state = '';
    updateShowcaseMatchCount();
    document.documentElement.classList.add('showcase-dialog-open');
    document.body.classList.add('showcase-dialog-open');
    showcaseDialog.showModal();
    requestAnimationFrame(() => {
      showcaseStatusSelect.blur();
      document.getElementById('showcaseDialogTitle').focus({ preventScroll:true });
    });
  }

  function roundedPath(context,x,y,width,height,radius) {
    const r = Math.max(0,Math.min(radius,width / 2,height / 2));
    context.beginPath();
    context.moveTo(x + r,y);
    context.lineTo(x + width - r,y);
    context.quadraticCurveTo(x + width,y,x + width,y + r);
    context.lineTo(x + width,y + height - r);
    context.quadraticCurveTo(x + width,y + height,x + width - r,y + height);
    context.lineTo(x + r,y + height);
    context.quadraticCurveTo(x,y + height,x,y + height - r);
    context.lineTo(x,y + r);
    context.quadraticCurveTo(x,y,x + r,y);
    context.closePath();
  }

  function fillRounded(context,x,y,width,height,radius,fillStyle) {
    roundedPath(context,x,y,width,height,radius);
    context.fillStyle = fillStyle;
    context.fill();
  }

  function drawImageCover(context,image,x,y,width,height) {
    const scale = Math.max(width / image.naturalWidth,height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = (image.naturalHeight - sourceHeight) / 2;
    context.drawImage(image,sourceX,sourceY,sourceWidth,sourceHeight,x,y,width,height);
  }

  function drawImageContain(context,image,x,y,width,height,padding = 0) {
    const availableWidth = Math.max(1,width - padding * 2);
    const availableHeight = Math.max(1,height - padding * 2);
    const scale = Math.min(availableWidth / image.naturalWidth,availableHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(image,x + (width - drawWidth) / 2,y + (height - drawHeight) / 2,drawWidth,drawHeight);
  }

  function fitCanvasText(context,text,maxWidth) {
    const value = String(text || '');
    if (context.measureText(value).width <= maxWidth) return value;
    let shortened = value;
    while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0,-1);
    return `${shortened}…`;
  }

  function wrappedCanvasLines(context,text,maxWidth,maxLines = 2) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || context.measureText(candidate).width <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    if (lines.length <= maxLines) return lines;
    const limited = lines.slice(0,maxLines);
    limited[maxLines - 1] = fitCanvasText(context,`${limited[maxLines - 1]}…`,maxWidth);
    return limited;
  }

  function canvasImage(source,cache = null) {
    if (!source) return Promise.resolve(null);
    const resolved = (() => {
      try { return new URL(source,document.baseURI).href; } catch { return source; }
    })();
    if (cache?.has(resolved)) return cache.get(resolved);
    const promise = new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(null),12000);
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      if (/^https?:/i.test(resolved)) image.crossOrigin = 'anonymous';
      image.src = resolved;
    });
    if (cache) cache.set(resolved,promise);
    return promise;
  }

  function releaseCanvasImage(image) {
    if (!image) return;
    image.onload = null;
    image.onerror = null;
    try { image.src = ''; } catch { /* Let the browser release it naturally. */ }
  }

  function canvasBackgroundSurface(source,width,height,cache) {
    if (!source) return Promise.resolve(null);
    const key = `${source}|${Math.ceil(width)}x${Math.ceil(height)}`;
    if (cache.has(key)) return cache.get(key);
    const promise = (async () => {
      const image = await canvasImage(source);
      if (!image) return null;
      const surface = document.createElement('canvas');
      surface.width = Math.max(1,Math.ceil(width));
      surface.height = Math.max(1,Math.ceil(height));
      const surfaceContext = surface.getContext('2d');
      if (!surfaceContext) {
        releaseCanvasImage(image);
        return null;
      }
      drawImageCover(surfaceContext,image,0,0,surface.width,surface.height);
      releaseCanvasImage(image);
      return surface;
    })();
    cache.set(key,promise);
    return promise;
  }

  function rarityColor(rarity) {
    return {
      Rare:'#3c9dff',
      Epic:'#a96dff',
      Legendary:'#ff993f',
      Mythic:'#ffd45f'
    }[rarity] || '#b8c0d9';
  }

  function drawShowcaseBackground(context,width,height) {
    context.fillStyle = '#020207';
    context.fillRect(0,0,width,height);

    const smoke = [
      { x:.14, y:.08, radius:.46, color:'rgba(96,174,255,.30)' },
      { x:.87, y:.19, radius:.42, color:'rgba(190,111,255,.27)' },
      { x:.22, y:.50, radius:.44, color:'rgba(255,112,207,.18)' },
      { x:.82, y:.67, radius:.48, color:'rgba(91,224,255,.22)' },
      { x:.44, y:.92, radius:.50, color:'rgba(255,208,113,.15)' }
    ];
    smoke.forEach((cloud) => {
      const x = width * cloud.x;
      const y = height * cloud.y;
      const radius = width * cloud.radius;
      const glow = context.createRadialGradient(x,y,0,x,y,radius);
      glow.addColorStop(0,cloud.color);
      glow.addColorStop(.42,cloud.color.replace(/,\.[0-9]+\)/,',.10)'));
      glow.addColorStop(1,'rgba(0,0,0,0)');
      context.fillStyle = glow;
      context.fillRect(0,Math.max(0,y - radius),width,Math.min(height,y + radius) - Math.max(0,y - radius));
    });

    const sheen = context.createLinearGradient(0,0,width,height);
    sheen.addColorStop(0,'rgba(255,255,255,.055)');
    sheen.addColorStop(.20,'rgba(255,255,255,0)');
    sheen.addColorStop(.75,'rgba(255,255,255,0)');
    sheen.addColorStop(1,'rgba(145,177,255,.045)');
    context.fillStyle = sheen;
    context.fillRect(0,0,width,height);

    const starCount = Math.min(46,Math.max(20,Math.ceil(height / 360) * 3));
    for (let index = 0; index < starCount; index += 1) {
      const x = (index * 331 + 91) % width;
      const y = (index * 487 + 127) % height;
      const radius = index % 9 === 0 ? 2.3 : 1.1;
      context.globalAlpha = index % 5 === 0 ? .7 : .34;
      context.fillStyle = index % 3 === 0 ? '#c9edff' : '#fff';
      context.beginPath();
      context.arc(x,y,radius,0,Math.PI * 2);
      context.fill();
    }

    [
      [width * .08,height * .17,15],
      [width * .91,height * .36,20],
      [width * .12,height * .73,12],
      [width * .86,height * .88,17]
    ].forEach(([x,y,size]) => {
      context.globalAlpha = .72;
      context.strokeStyle = '#fff';
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(x - size,y);
      context.lineTo(x + size,y);
      context.moveTo(x,y - size);
      context.lineTo(x,y + size);
      context.stroke();
      context.globalAlpha = .26;
      context.beginPath();
      context.arc(x,y,size * .33,0,Math.PI * 2);
      context.fillStyle = '#bfe8ff';
      context.fill();
    });
    context.globalAlpha = 1;
  }

  async function drawShowcaseCard(context,entry,x,y,width,height,backgroundCache) {
    const compact = width < 250;
    const padding = compact ? 9 : 12;
    const radius = compact ? 16 : 20;
    const wellX = x + padding;
    const wellY = y + padding;
    const wellWidth = width - padding * 2;
    const wellHeight = height - (compact ? 116 : 126);
    const groupY = wellY + wellHeight + (compact ? 24 : 30);
    const variantY = groupY + (compact ? 22 : 27);
    fillRounded(context,x,y,width,height,radius,'rgba(23,24,31,.88)');
    context.strokeStyle = entry.mastered ? '#e9c96f' : 'rgba(255,255,255,.2)';
    context.lineWidth = entry.mastered ? 2.5 : 1.25;
    roundedPath(context,x,y,width,height,radius);
    context.stroke();

    context.save();
    roundedPath(context,wellX,wellY,wellWidth,wellHeight,compact ? 11 : 14);
    context.clip();
    const wellGradient = context.createLinearGradient(wellX,wellY,wellX + wellWidth,wellY + wellHeight);
    wellGradient.addColorStop(0,'#242630');
    wellGradient.addColorStop(1,'#111218');
    context.fillStyle = wellGradient;
    context.fillRect(wellX,wellY,wellWidth,wellHeight);
    const background = await canvasBackgroundSurface(entry.background,wellWidth,wellHeight,backgroundCache);
    if (background) context.drawImage(background,wellX,wellY,wellWidth,wellHeight);
    const sprite = await canvasImage(entry.image);
    if (sprite) drawImageContain(context,sprite,wellX,wellY,wellWidth,wellHeight,compact ? 8 : 13);
    else {
      context.fillStyle = 'rgba(255,255,255,.62)';
      context.font = `600 ${compact ? 14 : 18}px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif`;
      context.textAlign = 'center';
      context.fillText('Image unavailable',wellX + wellWidth / 2,wellY + wellHeight / 2);
    }
    context.restore();
    releaseCanvasImage(sprite);

    context.textAlign = 'left';
    context.fillStyle = '#fff';
    context.font = `700 ${compact ? 20 : 27}px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif`;
    context.fillText(fitCanvasText(context,entry.groupName,width - padding * 2),x + padding,groupY);
    context.fillStyle = '#d3d4dd';
    context.font = `600 ${compact ? 13 : 17}px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif`;
    context.fillText(fitCanvasText(context,entry.variantName,width - padding * 2),x + padding,variantY);

    const badgeHeight = compact ? 23 : 28;
    const badgeWidth = compact ? 70 : (entry.rarityPercentage ? 100 : 86);
    const badgeY = y + height - badgeHeight - (compact ? 9 : 12);
    const color = rarityColor(entry.rarity);
    fillRounded(context,x + padding,badgeY,badgeWidth,badgeHeight,badgeHeight / 2,color);
    context.fillStyle = entry.rarity === 'Mythic' ? '#241900' : '#fff';
    context.font = `${compact ? 14 : 17}px "Sprite Display","Arial Black",sans-serif`;
    context.textAlign = 'center';
    context.fillText(entry.rarity,x + padding + badgeWidth / 2,badgeY + badgeHeight * .7);
    if (entry.rarityPercentage) {
      context.fillStyle = '#fff';
      context.font = `700 ${compact ? 11 : 14}px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif`;
      context.textAlign = 'right';
      context.fillText(entry.rarityPercentage,x + width - padding,badgeY + badgeHeight * .7);
    }
    if (entry.mastered) {
      context.fillStyle = '#f2d77c';
      context.font = `700 ${compact ? 18 : 22}px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif`;
      context.textAlign = 'right';
      context.fillText('★',x + width - padding,wellY + (compact ? 21 : 26));
    }
    if (SEASON_FEATURE_VISIBLE && entry.previousSeason) {
      const previousWidth = compact ? 68 : 88;
      const previousHeight = compact ? 20 : 24;
      fillRounded(context,wellX,wellY,previousWidth,previousHeight,previousHeight / 2,'rgba(22,23,29,.82)');
      context.fillStyle = '#e1e2e8';
      context.font = `700 ${compact ? 8 : 11}px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif`;
      context.textAlign = 'center';
      context.fillText('PREVIOUS',wellX + previousWidth / 2,wellY + previousHeight * .7);
    }
  }

  function canvasToBlob(canvas,type,quality) {
    return new Promise((resolve,reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The image could not be prepared.')),type,quality);
    });
  }

  function ensureShowcaseGenerationActive(generationToken) {
    if (generationToken === showcaseGenerationToken) return;
    const error = new Error('Image creation canceled.');
    error.name = 'AbortError';
    throw error;
  }

  async function createShowcaseImage(entries,selection,generationToken) {
    if (entries.length > 120) throw new Error('Choose a narrower filter so the image contains 120 Sprites or fewer.');
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* Use the fallback font. */ }
    }
    ensureShowcaseGenerationActive(generationToken);

    const width = 1080;
    const columns = entries.length <= 18 ? 3 : 4;
    const margin = columns === 3 ? 80 : 58;
    const gap = columns === 3 ? 20 : 14;
    const rowGap = columns === 3 ? 20 : 14;
    const headerHeight = selection.season === CURRENT_SEASON_ID ? 190 : 210;
    const cardWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
    const cardHeight = columns === 3 ? 365 : 285;
    const rows = Math.ceil(entries.length / columns);
    const contentBottom = headerHeight + rows * cardHeight + Math.max(0,rows - 1) * rowGap;
    const footerMinimum = 220;
    const height = Math.max(1350,contentBottom + footerMinimum);
    if (height > 15000 || width * height > 13_500_000) {
      throw new Error('Choose a narrower filter so the portrait image stays within this phone’s safe size.');
    }

    const canvas = document.createElement('canvas');
    const backgroundCache = new Map();
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not open the image creator.');

    try {
      drawShowcaseBackground(context,width,height);

      const rarityLabel = selection.rarity === 'all' ? 'All Rarities' : selection.rarity;
      const selectionLabel = `${showcaseImageStatusLabel(selection.status)} • ${rarityLabel}`;
      context.textAlign = 'center';
      const titleGradient = context.createLinearGradient(width * .3,0,width * .7,0);
      titleGradient.addColorStop(0,'#dff7ff');
      titleGradient.addColorStop(.48,'#ffffff');
      titleGradient.addColorStop(1,'#eadcff');
      context.font = '82px "Sprite Display","Arial Black",sans-serif';
      context.lineJoin = 'round';
      context.lineWidth = 9;
      context.strokeStyle = 'rgba(0,0,0,.82)';
      context.shadowColor = 'rgba(133,207,255,.58)';
      context.shadowBlur = 24;
      context.strokeText('My Sprite Tracker',width / 2,91);
      context.fillStyle = titleGradient;
      context.fillText('My Sprite Tracker',width / 2,91);
      context.shadowBlur = 0;

      context.font = '700 22px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif';
      const subtitle = selectionLabel.toUpperCase();
      const subtitleWidth = Math.min(width - 180,context.measureText(subtitle).width + 72);
      fillRounded(context,(width - subtitleWidth) / 2,119,subtitleWidth,46,23,'rgba(8,10,20,.72)');
      context.strokeStyle = 'rgba(184,221,255,.42)';
      context.lineWidth = 1.5;
      roundedPath(context,(width - subtitleWidth) / 2,119,subtitleWidth,46,23);
      context.stroke();
      context.fillStyle = '#f4f7ff';
      context.fillText(subtitle,width / 2,150);
      if (SEASON_FEATURE_VISIBLE && selection.season !== CURRENT_SEASON_ID) {
        context.fillStyle = '#c6ccda';
        context.font = '700 15px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif';
        context.fillText(seasonViewLabel(selection.season).toUpperCase(),width / 2,190);
      }

      for (let index = 0; index < entries.length; index += 1) {
        ensureShowcaseGenerationActive(generationToken);
        const row = Math.floor(index / columns);
        const firstIndexInRow = row * columns;
        const itemsInRow = Math.min(columns,entries.length - firstIndexInRow);
        const itemInRow = index - firstIndexInRow;
        const rowWidth = itemsInRow * cardWidth + Math.max(0,itemsInRow - 1) * gap;
        const rowStartX = (width - rowWidth) / 2;
        const x = rowStartX + itemInRow * (cardWidth + gap);
        const y = headerHeight + row * (cardHeight + rowGap);
        await drawShowcaseCard(context,entries[index],x,y,cardWidth,cardHeight,backgroundCache);
        if ((index + 1) % 4 === 0 || index === entries.length - 1) {
          showcaseStatusMessage.textContent = `Drawing Sprite ${index + 1} of ${entries.length}…`;
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }

      ensureShowcaseGenerationActive(generationToken);
      const footerCenterY = contentBottom + (height - contentBottom) / 2;
      const link = 'snorkythebeard.github.io/Real-Sprite-Checklist';
      context.textAlign = 'center';
      context.fillStyle = '#e8e7ec';
      context.font = '600 16px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif';
      context.fillText(link,width / 2,footerCenterY - 22);

      const disclaimer = document.querySelector('.fan-content-disclaimer')?.textContent?.trim() || '';
      context.fillStyle = '#aaa9b2';
      context.font = '500 11px "Fredoka","Avenir Next Rounded","Segoe UI",sans-serif';
      const lines = wrappedCanvasLines(context,disclaimer,width - 190,3);
      const disclaimerStartY = footerCenterY + 9;
      lines.forEach((line,index) => context.fillText(line,width / 2,disclaimerStartY + index * 16));

      ensureShowcaseGenerationActive(generationToken);
      return await canvasToBlob(canvas,'image/jpeg',.88);
    } finally {
      for (const surfacePromise of backgroundCache.values()) {
        try {
          const surface = await surfacePromise;
          if (surface) {
            surface.width = 1;
            surface.height = 1;
          }
        } catch { /* The cache is only a performance helper. */ }
      }
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  async function generateShowcaseImage(event) {
    event.preventDefault();
    const selection = showcaseSelection();
    const entries = showcaseEntries(selection);
    if (!entries.length) {
      showcaseStatusMessage.dataset.state = 'error';
      showcaseStatusMessage.textContent = 'No Sprites match those choices yet.';
      return;
    }
    clearShowcaseFile();
    const generationToken = showcaseGenerationToken;
    generateShowcaseBtn.disabled = true;
    showcaseStatusMessage.dataset.state = '';
    showcaseStatusMessage.textContent = `Creating an image with ${entries.length} Sprites…`;
    try {
      const blob = await createShowcaseImage(entries,selection,generationToken);
      ensureShowcaseGenerationActive(generationToken);
      const statusSlug = selection.status.replace(/[^a-z0-9]+/g,'-');
      const raritySlug = selection.rarity === 'all' ? 'all-rarities' : selection.rarity.toLowerCase();
      const filename = `my-sprite-tracker-${statusSlug}-${raritySlug}-${selection.season}-season.jpg`;
      showcaseFile = new File([blob],filename,{ type:'image/jpeg' });
      showcaseObjectUrl = URL.createObjectURL(showcaseFile);
      showcasePreview.src = showcaseObjectUrl;
      showcasePreviewWrap.hidden = false;
      generateShowcaseBtn.hidden = true;
      let canShare = false;
      try { canShare = Boolean(navigator.share && navigator.canShare?.({ files:[showcaseFile] })); } catch { canShare = false; }
      shareShowcaseBtn.hidden = !canShare;
      showcaseStatusMessage.dataset.state = 'success';
      showcaseStatusMessage.textContent = 'Your collection image is ready.';
    } catch (error) {
      if (error?.name === 'AbortError') return;
      showcaseStatusMessage.dataset.state = 'error';
      showcaseStatusMessage.textContent = error.message || 'The image could not be created.';
    } finally {
      if (generationToken === showcaseGenerationToken) generateShowcaseBtn.disabled = false;
    }
  }

  async function shareShowcaseImage() {
    if (!showcaseFile || !navigator.share) return;
    try {
      await navigator.share({
        title:'My Sprite Tracker collection',
        text:'My Sprite Tracker collection',
        files:[showcaseFile]
      });
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Sharing is not available in this browser.');
    }
  }

  function resetProgress() {
    state = {};
    recentMissingChanges = { unowned:[], unmastered:[] };
    try { sessionStorage.removeItem(RECENT_MISSING_KEY); } catch { /* Nothing else to clear. */ }
    saveProgress();
    resetDialog.close();
    renderAll();
    showToast('Checklist progress reset');
  }

  function setSpriteEditMode(enabled) {
    if (isUnownedPage() || appView === APP_VIEW_VAULT) return showToast('Open a rarity page in Current Tracker to edit Sprite cards.');
    spriteEditMode = Boolean(enabled);
    document.body.classList.toggle('sprite-edit-mode',spriteEditMode);
    spriteEditorToggle.setAttribute('aria-pressed',String(spriteEditMode));
    spriteEditorToggle.textContent = spriteEditMode ? 'Done editing' : 'Edit sprites';
    renderCollections();
    updateCounters();
    showToast(spriteEditMode ? 'Sprite editing on' : 'Sprite editing off');
  }

  function updatePageModeControls() {
    const unownedPage = isUnownedPage();
    const vaultPage = appView === APP_VIEW_VAULT;
    document.body.classList.toggle('unowned-page',unownedPage);
    spriteEditorToggle.hidden = unownedPage || vaultPage;
    addSpriteGroupBtn.hidden = unownedPage || vaultPage || seasonView !== CURRENT_SEASON_ID;
    publishSpritesBtn.hidden = vaultPage;
    if ((!unownedPage && !vaultPage) || !spriteEditMode) return;
    spriteEditMode = false;
    document.body.classList.remove('sprite-edit-mode');
    spriteEditorToggle.setAttribute('aria-pressed','false');
    spriteEditorToggle.textContent = 'Edit sprites';
  }

  appMenuBtn.addEventListener('click',openAppMenu);
  closeAppMenuBtn.addEventListener('click',closeAppMenu);
  appMenuDialog.addEventListener('close',() => {
    appMenuBtn.setAttribute('aria-expanded','false');
    unlockPageForAppMenu();
  });
  appMenuDialog.addEventListener('cancel',() => {
    appMenuBtn.setAttribute('aria-expanded','false');
  });
  appMenuDialog.addEventListener('click',(event) => {
    if (event.target === appMenuDialog) closeAppMenu();
  });
  document.querySelectorAll('[data-app-view]').forEach((button) => {
    button.addEventListener('click',() => setAppView(button.dataset.appView));
  });
  journalActionFilter.addEventListener('change',renderJournal);
  clearJournalActivityBtn.addEventListener('click',clearJournalActivity);
  huntModeBtn.addEventListener('click',toggleHuntMode);
  huntModeBtn.addEventListener('pointerup',() => requestAnimationFrame(() => huntModeBtn.blur()));
  huntCheckoutBtn.addEventListener('click',openHuntCheckout);
  huntCheckoutForm.addEventListener('submit',completeHuntOrder);
  document.getElementById('continueHuntBtn').addEventListener('click',resumeHuntFromCheckout);
  huntCheckoutDialog.addEventListener('cancel',(event) => {
    event.preventDefault();
    resumeHuntFromCheckout();
  });
  huntCheckoutDialog.addEventListener('close',() => {
    document.documentElement.classList.remove('hunt-checkout-open');
    document.body.classList.remove('hunt-checkout-open');
  });
  floatingHomeBtn.addEventListener('click',() => goHomeToRare());
  spriteDustBalanceBtn.addEventListener('click',() => setAppView(APP_VIEW_DUST));
  document.getElementById('clearHuntHistoryBtn').addEventListener('click',() => {
    if (!huntHistory.length || !window.confirm('Delete your entire Hunt History? Sprite Dust receipts will stay in the account.')) return;
    huntHistory = [];
    saveHuntHistory();
    renderHuntHistory();
    showToast('Hunt History cleared');
  });
  document.getElementById('recordDustPurchaseBtn').addEventListener('click',openDustPurchaseDialog);
  document.getElementById('editDustBalanceBtn').addEventListener('click',openDustBalanceDialog);
  dustBalanceForm.addEventListener('submit',saveDustBalance);
  document.getElementById('cancelDustBalanceBtn').addEventListener('click',() => dustBalanceDialog.close());
  dustBalanceDialog.addEventListener('close',() => {
    document.documentElement.classList.remove('dust-balance-open');
    document.body.classList.remove('dust-balance-open');
  });
  collectionCountResetForm.addEventListener('submit',resetCollectionCount);
  document.getElementById('cancelCollectionCountResetBtn').addEventListener('click',() => collectionCountResetDialog.close());
  collectionCountResetDialog.addEventListener('close',() => {
    pendingCollectionCountReset = null;
    document.documentElement.classList.remove('collection-count-reset-open');
    document.body.classList.remove('collection-count-reset-open');
  });
  dustPurchaseForm.addEventListener('submit',recordDustPurchase);
  document.getElementById('cancelDustPurchaseBtn').addEventListener('click',() => dustPurchaseDialog.close());
  dustPurchaseDialog.addEventListener('close',() => {
    document.documentElement.classList.remove('dust-purchase-open');
    document.body.classList.remove('dust-purchase-open');
  });
  document.addEventListener('visibilitychange',() => {
    if (!document.hidden && huntMode.active) updateHuntTimer();
  });
  locationFoundForm.addEventListener('submit',saveLocationDetails);
  document.getElementById('skipLocationFoundBtn').addEventListener('click',closeLocationDetails);
  locationFoundDialog.addEventListener('close',() => {
    pendingLocationDetails = null;
    document.documentElement.classList.remove('journal-dialog-open');
    document.body.classList.remove('journal-dialog-open');
  });
  seasonViewSelect.addEventListener('change',() => setSeasonView(seasonViewSelect.value));
  showcaseBtn.addEventListener('click',openShowcaseDialog);
  showcaseForm.addEventListener('submit',generateShowcaseImage);
  [showcaseStatusSelect,showcaseRaritySelect,showcaseSeasonSelect,showcaseSortSelect].forEach((select) => {
    select.addEventListener('change',() => {
      clearShowcaseFile();
      showcaseStatusMessage.textContent = '';
      showcaseStatusMessage.dataset.state = '';
      updateShowcaseMatchCount();
    });
  });
  document.getElementById('closeShowcaseBtn').addEventListener('click',() => showcaseDialog.close());
  shareShowcaseBtn.addEventListener('click',shareShowcaseImage);
  showcaseDialog.addEventListener('close',() => {
    clearShowcaseFile();
    document.documentElement.classList.remove('showcase-dialog-open');
    document.body.classList.remove('showcase-dialog-open');
  });
  backupBtn.addEventListener('click',openBackupDialog);
  document.getElementById('backupRestoreForm').addEventListener('submit',(event) => event.preventDefault());
  document.getElementById('downloadBackupBtn').addEventListener('click',downloadProgressBackup);
  backupFileInput.addEventListener('change',() => prepareBackupRestore(backupFileInput.files?.[0]));
  confirmRestoreBtn.addEventListener('click',restoreSelectedBackup);
  undoRestoreBtn.addEventListener('click',undoLastRestore);
  document.getElementById('closeBackupBtn').addEventListener('click',() => backupDialog.close());
  backupDialog.addEventListener('close',unlockPageForBackupDialog);

  spriteSearchInput.addEventListener('input',renderSpriteSearchResults);
  spriteSearchInput.addEventListener('focus',() => {
    if (spriteSearchInput.value.trim()) renderSpriteSearchResults();
  });
  spriteSearchInput.addEventListener('keydown',(event) => {
    if (event.key === 'Escape') {
      closeSpriteSearchResults();
      spriteSearchInput.blur();
    }
    if (event.key === 'ArrowDown' && !spriteSearchResults.hidden) {
      const first = spriteSearchResults.querySelector('.sprite-search-result');
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  spriteSearchResults.addEventListener('keydown',(event) => {
    if (!['ArrowDown','ArrowUp','Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') {
      closeSpriteSearchResults();
      return spriteSearchInput.focus();
    }
    const options = [...spriteSearchResults.querySelectorAll('.sprite-search-result')];
    const current = options.indexOf(document.activeElement);
    const offset = event.key === 'ArrowDown' ? 1 : -1;
    options[(current + offset + options.length) % options.length]?.focus();
  });
  spriteSearchForm.addEventListener('submit',(event) => {
    event.preventDefault();
    const matches = findSpriteMatches(spriteSearchInput.value);
    if (matches[0]) {
      if (huntMode.active) addSpriteSearchResultToHunt(matches[0]);
      else openSpriteSearchResult(matches[0]);
    }
    else {
      renderSpriteSearchResults();
      spriteSearchStatus.textContent = 'No matching sprites';
    }
  });
  clearSpriteSearchBtn.addEventListener('click',() => {
    spriteSearchInput.value = '';
    closeSpriteSearchResults();
    clearSpriteSearchBtn.hidden = true;
    spriteSearchStatus.textContent = 'Search cleared';
    spriteSearchInput.focus();
  });
  document.addEventListener('pointerdown',(event) => {
    if (!event.target.closest('.sprite-search')) closeSpriteSearchResults();
  });
  spriteEditorToggle.addEventListener('click',() => setSpriteEditMode(!spriteEditMode));
  spriteViewToggle.addEventListener('click',() => setSpriteViewMode(currentSpriteViewMode() === 'list' ? 'card' : 'list'));
  addSpriteGroupBtn.addEventListener('click',openAddSpriteGroupDialog);
  publishSpritesBtn.addEventListener('click',openPublishSpritesDialog);
  publishSpritesForm.addEventListener('submit',async (event) => {
    event.preventDefault();
    const token = githubTokenInput.value.trim();
    if (!token) return setPublishStatus('Paste a GitHub token first.','error');
    try { sessionStorage.setItem(GITHUB_TOKEN_SESSION_KEY,token); } catch { /* The token can remain in the input for this tab. */ }
    setPublishBusy(true);
    setPublishStatus('Publishing sprite changes to GitHub…');
    let published = false;
    try {
      const commitSha = await publishSpriteChanges(token);
      const link = document.createElement('a');
      link.href = `https://github.com/${GITHUB_PUBLISH_TARGET.owner}/${GITHUB_PUBLISH_TARGET.repo}/commit/${commitSha}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'View the GitHub commit';
      publishSpritesStatus.replaceChildren(document.createTextNode('Published. The public site should update shortly. '),link);
      publishSpritesStatus.dataset.state = 'success';
      showToast('Sprite changes published');
      published = true;
    } catch (error) {
      setPublishStatus(githubPublishError(error),'error');
    } finally {
      setPublishBusy(false);
      if (published) {
        const submit = document.getElementById('confirmPublishSpritesBtn');
        submit.disabled = true;
        submit.textContent = 'Published';
      }
    }
  });
  document.getElementById('cancelPublishSpritesBtn').addEventListener('click',() => publishSpritesDialog.close());
  addSpriteForm.addEventListener('submit',(event) => {
    event.preventDefault();
    const family = allFamilies().find((item) => item.id === addSpriteFamilyId.value);
    const name = newSpriteName.value.trim();
    if (!family || !name) return;
    const id = addSpriteCard(family,name);
    if (!id) return;
    addSpriteDialog.close();
    renderTabs();
    renderCollections();
    updateCounters();
    showToast(`${name} sprite card added — tap its image area to upload artwork`);
  });
  document.getElementById('cancelAddSpriteBtn').addEventListener('click',() => addSpriteDialog.close());
  addSpriteGroupForm.addEventListener('submit',(event) => {
    event.preventDefault();
    const name = newSpriteGroupName.value.trim();
    if (!name) return;
    const id = addSpriteGroup(name);
    if (!id) return;
    addSpriteGroupDialog.close();
    renderTabs();
    renderCollections();
    updateCounters();
    document.querySelector(`.collection[data-family-id="${id}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' });
    showToast(`${name} added to ${activeRarity} — upload the Base sprite image`);
  });
  document.getElementById('cancelAddSpriteGroupBtn').addEventListener('click',() => addSpriteGroupDialog.close());
  window.addEventListener('hashchange',() => {
    const hashView = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    if (hashView === APP_VIEW_VAULT) {
      setAppView(APP_VIEW_VAULT,{ announce:false });
      return;
    }
    if (hashView === APP_VIEW_JOURNAL) {
      setAppView(APP_VIEW_JOURNAL,{ announce:false });
      return;
    }
    if (hashView === APP_VIEW_HUNTS) {
      setAppView(APP_VIEW_HUNTS,{ announce:false });
      return;
    }
    if (hashView === APP_VIEW_DUST) {
      setAppView(APP_VIEW_DUST,{ announce:false });
      return;
    }
    if (appView !== APP_VIEW_TRACKER) setAppView(APP_VIEW_TRACKER,{ announce:false });
    if (hashView === 'unowned' || hashView === 'unmastered') missingView = hashView;
    switchRarity(rarityFromHash() || defaultRarity);
  });
  document.getElementById('resetBtn').addEventListener('click',() => resetDialog.showModal());
  document.getElementById('confirmResetBtn').addEventListener('click',resetProgress);

  journalInitialization = initializeJournal();
  renderAll();
  const activeHash = appView === APP_VIEW_VAULT
    ? '#vault'
    : (appView === APP_VIEW_JOURNAL
        ? '#journal'
        : (appView === APP_VIEW_HUNTS
            ? '#hunts'
            : (appView === APP_VIEW_DUST
                ? '#dust'
                : (isUnownedPage() ? `#${missingView}` : `#${activeRarity.toLowerCase()}`))));
  if (location.hash !== activeHash) history.replaceState({ rarity:activeRarity },'',activeHash);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js?v=119',{ updateViaCache:'none' }).then((registration) => registration.update()).catch(() => {});
  }
  const signalAppRendered = () => window.dispatchEvent(new Event('sprite-app-rendered'));
  if (document.fonts?.ready) {
    Promise.race([
      document.fonts.ready,
      new Promise((resolve) => window.setTimeout(resolve,450))
    ]).then(signalAppRendered,signalAppRendered);
  } else {
    signalAppRendered();
  }
})();
