import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { readFileSync } from 'node:fs';
import { expandedGesture, playMascotAction, playWidgetReaction } from './widgets.ts';

function mockStyles(context: TestContext, read: (element: Element) => unknown = () => ({ transform: 'none', opacity: '0' })): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: read });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'getComputedStyle', previous);
    else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  });
}

test('compact reactions retain the current pose and recover the old target when changing modes', context => {
  const calls = new Map<object, { frames: Keyframe[]; options: KeyframeAnimationOptions }>();
  let cancellations = 0;
  const target = (base: string) => ({
    transform: base, opacity: '1',
    animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
      calls.set(this, { frames, options });
      const element = this;
      return { effect: { target: element, getKeyframes: () => frames }, cancel() { cancellations++; element.transform = base; } } as unknown as Animation;
    },
  });
  const eyes = target('matrix(1, 0, 0, 1, 8, 3)'), strip = target('none');
  mockStyles(context, element => ({ ...(element as unknown as { transform: string; opacity: string }) }));
  const replace = playWidgetReaction as unknown as (element: HTMLElement, widget: string, previous?: Animation[]) => Animation[];
  const raw = replace(eyes as unknown as HTMLElement, 'music');
  const first = Array.isArray(raw) ? raw : [raw as unknown as Animation];
  eyes.transform = 'matrix(1, 0, 0, .8, 8, 2)';
  const second = replace(eyes as unknown as HTMLElement, 'water', first);
  assert.equal(calls.get(eyes)?.frames[0]?.transform, 'matrix(1, 0, 0, .8, 8, 2)');
  assert.equal(calls.get(eyes)?.frames.at(-1)?.transform, 'matrix(1, 0, 0, 1, 8, 3)');
  assert.match(String(calls.get(eyes)?.frames[1]?.transform), /^matrix\(1, 0, 0, 1, 8, 3\) /);
  assert.equal(cancellations, first.length);
  eyes.transform = 'matrix(1, 0, 0, .7, 8, 1)';
  const third = replace(strip as unknown as HTMLElement, 'calendar', second);
  assert.equal(calls.get(eyes)?.frames[0]?.transform, 'matrix(1, 0, 0, .7, 8, 1)');
  assert.equal(calls.get(eyes)?.frames.at(-1)?.transform, 'matrix(1, 0, 0, 1, 8, 3)');
  assert.equal(calls.get(eyes)?.options.duration, 300);
  assert.equal(calls.get(strip)?.frames[0]?.transform, 'none');
  assert.equal(third.length, 2);
  third.forEach(animation => animation.cancel());
  assert.equal(cancellations, first.length + second.length + third.length);
  assert.equal(eyes.transform, 'matrix(1, 0, 0, 1, 8, 3)');
  assert.equal(strip.transform, 'none');
});

test('replacing a gesture retains painted parts, including parts omitted by the next gesture', context => {
  const targets = new Map<string, { transform: string; opacity: string; hasAttribute: () => boolean; animate: (frames: Keyframe[], options: KeyframeAnimationOptions) => Animation }>();
  const calls = new Map<string, { frames: Keyframe[]; options: KeyframeAnimationOptions }>();
  let cancellations = 0;
  const mascot = { querySelector: (selector: string) => {
    if (!targets.has(selector)) targets.set(selector, { transform: 'none', opacity: selector === '.mascot-open-eyes' ? '1' : '0', hasAttribute: () => false, animate(frames, options) {
      calls.set(selector, { frames, options });
      const target = this;
      const animation = { effect: { target, getKeyframes: () => frames }, cancel() { cancellations++; target.transform = 'none'; target.opacity = selector === '.mascot-open-eyes' ? '1' : '0'; } } as unknown as Animation;
      return animation;
    } });
    return targets.get(selector);
  } } as unknown as HTMLElement;
  mockStyles(context, element => ({ ...(element as unknown as { transform: string; opacity: string }) }));
  const first = playMascotAction(mascot, 'hop');
  targets.get('.mascot-face')!.transform = 'matrix(1, 0, 0, 1, 0, -9)';
  targets.get('.mascot-left')!.transform = 'matrix(1, 0, 0, 1, -3, -6)';
  targets.get('.mascot-eyes')!.transform = 'matrix(1, 0, 0, .5, 0, 0)';
  const expectedFace = targets.get('.mascot-face')!.transform;
  const expectedEye = targets.get('.mascot-eyes')!.transform;
  calls.clear();
  const replace = playMascotAction as (mascot: HTMLElement, action: string, previous: Animation[]) => Animation[];
  const second = replace(mascot, 'blink', first);
  assert.equal(calls.get('.mascot-eyes')?.frames[0]?.transform, expectedEye);
  assert.equal(calls.get('.mascot-face')?.frames[0]?.transform, expectedFace);
  assert.equal(calls.get('.mascot-face')?.frames.at(-1)?.transform, 'none');
  assert.equal(calls.get('.mascot-face')?.options.duration, 300);
  assert.equal(cancellations, first.length);
  targets.get('.mascot-face')!.transform = 'matrix(1, 0, 0, 1, 0, -4)';
  calls.clear();
  const third = replace(mascot, 'greeting', second);
  assert.equal(calls.get('.mascot-face')?.frames[0]?.transform, 'matrix(1, 0, 0, 1, 0, -4)');
  targets.get('.mascot-smile')!.opacity = '.7';
  targets.get('.mascot-open-eyes')!.opacity = '.3';
  calls.clear();
  const fourth = replace(mascot, 'blink', third);
  assert.equal(calls.get('.mascot-smile')?.frames[0]?.opacity, '.7');
  assert.equal(calls.get('.mascot-smile')?.frames.at(-1)?.opacity, '0');
  assert.equal(calls.get('.mascot-open-eyes')?.frames[0]?.opacity, '.3');
  fourth.forEach(animation => animation.cancel());
  assert.equal(cancellations, first.length + second.length + third.length + fourth.length);
  const water = playMascotAction(mascot, 'water');
  targets.get('[data-prop="water"]')!.transform = 'matrix(1, 0, 0, 1, 9, -4)';
  targets.get('[data-prop="water"]')!.opacity = '.6';
  calls.clear();
  const tasks = replace(mascot, 'tasks', water);
  const retiredProp = calls.get('[data-prop="water"]')!;
  assert.equal(retiredProp.frames[0]?.transform, 'matrix(1, 0, 0, 1, 9, -4)');
  assert.equal(retiredProp.frames[0]?.opacity, '.6');
  assert.equal(retiredProp.frames.at(-1)?.opacity, '0');
  assert.equal(retiredProp.frames.at(-1)?.transform, 'none');
  tasks.forEach(animation => animation.cancel());
});

