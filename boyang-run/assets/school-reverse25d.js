/* BOYANG RUN · HD illustrated reverse school walkway, v0.1.0-beta.9.
 * Ten original-resolution 1448x1086 WebP scenes replace the old 400x300 atlas.
 * Each image is loaded independently by the nearby-scene preloader. */
(()=>{'use strict';
const BASE='./assets/scenes/school-reverse-hd/';
const frames=Array.from({length:10},(_,i)=>BASE+'school-reverse-'+String(i+1).padStart(2,'0')+'-v9.webp');
function subscribe(fn){if(typeof fn==='function')fn(frames.slice());}
window.BOYANG_REVERSE25D={
 get ready(){return true;},
 get frames(){return frames.slice();},
 get error(){return null;},
 get asset(){return frames[0];},
 get version(){return '0.1.0-beta.9';},
 subscribe
};
})();