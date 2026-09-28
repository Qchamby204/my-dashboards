/* Small, sculpted topic badges. Decorative artwork; never a data visualization. */
(() => {
'use strict';
const shapes={
 '1':'<rect x="25" y="49" width="11" height="22" rx="2"/><rect x="43" y="39" width="11" height="32" rx="2"/><rect x="61" y="25" width="11" height="46" rx="2"/><path d="m25 38 21-13 10 3 12-11v10l-9 7-11-3-23 14z" fill="ACCENT"/>',
 '2':'<circle cx="48" cy="48" r="27"/><circle cx="48" cy="48" r="22" fill="#0c2036"/><path d="m61 29-5 27-26 11 10-27z" fill="ACCENT"/><path d="m61 29-13 19-8-8z"/><path d="m30 67 18-19 8 8z"/><circle cx="48" cy="48" r="3" fill="#fff3c8"/>',
 '3':'<path d="M24 28h19l9 9-13 13-7-7-10 10-9-9zM72 28H53l-9 9 13 13 7-7 10 10 9-9z"/><path d="m30 48 17-13 18 17-17 19-18-15z" fill="ACCENT"/><path d="m30 48 17-13 8 7-15 13z"/><path d="m30 55 17 16 5-5-17-16z"/>',
 '4':'<path d="M25 36h15l29-13v45L40 55H25z"/><path d="M29 55h12l5 19H34z" fill="ACCENT"/><path d="M42 38 63 29v33l-21-9z" fill="ACCENT"/><rect x="18" y="38" width="9" height="15" rx="4"/><path d="M74 37h7v5h-7zm0 11h7v5h-7z"/>',
 '5':'<path d="M20 23h42a8 8 0 0 1 8 8v23a8 8 0 0 1-8 8H39L23 74V61a8 8 0 0 1-11-8V31a8 8 0 0 1 8-8z"/><path d="M74 39h3a8 8 0 0 1 8 8v23a7 7 0 0 1-7 7v9L62 75H47v-7h16a12 12 0 0 0 11-12z" fill="ACCENT"/><path d="M26 35h30v5H26zm0 12h21v5H26z" fill="#16314e"/>',
 '6':'<path d="M29 23h9v10h7V23h8v10h7V23h9v24l-8 6 4 16 6 7H25l6-7 4-16-6-6z"/><path d="M35 45h26v7H35zm-2 20h30l2 5H31z" fill="ACCENT"/><rect x="22" y="77" width="52" height="5" rx="2"/>',
 '7':'<path d="M44 22c-10-8-22 0-21 10-11 3-12 16-5 22-5 11 4 20 13 20 3 9 12 8 13 3zm8 0c10-8 22 0 21 10 11 3 12 16 5 22 5 11-4 20-13 20-3 9-12 8-13 3z"/><path d="M30 34h7v13H25v-5h7v-8m34 0h-7v13h12v-5h-7v-8M27 58h10v9h-5v-4h-5m42-5H59v9h5v-4h5" fill="ACCENT"/>',
 '8':'<circle cx="64" cy="27" r="12"/><path d="m13 75 28-48 31 48z" fill="ACCENT"/><path d="m41 27 31 48H49z"/><path d="m30 46 11-19 12 20-11-5z" fill="#eef6ff"/><path d="m58 75 13-26 16 26z"/>',
 '9':'<path d="M44 22h8v48h14v6H30v-6h14zM22 30h52v6H22z"/><circle cx="48" cy="22" r="7"/><path d="m26 38-12 22h25zm44 0L58 60h25z" fill="none" stroke="ACCENT" stroke-width="3"/><path d="M12 60h29a15 15 0 0 1-29 0zm44 0h29a15 15 0 0 1-29 0z"/>',
 '10':'<path d="m14 34 34-17 34 17v6H14zm4 35h60v7H18zm-5 9h70v5H13z"/><path d="M23 45h8v22h-8zm21 0h8v22h-8zm21 0h8v22h-8z" fill="ACCENT"/><circle cx="48" cy="30" r="4" fill="#10253d"/>',
 '11':'<circle cx="48" cy="43" r="28" fill="ACCENT"/><path d="M20 43h56M24 31h48M24 55h48M48 15v56" fill="none" stroke="GOLD" stroke-width="2"/><ellipse cx="48" cy="43" rx="13" ry="28" fill="none" stroke="GOLD" stroke-width="3"/><path d="M45 73h6v5h15v5H30v-5h15z"/><circle cx="48" cy="43" r="28" fill="none" stroke="GOLD" stroke-width="4"/>',
 '12':'<g fill="none" stroke="GOLD" stroke-width="4"><ellipse cx="48" cy="48" rx="33" ry="13"/><ellipse cx="48" cy="48" rx="33" ry="13" transform="rotate(60 48 48)"/><ellipse cx="48" cy="48" rx="33" ry="13" transform="rotate(-60 48 48)"/></g><circle cx="48" cy="48" r="8" fill="ACCENT"/><circle cx="77" cy="42" r="5" fill="#eef6ff"/>',
 '13':'<path d="M24 68C8 38 39 16 76 20c3 38-16 62-43 54L22 82l-5-5 41-40-5-5z" fill="ACCENT"/><path d="m49 28-15 28h13l-3 18 21-32H51l6-14z"/>',
 '14':'<path d="M15 25c13-6 25-4 33 3 8-7 20-9 33-3v48c-14-6-25-4-33 3-8-7-19-9-33-3z"/><path d="M21 29c9-3 17-1 23 3v36c-7-4-15-5-23-2zm54 0c-9-3-17-1-23 3v36c7-4 15-5 23-2z" fill="#faf0ce"/><path d="M46 28h4v47h-4z" fill="ACCENT"/><path d="M25 39h13v3H25zm0 10h13v3H25zm33-10h13v3H58zm0 10h13v3H58z" fill="#b5914b"/>'
};
let serial=0;
function svg(id){
 const uid='library-badge-'+(++serial),gold=`url(#${uid}-gold)`,accent=`url(#${uid}-accent)`;
 const palette=Number(id)%3===0?['#c4f0cf','#267b67','#0a423d']:Number(id)%3===1?['#b7e9ff','#287ec2','#16365e']:['#eef6ff','#a6bace','#4c657e'];
 const subject=(shapes[id]||shapes['14']).replaceAll('ACCENT',accent).replaceAll('GOLD',gold);
 return `<span class="topic-art" aria-hidden="true"><svg viewBox="0 0 96 96" focusable="false"><defs><linearGradient id="${uid}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff3ca"/><stop offset=".28" stop-color="#e8bc62"/><stop offset=".55" stop-color="#9d661f"/><stop offset=".76" stop-color="#f7d88b"/><stop offset="1" stop-color="#ac7731"/></linearGradient><linearGradient id="${uid}-accent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset=".45" stop-color="${palette[1]}"/><stop offset="1" stop-color="${palette[2]}"/></linearGradient><linearGradient id="${uid}-plate" x2=".8" y2="1"><stop stop-color="#314966"/><stop offset=".4" stop-color="#13273f"/><stop offset="1" stop-color="#071421"/></linearGradient></defs><rect x="5" y="7" width="86" height="86" rx="23" fill="#030b16" opacity=".6"/><rect x="5" y="3" width="86" height="86" rx="23" fill="url(#${uid}-plate)" stroke="#657687" stroke-width="1"/><rect x="9" y="7" width="78" height="78" rx="19" fill="none" stroke="${gold}" opacity=".35"/><g class="badge-symbol" fill="${gold}" stroke="#ffe3a0" stroke-width=".35" stroke-linejoin="round">${subject}</g><path d="M22 10h39" stroke="#ffffff" opacity=".15" stroke-linecap="round"/></svg></span>`;
}
window.LibraryArt=Object.freeze({ids:Object.keys(shapes),svg});
})();
