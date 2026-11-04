const compactReactions: Record<string, readonly string[]> = {
  music: ['translateY(-1.5px)', 'translateY(-1.5px)'],
  pomodoro: ['scale(1.15, .72)'],
  water: ['rotate(-7deg) scaleY(.66)', 'rotate(-4deg) scaleY(.66)'],
  tasks: ['translateY(1px) scaleY(.65)', 'translateY(-1px)'],
  calendar: ['translateX(-2px)', 'translateX(2px)'],
  shelf: ['translateX(2px) scaleY(1.12)'],
  hud: ['translateY(-1px) scale(1.1)'],
};

interface MotionTrack { element: Element; frames: Keyframe[]; duration: number }

export function playWidgetReaction(element: HTMLElement, widget: string, previous: readonly Animation[] = []): Animation[] {
  const poses = compactReactions[widget];
  return replaceTracks(poses ? [{ element, duration: 540, frames: ['none', ...poses, 'none'].map(transform => ({ transform, easing: 'ease-in-out' })) }] : [], previous, true);
}

type Part = 'face' | 'eyes' | 'left' | 'wave';
interface Gesture {
  duration: number;
  prop?: Part;
  tracks: Partial<Record<Part, readonly string[]>>;
}

const gestures: Record<string, Gesture> = {
  greeting: { duration: 1240, tracks: {
    face: ['translateY(-1px) rotate(-2deg)', 'translateY(-2px) rotate(-3deg)', 'rotate(-1deg)'],
    wave: ['translate(3px,-11px) rotate(-18deg)', 'translate(4px,-14px) rotate(7deg)', 'translate(3px,-10px) rotate(-12deg)'],
  } },
  curious: { duration: 720, tracks: {
    face: ['translateY(3px) rotate(-8deg)', 'rotate(-8deg)'],
    eyes: ['translateX(3px) scale(1.12)', 'translateX(3px)'],
  } },
  blink: { duration: 420, tracks: { eyes: ['scaleY(.08)', 'scaleY(1.12)'] } },
  hop: { duration: 680, tracks: {
    face: ['scale(1.13,.83)', 'translateY(-13px) scale(.94,1.09)', 'scale(1.09,.88)'],
    left: ['none', 'translate(-3px,-8px) rotate(-18deg)', 'none'],
    wave: ['none', 'translate(3px,-8px) rotate(18deg)', 'none'],
    eyes: ['scaleY(.35)', 'scale(1.15)', 'scaleY(.65)'],
  } },
  music: { duration: 1050, prop: 'face', tracks: {
    face: ['rotate(-3deg)', 'translateY(-2px) rotate(3deg)', 'rotate(1deg)'],
    left: ['translateY(-3px)', 'translateY(-5px)', 'translateY(-2px)'],
    wave: ['translateY(-2px)', 'translateY(-4px)', 'translateY(-2px)'],
  } },
  pomodoro: { duration: 1150, prop: 'wave', tracks: {
    face: ['scale(1.09,.86)', 'scale(.96,1.09)', 'scale(1.03,.97)'],
    eyes: ['scaleY(.28)', 'translateX(4px) scaleY(1.2)', 'translateX(4px)'],
    wave: ['translateY(-8px)', 'translateY(-12px)', 'translateY(-10px)'],
  } },
  water: { duration: 1480, prop: 'left', tracks: {
    face: ['rotate(-4deg)', 'rotate(-9deg)', 'rotate(-9deg)', 'rotate(3deg)'],
    eyes: ['translateY(2px)', 'scaleY(.15)', 'scaleY(.15)', 'scale(1.12)'],
    left: ['translate(9px,-4px)', 'translate(23px,-8px) rotate(23deg)', 'translate(23px,-8px) rotate(32deg)', 'translate(10px,-4px)'],
  } },
  tasks: { duration: 1050, prop: 'wave', tracks: {
    face: ['translateY(5px) scaleY(.9)', 'translateY(-3px)', 'translateY(3px) scaleY(.93)'],
    eyes: ['scaleY(.35)', 'scaleY(1.15)', 'scaleY(.55)'],
    wave: ['translateY(-8px)', 'translateY(-11px)', 'translateY(-5px)'],
  } },
  calendar: { duration: 1100, prop: 'wave', tracks: {
    face: ['rotate(-7deg)', 'rotate(8deg)', 'rotate(3deg)'],
    eyes: ['translateX(-7px)', 'translateX(7px)', 'translateX(4px) scaleY(.6)'],
    wave: ['translateY(-6px)', 'translateY(-9px)', 'translateY(-6px)'],
  } },
  shelf: { duration: 1050, prop: 'wave', tracks: {
    face: ['translateX(5px) rotate(9deg)', 'translateX(3px) scaleY(.93)'],
    wave: ['translate(8px,-9px) rotate(18deg)', 'translate(-9px,-5px) rotate(-20deg)'],
    eyes: ['translateX(5px)', 'translateX(-2px)'],
  } },
  hud: { duration: 1000, prop: 'wave', tracks: {
    face: ['scale(1.09,.92)', 'translateY(-5px) scale(.98,1.08)', 'scale(1.04,.97)'],
    left: ['translate(-4px,-3px)', 'translate(-6px,-9px)', 'none'],
    wave: ['translate(4px,-3px)', 'translate(6px,-9px)', 'none'],
    eyes: ['scaleY(.5)', 'scale(1.25)', 'scaleY(.9)'],
  } },
};

