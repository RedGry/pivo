interface ColorWeight {
  weight: number;
  red: number;
  green: number;
  blue: number;
}

/** Pick a visible accent without averaging saturated artwork into muddy gray. */
export function artworkAccent(pixels: Uint8ClampedArray): readonly [number, number, number] | null {
  const colors = new Map<number, ColorWeight>();
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const red = pixels[index]!;
    const green = pixels[index + 1]!;
    const blue = pixels[index + 2]!;
    const high = Math.max(red, green, blue);
    const low = Math.min(red, green, blue);
    const chroma = high - low;
    if (pixels[index + 3]! < 128 || high < 38 || chroma < 22) continue;
    const hue = high === red ? (green - blue) / chroma
      : high === green ? 2 + (blue - red) / chroma : 4 + (red - green) / chroma;
    const bucket = Math.round(hue * 2 + 12) % 12;
    const color = colors.get(bucket) ?? { weight: 0, red: 0, green: 0, blue: 0 };
    const weight = chroma * chroma * (high / 255);
    color.weight += weight;
    color.red += red * weight;
    color.green += green * weight;
    color.blue += blue * weight;
    colors.set(bucket, color);
  }
  let best: ColorWeight | undefined;
  for (const color of colors.values()) {
    if (!best || color.weight > best.weight) best = color;
  }
  if (!best) return null;
  const scale = Math.max(1, 176 * best.weight / Math.max(best.red, best.green, best.blue));
  return [best.red, best.green, best.blue].map(channel =>
    Math.min(255, Math.round(channel * scale / best.weight))) as [number, number, number];
}
