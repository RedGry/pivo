import { ObsessionMotion, type ObsessionActivity, type ObsessionCue, type ObsessionPointer, type ObsessionState } from '../motion/obsession.ts';
import './obsession.css';

const identity = 'translate(-50%, -50%)';
type ObsessionText = 'obsession.no' | 'obsession.date' | 'obsession.waited' | 'obsession.plans'
  | 'obsession.visits' | 'obsession.coincidence' | 'obsession.compatibility' | 'obsession.spareHeart' | 'obsession.encourage';
const captions: Partial<Record<ObsessionCue['gesture'], ObsessionText>> = {
  farewell: 'obsession.no', disappointed: 'obsession.date', waited: 'obsession.waited', plans: 'obsession.plans',
  visit: 'obsession.visits', coincidence: 'obsession.coincidence', compatibility: 'obsession.compatibility',
  spareHeart: 'obsession.spareHeart',
};

export function clockHandReach(
  hand: Pick<DOMRect, 'left' | 'top' | 'width'>,
  clock: Pick<DOMRect, 'left' | 'bottom'>,
): { x: number; y: number } {
  // Let the hand straddle the lower left edge, leaving the entire digit row unobstructed.
  return { x: clock.left - hand.width * .15 - hand.left, y: clock.bottom + 2 - hand.top };
}

/** Keep drawn hearts on the character when the click lands near its outer edge. */
export function drawnHeartOrigin(point: { x: number; y: number }, image: { x: number; y: number; size: number }): { x: number; y: number } {
  const size = Number.isFinite(image.size) && image.size > 0 ? image.size : 150;
  return {
    x: Math.max(470, Math.min(780, (point.x - image.x) * 1254 / size)),
    y: Math.max(670, Math.min(790, (point.y - image.y) * 1254 / size)),
  };
}

