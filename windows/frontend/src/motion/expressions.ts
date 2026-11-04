import type { Gesture } from './ambient.ts';

const open = { transform: 'translate(-50%, -50%)', borderRadius: '50%' };
const closed = { transform: 'translate(-50%, -42%) scale(1.1, .14)', borderRadius: '20% 20% 50% 50%' };

export function mountExpressions(eyes: HTMLElement, hand: HTMLElement, miniEyes: HTMLElement): (gesture: Gesture | null) => void {
  const pair = [...eyes.querySelectorAll('i')];
  const miniPair = [...miniEyes.querySelectorAll('i')];
  let active: Animation[] = [];
  let previousGesture: Gesture | null = null;

  function animate(element: Element, frames: Keyframe[], duration: number, fill: FillMode = 'none'): void {
    active.push(element.animate(frames, { duration, easing: 'ease-in-out', fill }));
  }

  return gesture => {
    if (gesture === 'asleep' && previousGesture === 'drowsy') {
      previousGesture = gesture;
      return;
    }
    previousGesture = gesture;
    const previousPose = gesture && gesture !== 'asleep' && active.length
      ? pair.map(eye => {
        const current = getComputedStyle(eye);
        return { transform: current.transform, borderRadius: current.borderRadius };
      })
      : [];
    for (const animation of active) animation.cancel();
    active = [];

    if (gesture === 'strip-blink' || gesture === 'strip-wink') {
      const wink = gesture === 'strip-wink';
      for (const eye of wink ? miniPair.slice(-1) : miniPair) {
        animate(eye, [
          { transform: 'scaleY(1)' },
          { transform: 'scaleY(.2)', offset: .4 },
          { transform: 'scaleY(.2)', offset: .6 },
          { transform: 'scaleY(1)' },
        ], wink ? 380 : 260);
      }
      return;
    }

    if (gesture === 'wave') {
      animate(hand, [
        { opacity: 0, transform: 'translateY(15px) rotate(-15deg)' },
        { opacity: 1, transform: 'translateY(0) rotate(-15deg)', offset: .2 },
        { opacity: 1, transform: 'translateY(0) rotate(12deg)', offset: .4 },
        { opacity: 1, transform: 'translateY(0) rotate(-12deg)', offset: .58 },
        { opacity: 1, transform: 'translateY(0) rotate(8deg)', offset: .76 },
        { opacity: 0, transform: 'translateY(15px) rotate(8deg)' },
      ], 2100);
      return;
    }
    for (const [index, eye] of pair.entries()) {
      const start = previousPose[index] ?? open;
      if (gesture === 'blink') {
        animate(eye, [start, { ...closed, offset: .42 }, { ...closed, offset: .55 }, open], 280);
      } else if (gesture === 'curious') {
        const lift = index ? '-73%' : '-66%';
        animate(eye, [start, { transform: `translate(-50%, ${lift}) scale(1.18, 1.16)`, offset: .36 }, open], 400);
      } else if (gesture === 'drowsy') {
        animate(eye, [start, { transform: 'translate(-50%, -35%) scaleY(.56)', offset: .45 }, closed], 700, 'forwards');
      } else if (gesture === 'asleep') {
        animate(eye, [closed, closed], 0, 'forwards');
      } else if (gesture === 'wake') {
        animate(eye, [previousPose[index] ?? closed,
          { ...(index ? closed : open), offset: .3 },
          { ...open, offset: .62 }, open], 1150);
      }
    }
    if (gesture === 'wake') {
      animate(eyes, [
        { transform: 'translateX(0)' },
        { transform: 'translateX(0)', offset: .34 },
        { transform: 'translateX(-3px)', offset: .52 },
        { transform: 'translateX(3px)', offset: .76 },
        { transform: 'translateX(0)' },
      ], 1150);
    }
  };
}
