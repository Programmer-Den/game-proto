/**
 * A compact binary form of JSON values for progress codes (`progressCode.ts`), much smaller than
 * the JSON text before both are deflated. Each value starts with a tag byte. Whole numbers are
 * zigzag varints. Other numbers keep their whole part and enough decimals for `DIGITS` significant
 * digits, as a varint mantissa and power of ten, so 462.76886699627227 becomes 462.769 and
 * 198057.99999999886 becomes 198058. Strings and object shapes (their keys, in order)
 * are written once and named by their index after that. Only codes round numbers: a progress file
 * keeps every digit.
 */
const DIGITS = 6;
/** Whole numbers up to this size are varints; zigzag needs one bit more than a double holds beyond it. */
const MAX_INT = 2 ** 52;

/** The tag byte that starts each value; a `Big` number, past `MAX_INT`, is written as its text. */
const Tag = { Null: 0, False: 1, True: 2, Int: 3, Decimal: 4, NewString: 5, String: 6, List: 7, NewShape: 8, Shape: 9, Big: 10 } as const;

function writeUint(n: number, out: number[]) {
  while (n >= 128) {
    out.push((n % 128) | 128);
    n = Math.floor(n / 128);
  }
  out.push(n);
}

const zigzag = (n: number) => (n >= 0 ? n * 2 : -n * 2 - 1);
const unzigzag = (n: number) => (n % 2 ? -(n + 1) / 2 : n / 2);

/** `x` (not whole) with its whole part and decimals up to `DIGITS` significant digits. */
function rounded(x: number) {
  const whole = Math.abs(x) < 1 ? 0 : Math.floor(Math.log10(Math.abs(x))) + 1;
  return whole ? Number(x.toFixed(Math.max(0, DIGITS - whole))) : Number(x.toPrecision(DIGITS));
}

/** `x`, a number of at most `DIGITS` significant digits, as a mantissa and a power of ten. */
function decimal(x: number): [number, number] {
  const [digits, e = '0'] = String(x).split('e');
  const [whole, fraction = ''] = digits.split('.');
  // Trailing zeros go into the power, so the mantissa never has more than DIGITS digits.
  const mantissa = (whole + fraction).replace(/0+$/, '') || '0';
  return [Number(mantissa), Number(e) - fraction.length + (whole + fraction).length - mantissa.length];
}

/** `value` (plain JSON data) packed into bytes. */
export function pack(value: unknown): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  const strings = new Map<string, number>();
  const shapes = new Map<string, number>();
  const string = (s: string) => {
    const known = strings.get(s);
    if (known !== undefined) {
      out.push(Tag.String);
      writeUint(known, out);
      return;
    }
    strings.set(s, strings.size);
    const bytes = new TextEncoder().encode(s);
    out.push(Tag.NewString);
    writeUint(bytes.length, out);
    for (const b of bytes) out.push(b);
  };
  const write = (v: unknown) => {
    if (v === null || v === undefined) out.push(Tag.Null);
    else if (v === false) out.push(Tag.False);
    else if (v === true) out.push(Tag.True);
    else if (typeof v === 'number') {
      const n = Number.isInteger(v) ? v : rounded(v);
      if (!Number.isFinite(n)) out.push(Tag.Null);
      else if (Math.abs(n) > MAX_INT) {
        out.push(Tag.Big);
        string(String(n));
      } else if (Number.isInteger(n)) {
        out.push(Tag.Int);
        writeUint(zigzag(n), out);
      } else {
        const [m, e] = decimal(n);
        out.push(Tag.Decimal);
        writeUint(zigzag(m), out);
        writeUint(zigzag(e), out);
      }
    } else if (typeof v === 'string') string(v);
    else if (Array.isArray(v)) {
      out.push(Tag.List);
      writeUint(v.length, out);
      for (const item of v) write(item);
    } else if (typeof v === 'object') {
      const entries = Object.entries(v).filter(([, item]) => item !== undefined);
      const keys = entries.map(([k]) => k);
      const id = JSON.stringify(keys);
      const known = shapes.get(id);
      if (known !== undefined) {
        out.push(Tag.Shape);
        writeUint(known, out);
      } else {
        shapes.set(id, shapes.size);
        out.push(Tag.NewShape);
        writeUint(keys.length, out);
        for (const k of keys) string(k);
      }
      for (const [, item] of entries) write(item);
    } else out.push(Tag.Null);
  };
  write(value);
  return new Uint8Array(out);
}

/** The value `pack` wrote into `bytes`; throws on bytes it did not write. */
export function unpack(bytes: Uint8Array): unknown {
  let at = 0;
  const strings: string[] = [];
  const shapes: string[][] = [];
  const byte = () => {
    if (at >= bytes.length) throw new Error('cut short');
    return bytes[at++];
  };
  const uint = () => {
    let n = 0;
    for (let scale = 1; ; scale *= 128) {
      const b = byte();
      n += (b & 127) * scale;
      if (b < 128) return n;
    }
  };
  const known = <T>(list: T[], i: number) => {
    if (i >= list.length) throw new Error('unknown index');
    return list[i];
  };
  const newString = () => {
    const length = uint();
    if (at + length > bytes.length) throw new Error('cut short');
    const s = new TextDecoder().decode(bytes.subarray(at, (at += length)));
    strings.push(s);
    return s;
  };
  const stringOf = (tag: number) => (tag === Tag.NewString ? newString() : tag === Tag.String ? known(strings, uint()) : null);
  const read = (): unknown => {
    const tag = byte();
    switch (tag) {
      case Tag.Null:
        return null;
      case Tag.False:
        return false;
      case Tag.True:
        return true;
      case Tag.Int:
        return unzigzag(uint());
      case Tag.Decimal: {
        const m = unzigzag(uint());
        return Number(`${m}e${unzigzag(uint())}`);
      }
      case Tag.NewString:
      case Tag.String:
        return stringOf(tag);
      case Tag.Big:
        return Number(stringOf(byte()));
      case Tag.List:
        return Array.from({ length: uint() }, read);
      case Tag.NewShape:
      case Tag.Shape: {
        let keys: string[];
        if (tag === Tag.Shape) keys = known(shapes, uint());
        else {
          keys = Array.from({ length: uint() }, () => {
            const key = stringOf(byte());
            if (key === null) throw new Error('bad key');
            return key;
          });
          shapes.push(keys);
        }
        const obj: Record<string, unknown> = {};
        for (const k of keys) obj[k] = read();
        return obj;
      }
      default:
        throw new Error('bad tag');
    }
  };
  const value = read();
  if (at !== bytes.length) throw new Error('extra bytes');
  return value;
}
