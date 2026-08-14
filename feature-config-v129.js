/*
  V129 feature controls

  Available states:
    public       Everyone can open the finished feature.
    coming-soon  Everyone sees the menu item, but opens the Coming Soon page.
    preview      Only approved owner accounts can see and open the feature.
    hidden       Hidden from the public; approved owners can still preview it.

  Preview access is tied to a signed-in Supabase user ID, not a browser flag.
  Add the owner's Supabase Auth user UUID to ownerUserIds when it is available.
  User IDs are identifiers, not passwords or secret/service-role keys.
*/
window.SPRITE_FEATURE_CONFIG = Object.freeze({
  ownerUserIds:Object.freeze([
    /* '00000000-0000-0000-0000-000000000000' */
  ]),
  features:Object.freeze({
    spriteVault:Object.freeze({
      state:'public',
      label:'Sprite Archive',
      route:'vault',
      implemented:true
    }),
    collectionJournal:Object.freeze({
      state:'public',
      label:'Collection History',
      route:'journal',
      implemented:true
    }),
    spriteRunHistory:Object.freeze({
      state:'hidden',
      label:'Sprite Assistant',
      route:'adventure',
      implemented:false
    }),
    spriteDust:Object.freeze({
      state:'public',
      label:'Sprite Dust',
      route:'dust',
      implemented:true
    }),
    sheetView:Object.freeze({
      state:'public',
      label:'Sheet View',
      implemented:true
    }),
    profiles:Object.freeze({
      state:'public',
      label:'Profiles',
      route:'profile',
      implemented:true
    }),
    topFiveFavorites:Object.freeze({
      state:'hidden',
      label:'Top 5 Favorites',
      eyebrow:'Your favorite Sprites',
      message:'Choose and share the five Sprites that mean the most to you.',
      implemented:false
    })
  })
});
