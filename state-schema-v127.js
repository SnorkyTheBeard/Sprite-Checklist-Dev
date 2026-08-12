(() => {
  'use strict';

  const FORMAT = 'my-sprite-tracker-state';
  const SCHEMA_VERSION = 1;
  const DEFAULT_SEASON_ID = 'chapter-7-season-3';
  const RARITIES = new Set(['Rare','Epic','Legendary','Mythic']);

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function cloneJson(value,fallback) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch { return fallback; }
  }

  function cleanText(value,maximum = 200) {
    return String(value || '').trim().slice(0,maximum);
  }

  function cleanId(value,fallback = '') {
    const id = cleanText(value,200);
    return id && !['__proto__','prototype','constructor'].includes(id) ? id : fallback;
  }

  function validIsoDate(value) {
    if (typeof value !== 'string' || !value || value.length > 40) return '';
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : '';
  }

  function stableSpriteId(familyId,variantId) {
    const family = cleanId(familyId,'unknown-family');
    const variant = cleanId(variantId,'unknown-variant');
    return `sprite:${encodeURIComponent(family)}:${encodeURIComponent(variant)}`;
  }

  function safeAssetReference(value) {
    const reference = cleanText(value,2048);
    if (!reference) return { reference:'', storage:'' };
    if (/^(?:data|blob):/i.test(reference)) return { reference:'', storage:'legacy-browser' };
    return { reference, storage:'repository' };
  }

  function normalizeDustLevels(value) {
    const source = isRecord(value) ? value : {};
    return Object.fromEntries([1,2,3,4,5].flatMap((level) => {
      const amount = Number(source[level] ?? source[String(level)]);
      return Number.isFinite(amount) && amount >= 0 ? [[String(level),Math.min(1000000,Math.round(amount))]] : [];
    }));
  }

  function normalizeSeasons(value,currentSeasonId) {
    const seasons = [];
    const seen = new Set();
    (Array.isArray(value) ? value : []).forEach((season,index) => {
      const id = cleanId(season?.id);
      if (!id || seen.has(id)) return;
      seen.add(id);
      seasons.push({
        id,
        label:cleanText(season?.label,100) || id,
        sortOrder:index
      });
    });
    if (!seen.has(currentSeasonId)) {
      seasons.unshift({ id:currentSeasonId, label:currentSeasonId, sortOrder:0 });
      seasons.forEach((season,index) => { season.sortOrder = index; });
    }
    return seasons;
  }

  function normalizeCatalog(input,currentSeasonId) {
    const families = [];
    const variants = [];
    const seenFamilies = new Set();
    const seenSprites = new Set();

    (Array.isArray(input.families) ? input.families : []).forEach((family,familyIndex) => {
      const familyId = cleanId(family?.id);
      if (!familyId || seenFamilies.has(familyId)) return;
      seenFamilies.add(familyId);
      const seasonId = cleanId(family?.seasonId,currentSeasonId);
      const rarity = RARITIES.has(family?.rarity) ? family.rarity : cleanText(family?.rarity,40);
      const familyRecord = {
        id:familyId,
        name:cleanText(family?.name,100) || familyId,
        rarity,
        seasonId,
        visible:family?.visible !== false,
        deleted:family?.deleted === true,
        custom:family?.custom === true,
        sortOrder:Number.isFinite(Number(family?.sortOrder)) ? Number(family.sortOrder) : familyIndex,
        variantIds:[]
      };

      (Array.isArray(family?.variants) ? family.variants : []).forEach((variant,variantIndex) => {
        const variantId = cleanId(variant?.id);
        if (!variantId) return;
        const spriteId = stableSpriteId(familyId,variantId);
        if (seenSprites.has(spriteId)) return;
        seenSprites.add(spriteId);
        const asset = safeAssetReference(variant?.image);
        const variantSeasonId = cleanId(variant?.seasonId,seasonId);
        familyRecord.variantIds.push(spriteId);
        variants.push({
          id:spriteId,
          familyId,
          variantId,
          name:cleanText(variant?.name,100) || variantId,
          rarity,
          seasonId:variantSeasonId,
          visible:variant?.visible !== false,
          deleted:variant?.deleted === true,
          sortOrder:Number.isFinite(Number(variant?.sortOrder)) ? Number(variant.sortOrder) : variantIndex,
          rarityPercentage:cleanText(variant?.rarityPercentage,40),
          dustLevels:normalizeDustLevels(variant?.dustLevels),
          imageRef:asset.reference,
          imageStorage:asset.storage
        });
      });
      families.push(familyRecord);
    });

    return {
      currentSeasonId,
      seasons:normalizeSeasons(input.seasons,currentSeasonId),
      families,
      variants,
      editor:{
        localFamilyIds:Array.isArray(input.editor?.localFamilyIds)
          ? input.editor.localFamilyIds.map((id) => cleanId(id)).filter(Boolean).slice(0,500)
          : [],
        editedFamilyIds:Array.isArray(input.editor?.editedFamilyIds)
          ? input.editor.editedFamilyIds.map((id) => cleanId(id)).filter(Boolean).slice(0,500)
          : [],
        hasUnpublishedChanges:input.editor?.hasUnpublishedChanges === true
      }
    };
  }

  function normalizeCollection(progress,catalog,currentSeasonId) {
    const collection = {};
    const catalogBySprite = new Map(catalog.variants.map((variant) => [variant.id,variant]));

    catalog.variants.forEach((variant) => {
      collection[variant.id] = {
        spriteId:variant.id,
        familyId:variant.familyId,
        variantId:variant.variantId,
        seasonId:variant.seasonId,
        collected:false,
        mastered:false,
        collectedAt:'',
        masteredAt:'',
        locationFound:'',
        orphaned:false
      };
    });

    Object.entries(isRecord(progress) ? progress : {}).forEach(([rawFamilyId,variants]) => {
      const familyId = cleanId(rawFamilyId);
      if (!familyId || !isRecord(variants)) return;
      Object.entries(variants).forEach(([rawVariantId,current]) => {
        const variantId = cleanId(rawVariantId);
        if (!variantId || !isRecord(current)) return;
        const spriteId = stableSpriteId(familyId,variantId);
        const catalogVariant = catalogBySprite.get(spriteId);
        const mastered = current.mastered === true;
        collection[spriteId] = {
          spriteId,
          familyId,
          variantId,
          seasonId:catalogVariant?.seasonId || currentSeasonId,
          collected:current.collected === true || mastered,
          mastered,
          collectedAt:validIsoDate(current.collectedAt),
          masteredAt:mastered ? validIsoDate(current.masteredAt) : '',
          locationFound:cleanText(current.locationFound,80),
          orphaned:!catalogVariant
        };
      });
    });
    return collection;
  }

  function normalizeJournal(entries) {
    return (Array.isArray(entries) ? entries : []).slice(0,500).flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const familyId = cleanId(entry.familyId);
      const variantId = cleanId(entry.variantId);
      const id = cleanId(entry.id);
      if (!familyId || !variantId || !id) return [];
      const hadPhoto = typeof entry.memoryPhoto === 'string' && Boolean(entry.memoryPhoto);
      const withoutPhoto = Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'memoryPhoto'));
      const copy = cloneJson(withoutPhoto,{});
      copy.id = id;
      copy.spriteId = stableSpriteId(familyId,variantId);
      copy.memoryPhotoRef = hadPhoto ? `legacy-journal:${encodeURIComponent(id)}` : '';
      return [copy];
    });
  }

  function normalizeRunItem(item) {
    if (!isRecord(item)) return null;
    const familyId = cleanId(item.familyId);
    const variantId = cleanId(item.variantId);
    if (!familyId || !variantId) return null;
    return {
      ...cloneJson(item,{}),
      familyId,
      variantId,
      spriteId:stableSpriteId(familyId,variantId)
    };
  }

  function normalizeRuns(input) {
    const cart = (Array.isArray(input.huntCart) ? input.huntCart : [])
      .map(normalizeRunItem).filter(Boolean).slice(0,250);
    const history = (Array.isArray(input.huntHistory) ? input.huntHistory : []).slice(0,300).flatMap((run) => {
      if (!isRecord(run)) return [];
      return [{
        ...cloneJson(run,{}),
        items:(Array.isArray(run.items) ? run.items : []).map(normalizeRunItem).filter(Boolean).slice(0,250)
      }];
    });
    return {
      active:cloneJson(input.huntMode,{}),
      cart,
      history
    };
  }

  function calculateDustBalance(entries) {
    return (Array.isArray(entries) ? entries : []).reduce((balance,entry) => {
      if (!isRecord(entry)) return balance;
      const amount = Math.max(0,Math.round(Number(entry.amount) || 0));
      const outgoing = entry.type === 'purchase' || entry.type === 'adjustment-out';
      return balance + (outgoing ? -amount : amount);
    },0);
  }

  function previousPlayerSection(previous,name,fallback) {
    if (previous?.format !== FORMAT || previous?.schemaVersion !== SCHEMA_VERSION) return fallback;
    return cloneJson(previous.player?.[name],fallback);
  }

  function buildShadowState(input,previous = null) {
    const source = isRecord(input) ? input : {};
    const now = new Date().toISOString();
    const scope = cleanId(source.scope,'root');
    const currentSeasonId = cleanId(source.currentSeasonId,DEFAULT_SEASON_ID);
    const catalog = normalizeCatalog(source,currentSeasonId);
    const collection = normalizeCollection(source.progress,catalog,currentSeasonId);
    const dustLedger = cloneJson(Array.isArray(source.dustLedger) ? source.dustLedger : [],[]).slice(0,1000);
    const journal = source.journalReady === false
      ? previousPlayerSection(previous,'journal',{ entries:[] })
      : { entries:normalizeJournal(source.journalEntries) };
    const profile = previousPlayerSection(previous,'profile',{
      id:'local-device',
      displayName:'',
      username:'',
      avatarRef:'',
      meadowCode:'',
      privacy:'private'
    });

    const snapshot = {
      format:FORMAT,
      schemaVersion:SCHEMA_VERSION,
      createdAt:validIsoDate(previous?.createdAt) || now,
      updatedAt:now,
      scope,
      migration:{
        mode:'shadow',
        source:'legacy-browser-storage',
        sourceBackupVersion:4,
        sourceOfTruth:'legacy-v126',
        migratedAt:now
      },
      catalog,
      player:{
        profile,
        collection,
        dust:{ balance:Math.max(0,calculateDustBalance(dustLedger)), ledger:dustLedger },
        journal,
        spriteRuns:normalizeRuns(source),
        preferences:{
          viewModes:cloneJson(isRecord(source.viewModes) ? source.viewModes : {},{}),
          missingView:source.missingView === 'unmastered' ? 'unmastered' : 'unowned',
          seasonView:cleanId(source.seasonView,currentSeasonId),
          experience:cloneJson(isRecord(source.experience) ? source.experience : {},{})
        },
        social:previousPlayerSection(previous,'social',{ friends:[], incomingRequests:[], outgoingRequests:[] }),
        showcase:previousPlayerSection(previous,'showcase',{ favoriteSpriteIds:[], topSpriteIds:[] }),
        valley:previousPlayerSection(previous,'valley',{ layoutVersion:1, placements:[] })
      },
      compatibility:{
        shadowOnly:true,
        legacyDataPreserved:true,
        writesBackToLegacy:false
      }
    };

    const report = validate(snapshot);
    snapshot.diagnostics = { valid:report.valid, stats:report.stats, warnings:report.warnings };
    if (!report.valid) throw new Error(`Future state validation failed: ${report.errors.join(' ')}`);
    return snapshot;
  }

  function validate(snapshot) {
    const errors = [];
    const warnings = [];
    if (!isRecord(snapshot) || snapshot.format !== FORMAT) errors.push('Unknown state format.');
    if (snapshot?.schemaVersion !== SCHEMA_VERSION) errors.push('Unsupported schema version.');
    const families = Array.isArray(snapshot?.catalog?.families) ? snapshot.catalog.families : [];
    const variants = Array.isArray(snapshot?.catalog?.variants) ? snapshot.catalog.variants : [];
    const familyIds = new Set();
    const spriteIds = new Set();
    families.forEach((family) => {
      if (!family?.id || familyIds.has(family.id)) errors.push(`Duplicate or missing family ID: ${family?.id || '(blank)'}.`);
      else familyIds.add(family.id);
    });
    variants.forEach((variant) => {
      if (!variant?.id || spriteIds.has(variant.id)) errors.push(`Duplicate or missing Sprite ID: ${variant?.id || '(blank)'}.`);
      else spriteIds.add(variant.id);
      if (!familyIds.has(variant?.familyId)) errors.push(`Sprite ${variant?.id || '(blank)'} has no family.`);
      if (variant?.id !== stableSpriteId(variant?.familyId,variant?.variantId)) errors.push(`Sprite ${variant?.id || '(blank)'} has an unstable ID.`);
    });
    const collection = isRecord(snapshot?.player?.collection) ? snapshot.player.collection : {};
    let collected = 0;
    let mastered = 0;
    let orphaned = 0;
    Object.entries(collection).forEach(([spriteId,current]) => {
      if (current?.spriteId !== spriteId) errors.push(`Collection key ${spriteId} does not match its Sprite ID.`);
      if (current?.mastered === true && current?.collected !== true) errors.push(`Mastered Sprite ${spriteId} is not collected.`);
      collected += current?.collected === true ? 1 : 0;
      mastered += current?.mastered === true ? 1 : 0;
      orphaned += current?.orphaned === true ? 1 : 0;
    });
    if (orphaned) warnings.push(`${orphaned} legacy progress record${orphaned === 1 ? '' : 's'} no longer match the active catalog but remain preserved.`);
    return {
      valid:errors.length === 0,
      errors,
      warnings,
      stats:{
        seasons:Array.isArray(snapshot?.catalog?.seasons) ? snapshot.catalog.seasons.length : 0,
        families:families.length,
        sprites:variants.length,
        collectionRecords:Object.keys(collection).length,
        collected,
        mastered,
        orphaned,
        journalEntries:Array.isArray(snapshot?.player?.journal?.entries) ? snapshot.player.journal.entries.length : 0,
        spriteRuns:Array.isArray(snapshot?.player?.spriteRuns?.history) ? snapshot.player.spriteRuns.history.length : 0,
        dustBalance:Number(snapshot?.player?.dust?.balance) || 0
      }
    };
  }

  window.SPRITE_STATE_SCHEMA = Object.freeze({
    FORMAT,
    SCHEMA_VERSION,
    stableSpriteId,
    calculateDustBalance,
    buildShadowState,
    validate
  });
})();