/** Decorative parts only: no listeners, focus, native handles or pointer capture. */
export function mountObsession(
  panel: HTMLElement,
  mascotImage: HTMLImageElement,
  text: (key: ObsessionText) => string,
  onEyesChanged: (owned: boolean) => void = () => {},
) {
  const character = panel.querySelector<HTMLElement>('.character')!;
  const eyes = [...panel.querySelectorAll<HTMLElement>('.eyes i')];
  const eyeGroup = panel.querySelector<HTMLElement>('.eyes')!;
  const mascot = mascotImage.parentElement!;
  const bodyBacks = document.createElement('div');
  bodyBacks.className = 'obsession-body-backs';
  bodyBacks.setAttribute('aria-hidden', 'true');
  // These small paths stay inside the original dome where each hand overlaps the torso.
  bodyBacks.innerHTML = `<svg viewBox="0 0 1254 1254" aria-hidden="true">
    <defs><radialGradient id="obsession-body-shade" cx="50%" cy="0%" r="100%">
      <stop offset="0" stop-color="#28282a"/><stop offset="1" stop-color="#171719"/>
    </radialGradient></defs>
    <g fill="url(#obsession-body-shade)">
      <path d="M242 750 C239 800 244 850 254 896 H349 V745 H243 Z"/>
      <path d="M1008 750 C1011 800 1006 850 996 896 H901 V745 H1007 Z"/>
    </g></svg>`;
  bodyBacks.hidden = true;
  mascot.insertBefore(bodyBacks, mascotImage);
  const eyeBacks = document.createElement('div');
  eyeBacks.className = 'obsession-eye-backs';
  eyeBacks.setAttribute('aria-hidden', 'true');
  eyeBacks.innerHTML = '<span></span><span></span>';
  eyeBacks.hidden = true;
  character.insertBefore(eyeBacks, eyeGroup);
  const parts = document.createElement('div');
  parts.className = 'obsession-parts';
  parts.setAttribute('aria-hidden', 'true');
  parts.innerHTML = `
    <span class="obsession-hand obsession-left"><img alt="" draggable="false"></span>
    <span class="obsession-hand obsession-right"><img alt="" draggable="false"></span>
    <svg class="obsession-face" viewBox="0 0 1254 1254" fill="none">
      <path class="obsession-smile" d="M540 785 Q626 833 713 785"/>
      <path class="obsession-brow obsession-brow-left" d="M516 630 Q550 611 587 635"/>
      <path class="obsession-brow obsession-brow-right" d="M659 635 Q699 611 734 630"/>
      <g class="obsession-twig"><path class="obsession-twig-left" d="M427 802 L627 792 M486 799 L471 777"/>
        <path class="obsession-twig-right" d="M627 792 L827 782 M762 786 L778 765"/></g>
      <path class="obsession-breath" d="M695 813 Q731 800 755 814 M703 831 Q740 820 763 833"/>
      <g class="obsession-notebook">
        <path d="M362 809 Q495 786 627 816 Q759 786 892 809 V1032 Q759 1009 627 1038 Q495 1009 362 1032 Z" fill="#eee5f5" stroke="#bc99d6" stroke-width="10"/>
        <path d="M627 816 V1038 M465 985 H792 M491 985 V1011 M766 985 V1011" stroke="#725283" stroke-width="9"/>
        <image class="obsession-portrait" x="424" y="812" width="190" height="190"/>
        <image class="obsession-portrait" x="639" y="812" width="190" height="190"/>
      </g>
      <path class="obsession-thread" d="M350 923 Q426 950 488 908 C373 829 432 741 500 797 C568 741 627 829 512 908 Q645 962 831 879"/>
      <g class="obsession-visit-card"><rect x="440" y="817" width="375" height="180" rx="22" fill="#eee5f5"/>
        <text class="obsession-visit-old" x="525" y="940" text-anchor="middle" fill="#967da1"/>
        <path class="obsession-visit-strike" d="M473 891 L579 943" stroke="#bd6d9f" stroke-width="12"/>
        <text class="obsession-visit-new" x="715" y="940" text-anchor="middle" fill="#79558e"/>
      </g>
      <g class="obsession-rings"><circle cx="573" cy="886" r="61"/><circle cx="668" cy="886" r="61"/></g>
      <g class="obsession-compatibility"><rect x="361" y="807" width="532" height="179" rx="25" fill="#eee5f5"/>
        <text x="627" y="931" text-anchor="middle" fill="#79558e">100%</text>
        <text class="obsession-extra-percent" x="875" y="929" text-anchor="middle" fill="#bb87ce">%</text>
      </g>
      <path class="obsession-gift-heart obsession-small-heart" d="M627 936 C504 854 553 778 627 834 C701 778 750 854 627 936 Z"/>
      <path class="obsession-gift-heart obsession-large-heart" d="M627 987 C385 825 481 676 627 786 C773 676 869 825 627 987 Z"/>
      <g class="obsession-tea">
        <g class="obsession-cup-left"><path d="M358 846 H510 V919 Q434 1000 358 919 Z" fill="#eee5f5" stroke="#b49bc4" stroke-width="12"/>
          <path d="M511 863 C579 844 576 934 510 918 M373 836 H498" stroke="#b49bc4" stroke-width="12" stroke-linecap="round"/>
          <path d="M403 817 Q380 790 405 766 M464 817 Q441 790 466 766" stroke="#dec1ed" stroke-width="8" stroke-linecap="round"/></g>
        <g class="obsession-cup-right"><path d="M696 846 H848 V919 Q772 1000 696 919 Z" fill="#eee5f5" stroke="#b49bc4" stroke-width="12"/>
          <path d="M849 863 C917 844 914 934 848 918 M711 836 H836" stroke="#b49bc4" stroke-width="12" stroke-linecap="round"/>
          <path d="M741 817 Q718 790 743 766 M802 817 Q779 790 804 766" stroke="#dec1ed" stroke-width="8" stroke-linecap="round"/></g>
        <g class="obsession-sandwich" stroke-linejoin="round">
          <path d="M471 905 L627 754 L789 905 L789 949 H471 Z" fill="#b77b46" stroke="#e6b67b" stroke-width="12"/>
          <path d="M478 912 L506 903 L530 919 L557 904 L585 920 L612 904 L641 920 L669 904 L696 920 L725 904 L755 920 L782 909" stroke="#8fbd70" stroke-width="22"/>
          <path d="M479 890 L628 747 L781 890 L631 925 Z" fill="#f4d39b" stroke="#c99359" stroke-width="12"/>
          <path d="M573 831 L629 779 L684 831" stroke="#ffe5b8" stroke-width="14" stroke-linecap="round"/>
        </g>
      </g>
      <path class="obsession-kiss-mouth" d="M608 794 Q638 779 647 794 Q633 810 608 794 M647 794 L663 787"/>
      <path class="obsession-kiss-heart" d="M654 820 C591 778 616 739 654 768 C692 739 717 778 654 820 Z"/>
      <g class="obsession-drawn-hearts">
        <path class="obsession-drawn-heart" pathLength="100" d="M528 825 C419 753 462 686 528 736 C594 686 637 753 528 825 Z"/>
        <path class="obsession-drawn-heart" pathLength="100" d="M716 809 C625 749 661 693 716 734 C771 693 807 749 716 809 Z"/>
        <path class="obsession-drawn-heart" pathLength="100" d="M635 900 C554 846 586 796 635 833 C684 796 716 846 635 900 Z"/>
      </g>
      <g class="obsession-binoculars" stroke="#c7a5de" stroke-width="13">
        <path d="M507 660 L521 612 H575 L589 660 M664 660 L678 612 H732 L746 660" fill="#45364f"/>
        <path d="M588 692 Q626 661 665 692"/>
        <circle cx="548" cy="701" r="70" fill="#362d40"/><circle cx="705" cy="701" r="70" fill="#362d40"/>
        <path d="M511 697 Q511 661 548 662 M668 697 Q668 661 705 662" stroke="#f1e5fa" stroke-width="9" stroke-linecap="round"/>
      </g>
      <g class="obsession-bouquet">
        <path d="M388 756 L627 1110 L867 756 Z" fill="#a68eb6" stroke="#e5d4ee" stroke-width="12"/>
        <path d="M409 726 L627 1020 M838 727 L627 1020 M625 650 V1036" stroke="#789d84" stroke-width="17"/>
        <g fill="#d39be4" stroke="#ecc7f2" stroke-width="10">
          <path d="M335 843 C64 663 171 496 335 619 C499 496 606 663 335 843 Z"/>
          <path d="M627 776 C343 587 456 412 627 541 C798 412 911 587 627 776 Z"/>
          <path d="M919 843 C648 663 755 496 919 619 C1083 496 1190 663 919 843 Z"/>
          <path d="M478 995 C241 837 335 691 478 799 C621 691 715 837 478 995 Z"/>
          <path d="M776 995 C539 837 633 691 776 799 C919 691 1013 837 776 995 Z"/>
        </g>
        <path d="M538 1039 Q493 970 627 1021 Q761 970 716 1039 Q666 1057 627 1021 Q588 1057 538 1039 Z" fill="#eac5ef"/>
      </g>
      <g class="obsession-encourage">
        <rect x="353" y="680" width="548" height="360" rx="30" fill="#eee5f5" stroke="#bc99d6" stroke-width="12"/>
        <path d="M436 1040 V1104 M817 1040 V1104" stroke="#a58aaf" stroke-width="24"/>
        <text class="obsession-encourage-label" x="627" y="885" text-anchor="middle" fill="#79558e"/>
      </g>
      <g class="obsession-juggle" fill="#efb5da" stroke="#e9c5ef" stroke-width="6">
        <path class="obsession-juggle-left" d="M470 856 C348 775 396 700 470 756 C544 700 592 775 470 856 Z"/>
        <path class="obsession-juggle-right" d="M784 856 C662 775 710 700 784 756 C858 700 906 775 784 856 Z"/>
        <path class="obsession-juggle-top" d="M627 856 C505 775 553 700 627 756 C701 700 749 775 627 856 Z"/>
      </g>
      <g class="obsession-activity-reading">
        <path d="M353 797 Q489 755 627 803 Q765 755 901 797 V1037 Q765 995 627 1043 Q489 995 353 1037 Z" fill="#eee5f5" stroke="#bc99d6" stroke-width="12"/>
        <path d="M627 803 V1043 M398 839 L571 851 M398 892 L571 904 M398 945 L571 957 M683 851 L856 839 M683 904 L856 892 M683 957 L856 945" stroke="#a58aaf" stroke-width="9"/>
      </g>
      <g class="obsession-activity-writing">
        <path d="M403 773 H825 V1064 H403 Z" fill="#eee5f5" stroke="#bc99d6" stroke-width="12"/>
        <path d="M456 838 H741 M456 894 H705 M456 950 H650" stroke="#a58aaf" stroke-width="10" stroke-linecap="round"/>
        <g class="obsession-pencil"><path d="M622 953 L806 752 L846 788 L662 989 Z" fill="#e8c391" stroke="#ae845b" stroke-width="9"/>
          <path d="M622 953 L608 1007 L662 989 Z" fill="#725283"/></g>
      </g>
      <g class="obsession-activity-coding">
        <rect x="376" y="760" width="502" height="285" rx="24" fill="#413448" stroke="#bc99d6" stroke-width="14"/>
        <path d="M353 1045 H901 L940 1093 H314 Z" fill="#bdabc9" stroke="#79558e" stroke-width="10"/>
        <path d="M526 838 L475 886 L526 934 M728 838 L779 886 L728 934 M653 823 L602 949" stroke="#d8afe8" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <g class="obsession-mended-heart">
        <path d="M627 981 C389 822 484 676 627 784 C770 676 865 822 627 981 Z" fill="#d39be4"/>
        <path class="obsession-heart-crack" d="M627 780 L594 833 L652 858 L613 914 L627 973" stroke="#493451" stroke-width="13"/>
        <g class="obsession-plaster" transform="rotate(-28 627 868)">
          <rect x="530" y="832" width="194" height="72" rx="23" fill="#f4d8b1" stroke="#b99572" stroke-width="7"/>
          <path d="M598 838 V898 M656 838 V898" stroke="#d4b18a" stroke-width="5"/>
          <path d="M552 854 H565 M552 881 H565 M689 854 H702 M689 881 H702" stroke="#b99572" stroke-width="6" stroke-linecap="round"/>
        </g>
      </g>
    </svg>`;
  for (const image of parts.querySelectorAll<HTMLImageElement>('img')) image.src = mascotImage.src;
  for (const portrait of parts.querySelectorAll<SVGImageElement>('.obsession-portrait')) portrait.setAttribute('href', mascotImage.src);
  character.append(parts);
  const caption = document.createElement('div');
  caption.className = 'obsession-caption';
  caption.hidden = true;
  caption.setAttribute('role', 'status');
  character.append(caption);
  const left = parts.querySelector<HTMLElement>('.obsession-left')!;
  const right = parts.querySelector<HTMLElement>('.obsession-right')!;
  const smile = parts.querySelector<SVGElement>('.obsession-smile')!;
  const brows = [...parts.querySelectorAll<SVGElement>('.obsession-brow')];
  const twig = parts.querySelector<SVGElement>('.obsession-twig')!;
  const twigLeft = parts.querySelector<SVGElement>('.obsession-twig-left')!;
  const twigRight = parts.querySelector<SVGElement>('.obsession-twig-right')!;
  const breath = parts.querySelector<SVGElement>('.obsession-breath')!;
  const notebook = parts.querySelector<SVGElement>('.obsession-notebook')!;
  const thread = parts.querySelector<SVGElement>('.obsession-thread')!;
  const rings = parts.querySelector<SVGElement>('.obsession-rings')!;
  const visitCard = parts.querySelector<SVGElement>('.obsession-visit-card')!;
  const visitOld = parts.querySelector<SVGElement>('.obsession-visit-old')!;
  const visitNew = parts.querySelector<SVGElement>('.obsession-visit-new')!;
  const visitStrike = parts.querySelector<SVGElement>('.obsession-visit-strike')!;
  const compatibility = parts.querySelector<SVGElement>('.obsession-compatibility')!;
  const extraPercent = parts.querySelector<SVGElement>('.obsession-extra-percent')!;
  const smallHeart = parts.querySelector<SVGElement>('.obsession-small-heart')!;
  const largeHeart = parts.querySelector<SVGElement>('.obsession-large-heart')!;
  const tea = parts.querySelector<SVGElement>('.obsession-tea')!;
  const offeredCup = parts.querySelector<SVGElement>('.obsession-cup-right')!;
  const sandwich = parts.querySelector<SVGElement>('.obsession-sandwich')!;
  const kissMouth = parts.querySelector<SVGElement>('.obsession-kiss-mouth')!;
  const kissHeart = parts.querySelector<SVGElement>('.obsession-kiss-heart')!;
  const drawnHearts = parts.querySelector<SVGElement>('.obsession-drawn-hearts')!;
  const drawnPaths = [...parts.querySelectorAll<SVGElement>('.obsession-drawn-heart')];
  const binoculars = parts.querySelector<SVGElement>('.obsession-binoculars')!;
  const bouquet = parts.querySelector<SVGElement>('.obsession-bouquet')!;
  const mendedHeart = parts.querySelector<SVGElement>('.obsession-mended-heart')!;
  const crack = parts.querySelector<SVGElement>('.obsession-heart-crack')!;
  const plaster = parts.querySelector<SVGElement>('.obsession-plaster')!;
  const encourage = parts.querySelector<SVGElement>('.obsession-encourage')!;
  const encourageLabel = parts.querySelector<SVGElement>('.obsession-encourage-label')!;
  const juggle = parts.querySelector<SVGElement>('.obsession-juggle')!;
  const juggleLeft = parts.querySelector<SVGElement>('.obsession-juggle-left')!;
  const juggleRight = parts.querySelector<SVGElement>('.obsession-juggle-right')!;
  const juggleTop = parts.querySelector<SVGElement>('.obsession-juggle-top')!;
  const activityParts: Record<ObsessionActivity, SVGElement> = {
    reading: parts.querySelector<SVGElement>('.obsession-activity-reading')!,
    writing: parts.querySelector<SVGElement>('.obsession-activity-writing')!,
    coding: parts.querySelector<SVGElement>('.obsession-activity-coding')!,
  };
  const pencil = parts.querySelector<SVGElement>('.obsession-pencil')!;
  let animations: Animation[] = [];
  let current: ObsessionCue | null = null;
  let disposed = false;
  let enabled = false;
  let pointer: ObsessionPointer = { target: 'none', x: 0, y: 0 };

  function animate(element: Element, frames: Keyframe[], duration: number): void {
    animations.push(element.animate(frames, { duration, easing: 'ease-in-out', fill: 'both' }));
  }

  function pose(element: Element, transforms: string[], duration: number, offsets?: number[]): void {
    animate(element, transforms.map((transform, index) => ({ transform, ...(offsets ? { offset: offsets[index] } : {}) })), duration);
  }

  function blink(duration: number, at = 0.8): void {
    for (const eye of eyes) animate(eye, [
      { transform: `${identity} scaleY(1)` },
      { transform: `${identity} scaleY(1)`, offset: at },
      { transform: `${identity} scaleY(.06)`, offset: Math.min(.96, at + .05) },
      { transform: `${identity} scaleY(1)` },
    ], duration);
  }

  function show(element: Element, duration: number, peak = .2, end = .85): void {
    animate(element, [{ opacity: 0 }, { opacity: 1, offset: peak }, { opacity: 1, offset: end }, { opacity: 0 }], duration);
  }

  function refreshLocale(): void {
    encourageLabel.textContent = text('obsession.encourage');
    const key = current && captions[current.gesture];
    caption.textContent = key ? text(key).replace('{count}', String(current?.count ?? 1)) : '';
  }

  function render(cue: ObsessionCue | null): void {
    const owned = current !== null;
    for (const animation of animations) animation.cancel();
    animations = [];
    current = cue;
    delete panel.dataset.obsessionPose;
    mascotImage.classList.remove('obsession-source');
    bodyBacks.hidden = !cue;
    eyeBacks.hidden = !cue && !enabled;
    parts.hidden = !cue;
    caption.hidden = !cue || !captions[cue.gesture];
    refreshLocale();
    if (owned !== (cue !== null)) onEyesChanged(cue !== null);
    if (!cue) return;
    const { gesture, duration } = cue;
    panel.dataset.obsessionPose = gesture;
    mascotImage.classList.add('obsession-source');
    // Every transform returns to its resting value before the controller releases ownership.
    if (gesture === 'snap') {
      pose(left, ['none', 'translate(22px,-7px) rotate(-20deg)', 'translate(22px,-7px) rotate(-20deg)', 'translate(17px,-3px) rotate(-38deg)', 'none'], duration, [0, .22, .35, .43, 1]);
      pose(right, ['none', 'translate(-22px,-7px) rotate(20deg)', 'translate(-22px,-7px) rotate(20deg)', 'translate(-17px,-3px) rotate(38deg)', 'none'], duration, [0, .22, .35, .43, 1]);
      show(twig, duration, .1, .65);
      pose(twigLeft, ['rotate(0deg)', 'rotate(0deg)', 'rotate(-22deg)', 'translate(-12px,24px) rotate(-28deg)'], duration, [0, .35, .43, 1]);
      pose(twigRight, ['rotate(0deg)', 'rotate(0deg)', 'rotate(22deg)', 'translate(12px,24px) rotate(28deg)'], duration, [0, .35, .43, 1]);
      // The long still tail after the break is the deliberate direct gaze.
      pose(eyeGroup, ['translate(0,0)', 'translate(0,0)'], duration);
      blink(duration, .89);
    } else if (gesture === 'farewell') {
      for (const element of [mascot, parts, eyeGroup]) pose(element,
        ['none', 'rotate(-5deg)', 'rotate(5deg)', 'rotate(-4deg)', 'none', 'translateY(2px) scaleY(.97)', 'none'],
        duration, [0, .12, .24, .35, .48, .78, 1]);
      pose(left, ['none', 'translate(-2px,-16px) rotate(-30deg)', 'translate(-2px,-16px) rotate(-30deg)', 'translate(0,3px) rotate(8deg)', 'none'], duration, [0, .15, .48, .78, 1]);
      pose(right, ['none', 'translate(2px,-16px) rotate(30deg)', 'translate(2px,-16px) rotate(30deg)', 'translate(0,3px) rotate(-8deg)', 'none'], duration, [0, .15, .48, .78, 1]);
      show(breath, duration, .68, .82);
      blink(duration, .69);
    } else if (gesture === 'disappointed') {
      for (const eye of eyes) pose(eye, [`${identity} scaleY(1)`, `${identity} scaleY(.55) rotate(-8deg)`, `${identity} scaleY(.55) rotate(-8deg)`, identity], duration, [0, .16, .8, 1]);
      pose(eyeGroup, ['none', 'translateY(4px)', 'translateY(4px)', 'none'], duration, [0, .2, .8, 1]);
      pose(left, ['none', 'translateY(5px) rotate(12deg)', 'none'], duration);
      pose(right, ['none', 'translateY(5px) rotate(-12deg)', 'none'], duration);
      for (const brow of brows) show(brow, duration);
    } else if (gesture === 'smile') {
      show(smile, duration, .18, .7);
      blink(duration, .82);
    } else if (gesture === 'stare') {
      pose(eyeGroup, ['translate(0,0)', 'translate(0,0)'], duration);
      blink(duration, .84);
    } else if (gesture === 'waited') {
      for (const eye of eyes) pose(eye, [identity, `${identity} scale(1.24,1.16)`, `${identity} scale(1.24,1.16)`, identity], duration, [0, .1, .72, 1]);
      pose(left, ['none', 'translate(5px,-10px) rotate(-15deg)', 'none'], duration);
      pose(right, ['none', 'translate(-5px,-10px) rotate(15deg)', 'none'], duration);
      show(smile, duration, .6, .8);
    } else if (gesture === 'distress') {
      for (const brow of brows) show(brow, duration, .12, .38);
      for (const eye of eyes) pose(eye, [identity, `${identity} scale(.85,.68) rotate(12deg)`, `${identity} scale(.85,.68) rotate(12deg)`, identity], duration, [0, .12, .4, .7]);
      pose(mascot, ['none', 'translateX(-1px)', 'translateX(1px)', 'none'], duration, [0, .16, .28, .5]);
      show(smile, duration, .68, .9);
    } else if (gesture === 'hug') {
      updateHug();
      const x = Number(parts.style.getPropertyValue('--hug-x'));
      const y = Number(parts.style.getPropertyValue('--hug-y'));
      pose(left, ['none', `translate(${x + 34}px,${y}px) rotate(-24deg)`, `translate(${x + 34}px,${y}px) rotate(-24deg)`, 'none'], duration, [0, .2, .8, 1]);
      pose(right, ['none', `translate(${x - 34}px,${y}px) rotate(24deg)`, `translate(${x - 34}px,${y}px) rotate(24deg)`, 'none'], duration, [0, .2, .8, 1]);
      show(smile, duration);
    } else if (gesture === 'jealous') {
      for (const eye of eyes) pose(eye, [identity, `${identity} scaleY(.58)`, `${identity} scaleY(.58)`, identity], duration, [0, .16, .8, 1]);
      pose(eyeGroup, ['none', 'translate(5px,-2px)', 'translate(5px,-2px)', 'none'], duration, [0, .2, .8, 1]);
      const clock = panel.querySelector<HTMLElement>('.header-status .clock')!;
      const reach = clockHandReach(right.getBoundingClientRect(), clock.getBoundingClientRect());
      const handPose = `translate(${reach.x}px,${reach.y}px)`;
      pose(right, ['none', handPose, handPose, 'none'], duration, [0, .2, .8, 1]);
    } else if (gesture === 'patience') {
      pose(left, ['none', 'translate(38px,2px) rotate(-50deg)', 'translate(38px,2px) rotate(-50deg)', 'none'], duration, [0, .2, .85, 1]);
      pose(right, ['none', 'translate(-38px,2px) rotate(50deg)', 'translate(-38px,-1px) rotate(44deg)', 'translate(-38px,2px) rotate(50deg)', 'translate(-38px,-1px) rotate(44deg)', 'translate(-38px,2px) rotate(50deg)', 'none'], duration, [0, .2, .38, .48, .62, .75, 1]);
      blink(duration);
    } else if (gesture === 'plans') {
      show(notebook, duration, .18, .82);
      pose(notebook, ['translateY(80px) rotate(-8deg)', 'none', 'none', 'translateY(80px) rotate(8deg)'], duration, [0, .2, .8, 1]);
      pose(left, ['none', 'translate(25px,8px) rotate(-20deg)', 'none'], duration);
      pose(right, ['none', 'translate(-25px,8px) rotate(20deg)', 'none'], duration);
      show(smile, duration);
    } else if (gesture === 'falseSleep') {
      for (const eye of eyes) pose(eye, [identity, `${identity} scaleY(.08)`, `${identity} scaleY(.08)`, identity], duration, [0, .14, .92, 1]);
      pose(mascot, ['none', 'translateY(1px)', 'none'], duration);
    } else if (gesture === 'peek') {
      pose(eyes[0]!, [`${identity} scaleY(.08)`, identity, identity], duration, [0, .22, 1]);
      pose(eyes[1]!, [`${identity} scaleY(.08)`, `${identity} scaleY(.08)`, identity], duration, [0, .78, 1]);
    } else if (gesture === 'thread') {
      show(thread, duration, .14, .82);
      animate(thread, [{ strokeDashoffset: 1200 }, { strokeDashoffset: 0, offset: .65 }, { strokeDashoffset: 0 }], duration);
      pose(right, ['none', 'translate(-28px,4px) rotate(20deg)', 'translate(0,12px)', 'none'], duration, [0, .2, .75, 1]);
    } else if (gesture === 'visit') {
      visitOld.textContent = String(Math.max(0, (cue.count ?? 1) - 1));
      visitNew.textContent = String(cue.count ?? 1);
      show(visitCard, duration);
      animate(visitStrike, [{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1, offset: .5 }, { opacity: 1 }], duration);
      animate(visitNew, [{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1, offset: .65 }, { opacity: 1 }], duration);
      pose(right, ['none', 'translate(-5px,27px) rotate(35deg)', 'translate(-14px,27px) rotate(20deg)', 'none'], duration, [0, .25, .65, 1]);
      animate(caption, [{ transform: 'none' }, { transform: 'rotate(-2deg)', offset: .5 }, { transform: 'none' }], duration);
      show(smile, duration);
    } else if (gesture === 'coincidence') {
      show(rings, duration);
      pose(rings, ['scale(.8)', 'scale(1)', 'scale(1)', 'scale(.8)'], duration, [0, .2, .8, 1]);
      blink(duration);
    } else if (gesture === 'compatibility') {
      show(compatibility, duration, .12, .87);
      animate(extraPercent, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .4 }, { opacity: 0, offset: .62 }, { opacity: 0 }], duration);
      pose(right, ['none', 'translate(-6px,9px) rotate(30deg)', 'translate(4px,9px) rotate(10deg)', 'none'], duration, [0, .3, .6, 1]);
    } else if (gesture === 'spareHeart') {
      show(smallHeart, duration, .1, cue.noticed ? .85 : .35);
      if (!cue.noticed) {
        animate(largeHeart, [{ opacity: 0 }, { opacity: 0, offset: .46 }, { opacity: 1, offset: .6 }, { opacity: 1, offset: .88 }, { opacity: 0 }], duration);
        pose(largeHeart, ['scale(.7)', 'scale(.7)', 'scale(1)', 'scale(1)'], duration, [0, .46, .65, 1]);
      }
      pose(left, ['none', 'translate(20px,8px) rotate(-25deg)', 'none'], duration);
      pose(right, ['none', 'translate(-20px,8px) rotate(25deg)', 'none'], duration);
    } else if (gesture === 'tea') {
      show(tea, duration, .15, .84);
      pose(offeredCup, ['none', 'translate(140px,0)', 'translate(140px,0)', 'none'], duration, [0, .38, .8, 1]);
      pose(sandwich, ['translateY(100px) scale(.8)', 'translateY(-20px) scale(1.08)', 'translateY(-20px) scale(1.08)', 'translateY(100px) scale(.8)'], duration, [0, .3, .78, 1]);
      pose(left, ['none', 'translate(22px,9px) rotate(-20deg)', 'none'], duration);
      pose(right, ['none', 'translate(12px,9px) rotate(18deg)', 'none'], duration);
      show(smile, duration);
    } else if (gesture === 'kiss') {
      show(kissMouth, duration, .1, .48);
      animate(kissHeart, [{ opacity: 0 }, { opacity: 1, offset: .28 }, { opacity: 1, offset: .7 }, { opacity: 0 }], duration);
      pose(kissHeart, ['none', 'none', 'translate(290px,-220px) scale(.55)', 'translate(330px,-250px) scale(.35)'], duration, [0, .24, .8, 1]);
      pose(right, ['none', 'translate(-39px,-3px) rotate(32deg)', 'translate(-8px,-8px) rotate(-12deg)', 'none'], duration, [0, .24, .6, 1]);
      blink(duration, .74);
    } else if (gesture === 'drawnHearts') {
      const style = getComputedStyle(panel);
      const origin = drawnHeartOrigin(cue.point ?? pointer, {
        x: parseFloat(style.getPropertyValue('--image-x')) || 0,
        y: parseFloat(style.getPropertyValue('--image-y')) || 0,
        size: parseFloat(style.getPropertyValue('--image-size')) || 150,
      });
      drawnHearts.setAttribute('transform', `translate(${origin.x - 627} ${origin.y - 800})`);
      show(drawnHearts, duration, .08, .84);
      drawnPaths.forEach((path, index) => {
        const start = index * .15;
        animate(path, [{ strokeDashoffset: 100 }, { strokeDashoffset: 100, offset: start },
          { strokeDashoffset: 0, offset: start + .32 }, { strokeDashoffset: 0 }], duration);
      });
      show(smile, duration);
    } else if (gesture === 'search') {
      const direction = pointer.x < (parseFloat(getComputedStyle(panel).getPropertyValue('--eye-x')) || 114) ? -1 : 1;
      show(binoculars, duration, .14, .84);
      pose(binoculars, ['translateY(90px)', `translate(${direction * 28}px,0) rotate(${direction * 5}deg)`, `translate(${-direction * 20}px,0) rotate(${-direction * 4}deg)`, 'translateY(90px)'], duration, [0, .24, .7, 1]);
      pose(left, ['none', 'translate(35px,-14px) rotate(-42deg)', 'none'], duration);
      pose(right, ['none', 'translate(-35px,-14px) rotate(42deg)', 'none'], duration);
    } else if (gesture === 'rehearsal') {
      pose(right, ['none', 'translate(-4px,-27px) rotate(32deg)', 'translate(-4px,-27px) rotate(-20deg)', 'translate(-4px,-27px) rotate(32deg)', 'translate(-4px,-27px) rotate(-20deg)', 'none'], duration, [0, .18, .34, .5, .68, 1]);
      show(smile, duration);
      blink(duration);
    } else if (gesture === 'bouquet') {
      show(bouquet, duration, .18, .82);
      pose(bouquet, ['translateY(240px) scale(.65)', 'none', 'none', 'translateY(240px) scale(.65)'], duration, [0, .24, .78, 1]);
      pose(eyeGroup, ['none', 'translateY(-29px)', 'translateY(-29px)', 'none'], duration, [0, .24, .78, 1]);
      pose(left, ['none', 'translate(27px,12px) rotate(-18deg)', 'none'], duration);
      pose(right, ['none', 'translate(-27px,12px) rotate(18deg)', 'none'], duration);
    } else if (gesture === 'mend') {
      show(mendedHeart, duration, .12, .86);
      animate(crack, [{ opacity: 1 }, { opacity: 1, offset: .45 }, { opacity: 0, offset: .58 }, { opacity: 0 }], duration);
      animate(plaster, [{ opacity: 0 }, { opacity: 0, offset: .36 }, { opacity: 1, offset: .52 }, { opacity: 1 }], duration);
      pose(mendedHeart, ['none', 'none', 'translateY(-38px) scale(.88)', 'none'], duration, [0, .5, .76, 1]);
      pose(left, ['none', 'translate(38px,4px) rotate(-35deg)', 'none'], duration);
      pose(right, ['none', 'translate(-38px,4px) rotate(35deg)', 'none'], duration);
      show(smile, duration, .62, .86);
    } else if (gesture === 'encourage') {
      show(encourage, duration, .15, .85);
      pose(encourage, ['translateY(140px)', 'none', 'none', 'translateY(130px)', 'translateY(130px)', 'translateY(160px)'], duration, [0, .18, .4, .62, .85, 1]);
      pose(eyeGroup, ['none', 'none', 'translateY(-11px)', 'translateY(-11px)', 'none'], duration, [0, .4, .62, .85, 1]);
      pose(left, ['none', 'translate(30px,0) rotate(-20deg)', 'none'], duration);
      pose(right, ['none', 'translate(-30px,0) rotate(20deg)', 'none'], duration);
    } else if (gesture === 'juggle') {
      show(juggle, duration, .1, .88);
      pose(juggleLeft, ['translateY(80px)', 'translate(40px,-230px) rotate(-14deg)', 'translate(100px,-60px)', 'translateY(80px)', 'translateY(80px)'], duration, [0, .24, .43, .62, 1]);
      pose(juggleRight, ['translateY(80px)', 'translate(-40px,-180px) rotate(14deg)', 'translate(-100px,-40px)', 'translateY(80px)', 'translateY(80px)'], duration, [0, .3, .5, .7, 1]);
      pose(juggleTop, ['none', 'translateY(-460px)', 'translateY(-390px)', 'translateY(-410px)', 'translateY(-410px)'], duration, [0, .4, .62, .72, 1]);
      pose(left, ['none', 'translate(8px,-14px) rotate(-18deg)', 'translate(17px,2px)', 'none'], duration);
      pose(right, ['none', 'translate(-8px,-14px) rotate(18deg)', 'translate(-17px,2px)', 'none'], duration);
      blink(duration, .78);
    } else if (gesture === 'laptop' || gesture === 'sharedActivity') {
      const activity = gesture === 'laptop' ? 'coding' : cue.activity ?? 'reading';
      const prop = activityParts[activity];
      show(prop, duration, .14, .85);
      pose(prop, ['translateY(100px) scaleY(.35)', 'none', 'none', 'translateY(100px) scaleY(.35)'], duration, [0, .2, .82, 1]);
      pose(left, ['none', 'translate(28px,12px) rotate(-20deg)', 'translate(30px,9px) rotate(-18deg)', 'translate(28px,12px) rotate(-20deg)', 'none'], duration);
      pose(right, ['none', 'translate(-28px,12px) rotate(20deg)', 'translate(-30px,9px) rotate(18deg)', 'translate(-28px,12px) rotate(20deg)', 'none'], duration);
      if (activity === 'writing') pose(pencil, ['none', 'translate(-20px,12px)', 'translate(8px,24px)', 'none'], duration);
      if (activity === 'reading') blink(duration, .72);
    } else if (gesture === 'clutch') {
      pose(left, ['none', 'translate(5px,-8px) rotate(-25deg)', 'translate(5px,-8px) rotate(-25deg)', 'none'], duration, [0, .16, .6, 1]);
      pose(right, ['none', 'translate(-5px,-8px) rotate(25deg)', 'translate(-5px,-8px) rotate(25deg)', 'none'], duration, [0, .16, .6, 1]);
    }
    if (!caption.hidden) show(caption, duration);
  }

  function updateHug(): void {
    // Bound the reach to the original body; the real cursor is never moved or captured.
    const bodyX = parseFloat(getComputedStyle(panel).getPropertyValue('--eye-x')) || 114;
    const bodyY = parseFloat(getComputedStyle(panel).getPropertyValue('--eye-y')) || 84;
    parts.style.setProperty('--hug-x', String(Math.max(-20, Math.min(20, pointer.x - bodyX))));
    parts.style.setProperty('--hug-y', String(Math.max(-20, Math.min(5, pointer.y - bodyY - 15))));
  }

  const controller = new ObsessionMotion({
    set: (callback, delay) => setTimeout(callback, delay),
    clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout> | undefined),
    now: () => performance.now(),
  }, render);
  parts.hidden = true;
  return {
    get ownsEyes(): boolean { return current !== null; },
    setState(next: ObsessionState): void {
      if (disposed) return;
      enabled = next.enabled;
      panel.dataset.obsessionEnabled = String(enabled);
      if (enabled) mascotImage.classList.add('obsession-heart-source');
      else mascotImage.classList.remove('obsession-heart-source');
      eyeBacks.hidden = !enabled && !current;
      controller.setState(next);
    },
    pointer(next: ObsessionPointer): void {
      if (disposed) return;
      pointer = next;
      controller.pointer(next);
    },
    doubleClick(point: { x: number; y: number }): void { controller.doubleClick(point); },
    resume(): void { controller.resume(); },
    timerCancelled(): void { controller.timerCancelled(); },
    timerStarted(): void { controller.timerStarted(); },
    setActivity(activity: ObsessionActivity): void { controller.setActivity(activity); },
    setFocusRunning(running: boolean): void { controller.setFocusRunning(running); },
    timerBreakStarted(): void { controller.timerBreakStarted(); },
    timerPaused(): void { controller.timerPaused(); },
    timerCompleted(): void { controller.timerCompleted(); },
    clockChanged(hhmm: string): void { controller.clockChanged(hhmm); },
    refreshLocale,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      enabled = false;
      delete panel.dataset.obsessionEnabled;
      mascotImage.classList.remove('obsession-heart-source');
      controller.dispose();
      parts.remove();
      bodyBacks.remove();
      eyeBacks.remove();
      caption.remove();
    },
  };
}
