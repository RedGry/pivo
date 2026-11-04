import type { HolidayTheme } from '../presentation/holidays.ts';

type Side = 'left' | 'right';

const scenes: Record<HolidayTheme, Record<Side, string>> = {
  winter: {
    left: `
      <ellipse cx="119" cy="243" rx="104" ry="17" fill="#a9c9df" opacity=".29"/>
      <path d="M48 226h17v20H48zM136 214h18v28h-18z" fill="#936d61"/>
      <path d="M56 74 30 130h14l-25 44h17L14 224h84l-22-50h17l-25-44h14Z" fill="#417969"/>
      <path d="M146 36l-31 66h17l-34 53h22l-34 64h119l-34-64h22l-34-53h17Z" fill="#508d77"/>
      <path d="m56 74-13 28 13-5 13 5zm90-38-17 36 17-8 17 8zM115 104l12 5 11-8 17 8 16-5-10-18h-28ZM102 157l19 6 17-8 18 7 20-7-13-21h-47Z" fill="#c9e2ee" opacity=".9"/>
      <path d="M117 120q28 14 58 7m-76 47q47 20 92 5" fill="none" stroke="#d0bc88" stroke-width="1.8"/>
      <g fill="#edab9e"><circle cx="129" cy="133" r="4"/><circle cx="157" cy="140" r="4"/><circle cx="139" cy="190" r="4"/></g>
      <g fill="#f1d28a"><circle cx="175" cy="135" r="3.5"/><circle cx="113" cy="182" r="4"/><circle cx="169" cy="191" r="4"/></g>
      <path d="m146 20 3 7 8 1-6 5 1 8-6-4-7 4 2-8-6-5 8-1Z" fill="#f3d18b"/>
      <rect x="174" y="224" width="39" height="25" rx="5" fill="#b86d83"/>
      <path d="M194 224v25m-20-15h39m-19-10c-10-1-12-9-5-8 3 0 4 4 5 8 2-7 8-10 10-6 1 4-4 6-10 6Z" fill="none" stroke="#f5d395" stroke-width="3"/>
    `,
    right: `
      <path d="M169 29v51m-15-37 30 22m-30 0 30-22M49 101v24m-10-19 20 14m-20 0 20-14" stroke="#92b9d6" stroke-width="2" stroke-linecap="round"/>
      <path d="M123 68v32" stroke="#739f96" stroke-width="2"/>
      <path d="M98 119h50l-7 65h-36Z" fill="#d39d70" stroke="#89716e" stroke-width="3"/>
      <path d="M109 130h28l-4 41h-19Z" fill="#f6d48d"/>
      <path d="M94 120q29-35 58 0Zm3 64h52v8H97Z" fill="#567d78"/>
      <path d="M101 116q22-21 43 0" fill="none" stroke="#d3e7ef" stroke-width="4" stroke-linecap="round"/>
      <path d="M54 215q63-29 134 0" fill="none" stroke="#83aa98" stroke-width="4" stroke-linecap="round"/>
      <path d="m64 211 14-15m5 8 16-14m40 13 15-15m9 19 15-10" stroke="#6e9a8a" stroke-width="4" stroke-linecap="round"/>
      <circle cx="106" cy="207" r="4" fill="#d08a9e"/><circle cx="151" cy="208" r="4" fill="#d08a9e"/>
    `,
  },
  spooky: {
    left: `
      <ellipse cx="121" cy="239" rx="97" ry="13" fill="#7b5d87" opacity=".35"/>
      <path d="M89 160q-5-28 18-34l8 7q-12 9-11 27m64 24q0-18 15-22l5 6q-9 7-8 17" fill="#7f976e"/>
      <path d="M45 181q-1-24 25-24 17-17 38-6 24-11 41 6 26 0 28 29 0 46-64 46-68 0-68-51Z" fill="#d58056"/>
      <path d="M83 153q-20 43 5 72m46-72q21 42-2 72M108 151q-13 45 1 78" fill="none" stroke="#b56046" stroke-width="3" opacity=".75"/>
      <path d="m69 181 16-12 4 17Zm59 4 4-17 16 12Zm-45 12 13 4 5-4 8 6 8-6 6 5 15-7q-19 27-42 13Z" fill="#563647"/>
      <path d="M155 199q-5-15 10-18 12-8 23-2 19-1 25 15 5 31-28 35-31 0-30-30Z" fill="#e5a365"/>
      <path d="m168 198 7-4 2 7Zm22 1 2-6 7 4Zm-20 7q13 9 26 0" fill="#69434a" stroke="#69434a" stroke-width="2"/>
      <path d="M58 226v-14m-4-1q-3-6 4-11 6 5 3 11" stroke="#e9b683" stroke-width="3" stroke-linecap="round"/>
    `,
    right: `
      <path d="M169 41a39 39 0 1 0 26 62 37 37 0 0 1-26-62Z" fill="#d6b2cc" opacity=".7"/>
      <path d="M205 23h-95m95 0-82 43m82-43-56 75m56-75-14 93m14-93v100M184 23q0 11-9 16 4 9-4 18 8 6 7 18 9 4 13 15m-29-67q1 19-16 26 8 15-4 30 14 8 14 24" fill="none" stroke="#a99abd" stroke-width="1.5" stroke-linecap="round"/>
      <path d="m62 104 12 9 8-8 3 8 13-7-4 14-9 1-4 6-6-5-9 1ZM117 126l8 5 5-6 2 6 9-5-3 10-6 1-2 4-4-3h-6Z" fill="#a98ac6"/>
      <path d="M177 83v41" stroke="#b7a3c7" stroke-width="1.5"/>
      <ellipse cx="177" cy="132" rx="6" ry="8" fill="#8b6fa7"/>
      <path d="m171 130-7-7m7 11-9 3m21-7 7-7m-7 11 9 3" stroke="#8b6fa7" stroke-width="2" stroke-linecap="round"/>
    `,
  },
  spring: {
    left: `
      <ellipse cx="112" cy="242" rx="96" ry="13" fill="#91af91" opacity=".3"/>
      <path d="M52 238q14-72-11-109m44 108q-9-86 35-131m8 133q20-69 49-77m-29 74q13-33 43-34" fill="none" stroke="#78a484" stroke-width="4" stroke-linecap="round"/>
      <path d="M60 191q-21-17-32-2 14 16 32 2Zm31 9q21-25 35-13-10 17-35 13Zm54 12q16-20 29-11-11 12-29 11Z" fill="#8eb996"/>
      <path d="M40 123c-21-11-18 16-5 14 1 21 26 14 21-1 19-7 2-25-9-15-1-7-7-8-7 2Zm80-26c-21-18-24 11-9 14-2 23 26 19 25 2 19-6 8-26-7-17-4-8-10-7-9 1Zm57 58c-13-15-21 8-9 12 0 15 17 18 22 1 15-5 7-21-6-13-3-5-6-5-7 0Z" fill="#e4acc4"/>
      <circle cx="45" cy="132" r="5" fill="#f1cf8c"/><circle cx="122" cy="107" r="6" fill="#f1cf8c"/><circle cx="179" cy="164" r="5" fill="#f1cf8c"/>
    `,
    right: `
      <path d="M49 74q31 0 55 29 35 42 87 25" fill="none" stroke="#89a88b" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round"/>
      <path d="M132 104c-28-45-52-16-25 9-20 18 13 29 25 4 14 25 46 14 25-4 27-25 3-54-25-9Z" fill="#c5abd9"/>
      <path d="M132 109v20m0-20-6-8m6 8 6-8" stroke="#795e98" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="110" cy="103" r="5" fill="#ecbdd2"/><circle cx="155" cy="103" r="5" fill="#ecbdd2"/>
      <path d="M183 157q-14-7-18 2 12 7 18-2Zm-93 6q-14-7-18 2 12 7 18-2Z" fill="#a4c6a4"/>
    `,
  },
  summer: {
    left: `
      <path d="M24 220q21-32 62-22 38-18 77 0 28-5 50 19-25 30-87 32-56 0-102-29Z" fill="#87b5b5" opacity=".5"/>
      <path d="M32 220q25-18 49-7t48 0 49 0m-128 16q20-12 41-5t39 0" fill="none" stroke="#acd3cf" stroke-width="3" stroke-linecap="round"/>
      <path d="M107 198h63l-15 20h-36Z" fill="#cf8369"/>
      <path d="M139 142v57m-2-49-25 45h25zm5 10 23 35h-23Z" fill="#f2d5a4" stroke="#b79879" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="62" cy="172" r="16" fill="#ecc27c"/>
      <path d="M60 146v-7m-22 16-6-4m-1 23h-7m67-16 6-4" stroke="#ecc27c" stroke-width="2.2" stroke-linecap="round"/>
    `,
    right: `
      <circle cx="147" cy="77" r="33" fill="#eac27d"/>
      <path d="M147 30v-12m0 117v-11m-48-47H87m120 0h-12M114 43l-8-8m82 82-8-8m0-66 8-8m-82 82 8-8" stroke="#dfaa6a" stroke-width="3" stroke-linecap="round"/>
      <path d="M48 114q21-24 50 0-28 16-50 0Zm33 21q23-19 48 0-23 13-48 0Z" fill="#b8d6d1" opacity=".78"/>
      <path d="M63 161q9-10 18 0 9-10 18 0m54-3q8-8 16 0 8-8 16 0" fill="none" stroke="#75999e" stroke-width="2.3" stroke-linecap="round"/>
    `,
  },
  autumn: {
    left: `
      <path d="M22 35q64 4 118 92 16 24 53 32M72 62q23-13 55-12m-27 44q-18 12-30 41m54-10q25-7 53 1" fill="none" stroke="#a27865" stroke-width="4" stroke-linecap="round"/>
      <path d="M54 46c3-22 29-32 48-25-3 22-23 38-48 25Zm67 6q30-25 55-7-9 28-54 23Zm-52 78c-27-11-24-41-9-57 18 14 24 33 9 57Zm83 18q22-20 53-13-5 28-45 29Z" fill="#d09b71"/>
      <path d="M57 43l30-12m37 26 33-7m-87 71-8-31m95 63 32-10" stroke="#a96e59" stroke-width="2" stroke-linecap="round"/>
      <circle cx="114" cy="107" r="4" fill="#bb7d85"/><circle cx="137" cy="123" r="4" fill="#bb7d85"/>
    `,
    right: `
      <ellipse cx="119" cy="241" rx="95" ry="13" fill="#b89075" opacity=".24"/>
      <path d="M49 239q23-39 46-47m8 49q28-27 55-35" fill="none" stroke="#a77a64" stroke-width="3"/>
      <path d="M78 206c-9-29 21-38 39-38-1 26-19 42-39 38Zm51 19q3-32 48-29-7 27-48 29Zm-58 3q-25-14-40 4 17 17 40-4Z" fill="#d7a171"/>
      <path d="M154 238v-29h27v29z" fill="#8f6d74"/><path d="M149 209q18-21 37 0Z" fill="#b48680"/><path d="M161 218h13v15h-13z" fill="#efc888"/>
    `,
  },
  love: {
    left: `
      <path d="M63 150q2 38 32 56m50-86q-13 52-50 86m83-44q-12 40-83 44" fill="none" stroke="#aa859d" stroke-width="2.2"/>
      <path d="M63 151C2 111 33 79 63 102c30-23 61 9 0 49Z" fill="#d795b1"/>
      <path d="M145 121c-63-41-30-77 0-52 31-25 64 11 0 52Z" fill="#bf8fc6"/>
      <path d="M178 163c-39-26-20-49 0-33 19-16 39 7 0 33Z" fill="#e5b0b8"/>
      <path d="M42 114q3-11 13-10m73-21q3-12 14-11" fill="none" stroke="#f5d2e0" stroke-width="3" stroke-linecap="round"/>
      <path d="m94 203-12 6 13 2 12-6-13-2Z" fill="#be789e"/>
    `,
    right: `
      <ellipse cx="119" cy="230" rx="84" ry="14" fill="#ad7da2" opacity=".23"/>
      <g transform="rotate(-9 122 180)">
        <rect x="54" y="139" width="135" height="80" rx="12" fill="#d9b2ca"/>
        <path d="m57 145 65 48 64-48m-128 65 40-34m87 34-40-34" fill="none" stroke="#a87c9f" stroke-width="3"/>
        <path d="M122 193c-24-15-11-28 0-19 11-9 24 4 0 19Z" fill="#b46c94"/>
      </g>
      <path d="M170 128c-24-15-11-28 0-19 11-9 24 4 0 19Zm34-36c-16-10-7-19 0-13 7-6 16 3 0 13Z" fill="#dc9cba"/>
    `,
  },
};