test('expanded gestures animate distinct parts and return them to rest', context => {
  mockStyles(context);
  const html = readFileSync(new URL('../presentation/mascot.svg', import.meta.url), 'utf8');
  const tracks = new Map<string, Keyframe[]>();
  const mascot = {
    querySelector: (selector: string) => ({
      animate: (frames: Keyframe[]) => tracks.set(selector, frames),
      hasAttribute: (name: string) => selector.startsWith('[data-prop=') &&
        html.includes(`${selector.slice(1, -1)} ${name}`),
    }),
  } as unknown as HTMLElement;

  for (const [action, expected] of [
    ['curious', 'eyes'], ['blink', 'eyes'], ['hop', 'wave'],
    ['music', 'left'], ['pomodoro', 'eyes'], ['water', 'left'],
    ['tasks', 'wave'], ['calendar', 'eyes'], ['shelf', 'wave'], ['hud', 'face'],
  ]) {
    tracks.clear();
    playMascotAction(mascot, action!);
    assert.ok(tracks.has(`.mascot-${expected}`), action);
    if (action !== 'curious' && action !== 'blink' && action !== 'hop') {
      const prop = tracks.get(`[data-prop="${action}"]`);
      if (action === 'music' || action === 'calendar') {
        assert(prop?.every(frame => frame.opacity === undefined), action);
      } else {
        assert.equal(Number(prop?.[0]?.opacity), 0, action);
        assert.equal(prop?.[1]?.opacity, 1, action);
        assert.equal(Number(prop?.at(-1)?.opacity), 0, action);
      }
    }
    for (const [selector, frames] of tracks) {
      assert.equal(frames[0]?.transform, 'none');
      assert.equal(frames.at(-1)?.transform, 'none');
      if (selector === '[data-prop="music"]') {
        assert.ok(frames.every(frame => frame.transform === 'none'));
      } else {
        assert.ok(frames.slice(1, -1).some(frame => frame.transform !== 'none'));
      }
    }
  }
});

test('the reveal wave uses the same cancellable gesture path as widget actions', context => {
  mockStyles(context);
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /animation:\s*mascot-wave\b/);
  const parts: string[] = [];
  const mascot = {
    querySelector: (selector: string) => ({ animate: () => parts.push(selector) }),
  } as unknown as HTMLElement;
  playMascotAction(mascot, 'greeting');
  assert.ok(parts.includes('.mascot-wave'));
  assert.ok(parts.includes('.mascot-face'));
  assert.ok(parts.includes('.mascot-smile'));
});

test('the slider stays in front of the paw that presents it', () => {
  const svg = readFileSync(new URL('../presentation/mascot.svg', import.meta.url), 'utf8');
  assert.match(svg, /class="mascot-wave"[\s\S]+data-prop="hud"/);
});

test('reopening the same widget waves, while changing widgets plays the new reaction', () => {
  assert.equal(expandedGesture(undefined, 'music'), 'greeting');
  assert.equal(expandedGesture('music', 'music'), 'greeting');
  assert.equal(expandedGesture('music', 'water'), 'water');
  assert.equal(expandedGesture('music', undefined), 'greeting');
});
test('expanded eyes blink independently of the greeting and body motion', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-mascot-motion="true"\]\[data-actions-ready="true"\] \.mascot-open-eyes\s*\{[^}]+animation: mascot-idle-blink/);
  assert.match(css, /@keyframes mascot-idle-blink\s*\{[\s\S]+?scaleY\(\.15\)/);
});
