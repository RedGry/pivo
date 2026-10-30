export type PluginIcon = { type: 'emoji'; value: string } | { type: 'png'; data: string };

const pngPrefix = 'data:image/png;base64,';
const maximumBytes = 32 * 1024;
const signature = [137, 80, 78, 71, 13, 10, 26, 10];

/** Imported icons are inert metadata: one emoji or a small, static inline PNG. */
export function parsePluginIcon(raw: unknown): PluginIcon {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid plugin icon');
  const icon = raw as Record<string, unknown>;
  if (icon.type === 'emoji') {
    const value = icon.value;
    if (typeof value !== 'string' || !value.length || value.length > 32
      || [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length !== 1
      || !(/\p{Extended_Pictographic}/u.test(value) || /^\p{Regional_Indicator}{2}$/u.test(value)
        || /^[#*0-9]\uFE0F?\u20E3$/u.test(value))) throw new Error('Invalid plugin emoji');
    return { type: 'emoji', value };
  }
  if (icon.type !== 'png' || typeof icon.data !== 'string' || !icon.data.startsWith(pngPrefix)
    || icon.data.length > pngPrefix.length + 4 * Math.ceil(maximumBytes / 3)) throw new Error('Invalid plugin PNG');
  const encoded = icon.data.slice(pngPrefix.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('Invalid PNG encoding');
  const binary = atob(encoded);
  if (binary.length < 45 || binary.length > maximumBytes || btoa(binary) !== encoded) throw new Error('Invalid PNG encoding');
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (!signature.every((byte, index) => bytes[index] === byte)) throw new Error('Invalid PNG signature');
  const view = new DataView(bytes.buffer);
  let offset = signature.length;
  let imageData = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    if (length > bytes.length - offset - 12) throw new Error('Truncated PNG chunk');
    const kind = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!/^[A-Za-z]{4}$/.test(kind) || ['acTL', 'fcTL', 'fdAT'].includes(kind)) throw new Error('Unsupported PNG chunk');
    if (offset === signature.length) {
      if (kind !== 'IHDR' || length !== 13) throw new Error('Invalid PNG header');
      const width = view.getUint32(offset + 8);
      const height = view.getUint32(offset + 12);
      if (width < 1 || width > 256 || height < 1 || height > 256) throw new Error('PNG dimensions exceed icon bounds');
    } else if (kind === 'IHDR') throw new Error('Duplicate PNG header');
    if (kind === 'IDAT') imageData = true;
    offset += length + 12;
    if (kind === 'IEND') {
      if (length !== 0 || offset !== bytes.length || !imageData) throw new Error('Invalid PNG ending');
      return { type: 'png', data: icon.data };
    }
  }
  throw new Error('Incomplete PNG');
}