export function holidaySceneArtwork(theme: HolidayTheme, side: Side): string {
  return `<svg viewBox="0 0 240 270" aria-hidden="true" focusable="false">${scenes[theme][side]}</svg>`;
}

/** Retain painted scene layers until their replacement has faded in. */
export function mountHolidayScene(host: HTMLElement, reduced: () => boolean) {
  const corners = [...host.querySelectorAll<HTMLElement>('[data-holiday-scene]')];
  const animations = new Map<Element, Animation>();
  let theme: HolidayTheme | undefined;
  let initialized = false;
  let disposed = false;
  const cancel = (element: Element) => {
    const animation = animations.get(element);
    if (!animation) return;
    animation.onfinish = null;
    animations.delete(element);
    animation.cancel();
  };
  const prune = () => {
    for (const corner of corners) for (const layer of corner.querySelectorAll<SVGSVGElement>('svg')) {
      if (!theme || layer.dataset.sceneTheme !== theme) layer.remove();
      else layer.classList.remove('outgoing-settings-scene');
    }
    host.hidden = !theme;
    if (theme) host.dataset.sceneTheme = theme;
    else delete host.dataset.sceneTheme;
  };
  const settle = () => {
    for (const element of [...animations.keys()]) cancel(element);
    prune();
  };
  const animate = (element: Element, frames: Keyframe[], finish?: () => void) => {
    const animation = element.animate(frames, { duration: 300, easing: 'ease-out', fill: 'both' });
    animations.set(element, animation);
    animation.onfinish = () => {
      if (animations.get(element) !== animation) return;
      animations.delete(element);
      finish?.();
      animation.cancel();
    };
  };
  window.addEventListener('resize', settle);
  return {
    render(next: HolidayTheme | undefined) {
      if (disposed) return;
      if (initialized && next === theme) { if (reduced()) settle(); return; }
      const wasVisible = !host.hidden;
      const oldHeight = wasVisible ? host.getBoundingClientRect().height : 0;
      const oldOpacity = wasVisible ? getComputedStyle(host).opacity : '0';
      const oldRects = corners.map(corner => corner.getBoundingClientRect());
      const oldLayers = new Map(corners.flatMap(corner => [...corner.querySelectorAll<SVGSVGElement>('svg')]
        .map(layer => [layer, getComputedStyle(layer).opacity] as const)));
      for (const element of [...animations.keys()]) cancel(element);
      initialized = true;
      theme = next;
      if (!wasVisible && !theme) { prune(); return; }
      if (theme) host.dataset.sceneTheme = theme;
      host.hidden = false;
      for (const [index, corner] of corners.entries()) {
        let incoming = [...corner.querySelectorAll<SVGSVGElement>('svg')].find(layer => layer.dataset.sceneTheme === theme);
        if (theme && !incoming) {
          const markup = document.createElement('div');
          markup.innerHTML = holidaySceneArtwork(theme, corner.dataset.holidayScene === 'left' ? 'left' : 'right');
          incoming = markup.firstElementChild as SVGSVGElement;
          incoming.dataset.sceneTheme = theme;
          corner.append(incoming);
        }
        for (const layer of corner.querySelectorAll<SVGSVGElement>('svg')) {
          const active = layer === incoming && Boolean(theme);
          layer.classList.toggle('outgoing-settings-scene', !active);
          if (!reduced()) animate(layer, [{ opacity: oldLayers.get(layer) ?? '0' }, { opacity: active ? 1 : 0 }], active ? undefined : () => layer.remove());
        }
        const rect = corner.getBoundingClientRect(), old = oldRects[index]!;
        const x = old.left - rect.left, y = old.top - rect.top;
        if (wasVisible && theme && !reduced() && (Math.abs(x) > .1 || Math.abs(y) > .1)) {
          animate(corner, [{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }]);
        }
      }
      if (reduced()) { settle(); return; }
      const header = getComputedStyle(host).position === 'static';
      const height = theme ? host.getBoundingClientRect().height : 0;
      animate(host, [
        { opacity: oldOpacity, ...(header ? { height: `${oldHeight}px`, flexBasis: `${oldHeight}px`, minHeight: '0px' } : {}) },
        { opacity: theme ? 1 : 0, ...(header ? { height: `${height}px`, flexBasis: `${height}px`, minHeight: '0px' } : {}) },
      ], prune);
    },
    settle,
    dispose() {
      disposed = true;
      window.removeEventListener('resize', settle);
      settle();
    },
  };
}
