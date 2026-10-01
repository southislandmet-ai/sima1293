/* Weather icon set. Each icon is drawn in a 100 x 100 box with monoline
   strokes so it reads clearly at any size. Colour comes from `color`. */
(function () {
  'use strict';
  const S = 'fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"';
  const cloud = 'M30 70 H72 a16 16 0 0 0 2 -32 a22 22 0 0 0 -42 -4 a15 15 0 0 0 -2 36 Z';
  const ICONS = {
    rain: { name: 'Rain', svg: `<path d="${cloud}" ${S}/><path d="M38 80 l-5 10 M54 80 l-5 10 M70 80 l-5 10" ${S}/>` },
    heavyRain: { name: 'Heavy rain', svg: `<path d="${cloud}" ${S}/><path d="M32 78 l-6 14 M46 78 l-6 14 M60 78 l-6 14 M74 78 l-6 14" ${S}/>` },
    snow: { name: 'Snow', svg: `<path d="${cloud}" ${S}/><g ${S} stroke-width="6"><path d="M38 82 v10 M33 87 h10 M35 84 l6 6 M41 84 l-6 6"/><path d="M62 82 v10 M57 87 h10 M59 84 l6 6 M65 84 l-6 6"/></g>` },
    snowflake: { name: 'Snowflake / frost', svg: `<g ${S}><path d="M50 12 V88 M17 31 L83 69 M17 69 L83 31"/><path d="M50 12 l-8 8 M50 12 l8 8 M50 88 l-8 -8 M50 88 l8 -8 M17 31 l11 0 M17 31 l0 11 M83 69 l-11 0 M83 69 l0 -11 M17 69 l11 0 M17 69 l0 -11 M83 31 l-11 0 M83 31 l0 11"/></g>` },
    wind: { name: 'Wind', svg: `<g ${S}><path d="M14 40 H60 a10 10 0 1 0 -10 -10"/><path d="M14 58 H74 a10 10 0 1 1 -10 10"/><path d="M14 76 H44"/></g>` },
    gale: { name: 'Severe gale', svg: `<g ${S}><path d="M10 34 H58 a10 10 0 1 0 -10 -10"/><path d="M10 52 H80 a10 10 0 1 1 -10 10"/><path d="M10 70 H56 a9 9 0 1 1 -9 9"/><path d="M78 20 l6 -6 M84 34 l8 0 M78 48 l6 6" stroke-width="6"/></g>` },
    thunder: { name: 'Thunderstorm', svg: `<path d="${cloud}" ${S}/><path d="M54 66 L42 86 H56 L46 100" ${S} stroke-width="8"/>` },
    sun: { name: 'Sun', svg: `<g ${S}><circle cx="50" cy="50" r="18"/><path d="M50 10 v10 M50 80 v10 M10 50 h10 M80 50 h10 M22 22 l7 7 M71 71 l7 7 M22 78 l7 -7 M71 29 l7 -7"/></g>` },
    cloud: { name: 'Cloud', svg: `<path d="M26 76 H74 a18 18 0 0 0 2 -36 a24 24 0 0 0 -46 -4 a17 17 0 0 0 -4 40 Z" ${S}/>` },
    partly: { name: 'Partly cloudy', svg: `<g ${S}><circle cx="36" cy="36" r="14"/><path d="M36 10 v6 M10 36 h6 M18 18 l4 4 M54 18 l-4 4"/><path d="M40 82 H78 a14 14 0 0 0 1 -28 a20 20 0 0 0 -38 -3 a13 13 0 0 0 -1 31 Z" fill="#fff" fill-opacity="0.9"/></g>` },
    fog: { name: 'Fog', svg: `<g ${S}><path d="M18 40 H82 M12 56 H88 M18 72 H82 M30 88 H70"/></g>` },
    swell: { name: 'Heavy swell', svg: `<g ${S}><path d="M8 44 c10 -14 22 -14 32 0 s22 14 32 0 s14 -8 20 0"/><path d="M8 66 c10 -14 22 -14 32 0 s22 14 32 0 s14 -8 20 0"/></g>` },
    hail: { name: 'Hail', svg: `<path d="${cloud}" ${S}/><g fill="currentColor"><circle cx="36" cy="86" r="5"/><circle cx="52" cy="90" r="5"/><circle cx="68" cy="86" r="5"/></g>` },
    hot: { name: 'Heat', svg: `<g ${S}><path d="M42 16 a8 8 0 0 1 16 0 V60 a14 14 0 1 1 -16 0 Z"/><path d="M50 36 V70" stroke-width="9"/><path d="M70 22 h12 M70 36 h12 M70 50 h12"/></g>` },
    cold: { name: 'Cold', svg: `<g ${S}><path d="M42 16 a8 8 0 0 1 16 0 V60 a14 14 0 1 1 -16 0 Z"/><circle cx="50" cy="70" r="6" fill="currentColor"/><path d="M76 20 v24 M66 32 h20 M69 24 l14 16 M83 24 l-14 16" stroke-width="5"/></g>` },
    warning: { name: 'Warning', svg: `<g ${S}><path d="M50 14 L90 84 H10 Z"/><path d="M50 38 V60" stroke-width="9"/><circle cx="50" cy="72" r="5" fill="currentColor" stroke="none"/></g>` },
    flood: { name: 'Flooding', svg: `<g ${S}><path d="M30 24 H70 V48 H30 Z"/><path d="M30 24 l20 -14 l20 14"/><path d="M8 66 c10 -12 22 -12 32 0 s22 12 32 0 s14 -6 20 0 M8 84 c10 -12 22 -12 32 0 s22 12 32 0 s14 -6 20 0"/></g>` },
    tornado: { name: 'Tornado', svg: `<g ${S}><path d="M14 22 H86 M22 38 H78 M32 54 H70 M42 70 H66 M50 86 H60"/></g>` },
    road: { name: 'Road / travel', svg: `<g ${S}><path d="M34 12 L18 88 M66 12 L82 88"/><path d="M50 18 v10 M50 42 v10 M50 66 v10" stroke-width="6"/></g>` },
    avalanche: { name: 'Avalanche', svg: `<g ${S}><path d="M10 86 L50 18 L90 86 Z"/><path d="M38 40 l12 10 l12 -10" /><circle cx="30" cy="72" r="4" fill="currentColor" stroke="none"/><circle cx="44" cy="78" r="4" fill="currentColor" stroke="none"/><circle cx="58" cy="72" r="4" fill="currentColor" stroke="none"/></g>` },
  };
  window.Icons = {
    list: Object.keys(ICONS).map(id => ({ id, name: ICONS[id].name })),
    get: id => ICONS[id] || ICONS.warning,
    // Standalone SVG markup, used for the tray in the UI.
    markup: (id, color, size) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="color:${color}" stroke="currentColor">${(ICONS[id] || ICONS.warning).svg}</svg>`,
  };
})();
