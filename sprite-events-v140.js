(() => {
  'use strict';

  // In-app events are checked whenever the tracker opens or returns to the foreground.
  // Add future confirmed events as date ranges; the app will show each occurrence once.
  window.SPRITE_EVENTS = Object.freeze([
    Object.freeze({
      id:'mastery-monday',
      title:'Mastery Monday',
      description:'Mastery Monday is active. This is a friendly tracker reminder; check Fortnite for the current official event details and times.',
      enabled:true,
      schedule:Object.freeze({ type:'weekly',day:1,startHour:0,durationHours:24 })
    })
  ]);
})();