export function playMascotAction(mascot: HTMLElement, action: string, previous: readonly Animation[] = []): Animation[] {
  const gesture = gestures[action];
  if (!gesture) { previous.forEach(animation => animation.cancel()); return []; }
  const tracks: MotionTrack[] = [];
  const transformTrack = (element: Element, poses: readonly string[]) => {
    tracks.push({ element, duration: gesture.duration, frames: ['none', ...poses, 'none'].map(transform => ({ transform, easing: 'ease-in-out' })) });
  };
  for (const [part, poses] of Object.entries(gesture.tracks)) {
    transformTrack(mascot.querySelector(`.mascot-${part}`)!, poses);
  }
  if (action === 'greeting') {
    for (const [selector, resting] of [['.mascot-open-eyes', 1], ['.mascot-smile', 0]] as const) {
      tracks.push({ element: mascot.querySelector(selector)!, duration: gesture.duration, frames: [
        { opacity: resting, offset: 0, easing: 'ease-in-out' },
        { opacity: resting, offset: 0.08, easing: 'ease-in-out' },
        { opacity: 1 - resting, offset: 0.28 },
        { opacity: 1 - resting, offset: 0.73, easing: 'ease-in-out' },
        { opacity: resting, offset: 0.95 },
      ] });
    }
  }
  if (gesture.prop) {
    const prop = mascot.querySelector(`[data-prop="${action}"]`)!;
    const poses = gesture.tracks[gesture.prop]!;
    const stays = prop.hasAttribute('data-stays');
    tracks.push({ element: prop, duration: gesture.duration, frames: ['none', ...poses, 'none'].map((transform, index) => ({
      transform: action === 'music' ? 'none' : transform,
      ...(stays ? {} : { opacity: index === 0 || index > poses.length ? 0 : 1 }),
      easing: 'ease-in-out',
    })) });
  }
  return replaceTracks(tracks, previous);
}

function replaceTracks(tracks: MotionTrack[], previous: readonly Animation[], relative = false): Animation[] {
  type Property = 'transform' | 'opacity';
  const owned = new Map<Element, Set<Property>>();
  for (const animation of previous) {
    if (animation.playState === 'finished' || animation.playState === 'idle') continue;
    const effect = animation.effect as KeyframeEffect | null;
    if (!effect?.target) continue;
    const properties = owned.get(effect.target) ?? new Set<Property>();
    for (const frame of effect.getKeyframes()) {
      for (const property of ['transform', 'opacity'] as const) if (frame[property] !== undefined) properties.add(property);
    }
    owned.set(effect.target, properties);
  }
  const elements = new Set([...owned.keys(), ...tracks.map(track => track.element)]);
  const sample = () => new Map([...elements].map(element => {
    const style = getComputedStyle(element);
    return [element, { transform: style.transform, opacity: style.opacity }] as const;
  }));
  const painted = sample();
  previous.forEach(animation => animation.cancel());
  const resting = sample();
  for (const { element, frames } of tracks) {
    for (const property of ['transform', 'opacity'] as const) {
      if (!frames.some(frame => frame[property] !== undefined)) continue;
      if (relative && property === 'transform' && resting.get(element)!.transform !== 'none') {
        // Compact reactions are offsets around the target's existing anchor transform.
        for (const frame of frames.slice(1, -1)) {
          frame.transform = frame.transform === 'none' ? resting.get(element)!.transform
            : `${resting.get(element)!.transform} ${frame.transform}`;
        }
      }
      frames[0]![property] = painted.get(element)![property];
      frames.at(-1)![property] = resting.get(element)![property];
      owned.get(element)?.delete(property);
    }
  }
  for (const [element, properties] of owned) {
    for (const property of properties) {
      if (painted.get(element)![property] === resting.get(element)![property]) properties.delete(property);
    }
    if (!properties.size) continue;
    const frames: Keyframe[] = [{ easing: 'ease-out' }, {}];
    for (const property of properties) {
      frames[0]![property] = painted.get(element)![property];
      frames[1]![property] = resting.get(element)![property];
    }
    tracks.push({ element, frames, duration: 300 });
  }
  return tracks.map(({ element, frames, duration }) => element.animate(frames, { duration }));
}

export function expandedGesture(previous: string | undefined, widget: string | undefined): string {
  return previous && widget && previous !== widget ? widget : 'greeting';
}
