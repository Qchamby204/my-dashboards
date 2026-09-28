/* Decorative topic emblems. No charts or factual data are encoded in these drawings. */
(() => {
'use strict';
const art={
 '1':'<path d="M16 70h130M25 65V49h16V65M54 65V34h16V65M83 65V44h16V65M112 65V17h16V65"/><path class="art-motion" d="m20 38 32-17 28 9 48-22m-12 0h12v12"/>',
 '2':'<circle cx="80" cy="44" r="31"/><path d="M80 7v9m0 56v10M43 44h9m56 0h10"/><path class="art-motion" d="m94 26-7 25-22 12 8-26z"/><path d="M17 57h14m-11 8h14m94-42h14m-17 8h14"/>',
 '3':'<path d="m14 36 18-12 25 14m89-2-18-12-25 14M33 27l29-10 18 5 17-5 30 10M35 55l32 24 11-6m-9-12 16 13 11-8m-15-13 19 13 11-9m-16-15 19 15 13-16"/><path class="art-motion" d="m103 37-21-9-24 16 9 9 18-10 17 8"/>',
 '4':'<path d="m34 37 47-18v50L34 52zM34 37H22v15h12m10 5 6 20h14l-6-25"/><path class="art-motion" d="m98 24 15-10M100 43h23M97 61l16 11"/><path d="M130 72V48m10 24V35m10 37V19"/>',
 '5':'<path d="M15 16h76v40H48L27 73V56H15zM104 31h38v39h-15l-14 12V70H90"/><path class="art-motion" d="M29 30h48M29 42h34M108 44h21M105 56h24"/>',
 '6':'<path d="M59 14v17h10V14h22v17h10V14h13v30l-9 9 5 20H63l5-20-9-9V14zM55 79h63"/><path class="art-motion" d="M18 34h24v24m0-24-9 9M18 67h20m89-14h19V26m-9 9 9-9 9 9"/>',
 '7':'<path d="M77 74c-16 9-29-3-27-15-17-4-20-25-5-32-1-18 21-24 32-10m6 57c16 9 29-3 27-15 17-4 20-25 5-32 1-18-21-24-32-10M80 14v62"/><path class="art-motion" d="m45 30 18 9-8 17 21 4m38-30-17 9 8 17-21 4"/><circle cx="63" cy="39" r="3"/><circle cx="97" cy="39" r="3"/>',
 '8':'<path d="m15 76 37-47 27 29 22-33 44 51H15m26-34 11 9 9-9m31-3 9 7 9-7"/><circle class="art-motion" cx="77" cy="19" r="10"/><path d="M77 3V0m-19 9-5-4m46 4 5-4M75 76l14-19"/>',
 '9':'<path d="M80 15v57M61 79h38M42 26h76M42 26 23 58h38L42 26m76 0L99 58h38l-19-32M22 59q20 22 40 0m36 0q20 22 40 0"/><circle class="art-motion" cx="80" cy="15" r="6"/>',
 '10':'<path d="m26 29 54-22 54 22H26m5 7h98M36 42v27m22-27v27m44-27v27m22-27v27M29 74h104M23 81h116"/><path class="art-motion" d="M75 47c0-9 18-9 18 0s-18 2-18 11 18 9 18 0M84 35v35"/>',
 '11':'<circle cx="80" cy="42" r="33"/><ellipse cx="80" cy="42" rx="15" ry="33"/><path d="M48 32h64M48 53h64M47 42h66M80 9v66M18 79h126"/><path class="art-motion" d="M23 74v10m29-10v10m29-10v10m29-10v10m29-10v10"/>',
 '12':'<ellipse cx="80" cy="44" rx="54" ry="17"/><ellipse cx="80" cy="44" rx="54" ry="17" transform="rotate(55 80 44)"/><ellipse cx="80" cy="44" rx="54" ry="17" transform="rotate(-55 80 44)"/><circle cx="80" cy="44" r="5"/><circle class="art-motion" cx="134" cy="44" r="4"/>',
 '13':'<path d="M58 38v43M17 82h130M105 63V41M105 62c-20 0-28-11-24-24 20 0 28 12 24 24m0-8c1-19 12-28 27-25 0 20-11 28-27 25"/><g class="art-motion"><path d="M58 38 52 8l6-6 6 6-6 30m0 0-27 17-9-2 1-8 35-7m0 0 22 18 9-1 1-8-32-9"/></g>',
 '14':'<path d="M22 21h31q27 0 27 15 0-15 27-15h31v46h-31q-27 0-27 15 0-15-27-15H22zM80 36v46M34 34h25m-25 12h29m35-12h27m-28 12h28"/><path class="art-motion" d="m79 2 3 7 8 1-6 5 1 8-6-4-7 4 2-8-6-5 8-1z"/>'
};
window.LibraryArt=Object.freeze({ids:Object.keys(art),svg:id=>`<span class="topic-art" aria-hidden="true"><svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art[id]||art['14']}</svg></span>`});
})();
