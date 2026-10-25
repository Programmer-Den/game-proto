import { t } from './i18n';
import { frameCollector } from './progressCode';

/**
 * Scans a progress code (`progressCode.ts`) with the device's camera inside the hub, which matters
 * where the installed app keeps other saves than the browser a phone's camera app opens links in
 * (iOS). It reads QR codes with the browser's own `BarcodeDetector` where it has one (Chrome on
 * Android), and elsewhere with the barcode-detector package's copy of it (ZXing built to
 * WebAssembly, MIT and Apache 2.0 licensed), loaded only when the scanner opens. Its `.wasm` file
 * is part of the build, never fetched from another site, so scanning works offline.
 */
interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface DetectorClass {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

/** How often the camera's picture is read, in ms. */
const SCAN_MS = 150;

let detector: Promise<Detector> | undefined;
function qrDetector() {
  detector ??= (async () => {
    const native = (window as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    if (native && (await native.getSupportedFormats().catch((): string[] => [])).includes('qr_code')) return new native({ formats: ['qr_code'] });
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasm }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]);
    // By default the package fetches its .wasm from a CDN; this points it at the build's copy.
    prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm : prefix + path) } });
    return new BarcodeDetector({ formats: ['qr_code'] });
  })();
  detector.catch(() => (detector = undefined));
  return detector;
}

/**
 * Opens the `#scan-code` dialog with the camera's picture and calls `found` with the first QR code
 * that is a progress link (it has `#p=`), or with the digits of a loop of frames once every frame
 * is in, closing the dialog. Closing it stops the camera.
 */
export async function scanCode(found: (text: string) => void) {
  const dialog = document.getElementById('scan-code') as HTMLDialogElement;
  const video = dialog.querySelector('video')!;
  const status = dialog.querySelector('.lede')!;
  status.textContent = t('scanStarting');
  dialog.showModal();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch {
    status.textContent = t('scanNoCamera');
    return;
  }
  const stop = () => {
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  };
  if (!dialog.open) return stop();
  dialog.addEventListener('close', stop, { once: true });
  video.srcObject = stream;
  let reader: Detector;
  try {
    await video.play();
    reader = await qrDetector();
  } catch {
    status.textContent = t('scanFailed');
    return;
  }
  status.textContent = t('scanHint');
  const loop = frameCollector();
  const tick = async () => {
    if (!dialog.open) return;
    try {
      const codes = await reader.detect(video);
      const code = codes.find((c) => c.rawValue.includes('#p='));
      const whole = code?.rawValue ?? codes.map((c) => loop.add(c.rawValue)).find(Boolean);
      if (whole) {
        dialog.close();
        found(whole);
        return;
      }
      const got = loop.progress();
      if (got) status.textContent = t('scanFrames', got);
      else if (codes.length) status.textContent = t('scanNotProgress');
    } catch {
      // The picture isn't ready yet.
    }
    setTimeout(tick, SCAN_MS);
  };
  tick();
}

/** Wires the `#scan-code` dialog's close buttons. */
export function mountScanner() {
  const dialog = document.getElementById('scan-code') as HTMLDialogElement;
  for (const button of dialog.querySelectorAll('.close, .done')) button.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
}
