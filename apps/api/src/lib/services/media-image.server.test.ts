import sharp from "sharp";
import { expect, it } from "vitest";

import {
  normalizeMediaImage,
  UnsupportedMediaAnimationError,
} from "./media-image.server";

const transparent = {
  width: 4,
  height: 2,
  channels: 4,
  background: "#ff000000",
} as const;

it.each([
  ["png", "image/png", "png"],
  ["webp", "image/webp", "webp"],
  ["avif", "image/avif", "heif"],
  ["gif", "image/gif", "gif"],
] as const)(
  "preserves dimensions and transparency in static %s",
  async (format, mime, decoder) => {
    const input = await sharp({ create: transparent })
      .toFormat(format)
      .toBuffer();

    const result = await normalizeMediaImage(input, mime);
    const metadata = await sharp(result.data).metadata();
    const pixel = await sharp(result.data).ensureAlpha().raw().toBuffer();

    expect(result).toMatchObject({ extension: format, width: 4, height: 2 });
    expect(metadata).toMatchObject({ format: decoder, hasAlpha: true });
    expect(pixel[3]).toBe(0);
  },
);

function animation(frames: number, size = 2) {
  const frameBytes = size * size * 4;
  const pixels = Buffer.alloc(frames * frameBytes);

  for (let frame = 0; frame < frames; frame++) {
    const color = frame % 2 === 0 ? [255, 0, 0, 255] : [0, 0, 255, 255];
    pixels.fill(
      Buffer.from(color),
      frame * frameBytes,
      (frame + 1) * frameBytes,
    );
    pixels[(frame + 1) * frameBytes - 1] = 0;
  }

  return sharp(pixels, {
    raw: { width: size, height: frames * size, pageHeight: size, channels: 4 },
  });
}

it("removes GIF comments while preserving frame data, delays and finite looping", async () => {
  const source = await animation(2)
    .gif({ delay: [120, 230], loop: 3 })
    .toBuffer();

  const comment = Buffer.from([0x21, 0xfe, 3, 65, 66, 67, 0]);
  const decorated = Buffer.concat([
    source.subarray(0, -1),
    comment,
    source.subarray(-1),
  ]);

  const result = await normalizeMediaImage(decorated, "image/gif");
  const metadata = await sharp(result.data, { animated: true }).metadata();

  expect(result).toMatchObject({ data: source, width: 2, height: 2 });
  expect(metadata).toMatchObject({
    pages: 2,
    delay: [120, 230],
    loop: 3,
    hasAlpha: true,
  });
});

it("rejects animation above the frame limit", async () => {
  const gif = await animation(101).gif().toBuffer();

  await expect(normalizeMediaImage(gif, "image/gif")).rejects.toThrow();
});

it("rejects animation beyond the combined decoded pixel budget", async () => {
  const gif = await animation(5, 1800).gif({ effort: 1 }).toBuffer();

  await expect(normalizeMediaImage(gif, "image/gif")).rejects.toThrow();
}, 15_000);

it("rejects a very wide image within the decoded pixel budget", async () => {
  const png = await sharp({ create: { ...transparent, width: 8193 } })
    .png()
    .toBuffer();

  await expect(normalizeMediaImage(png, "image/png")).rejects.toThrow();
});

it("rejects animated WebP explicitly", async () => {
  const webp = await animation(2).webp().toBuffer();

  await expect(normalizeMediaImage(webp, "image/webp")).rejects.toBeInstanceOf(
    UnsupportedMediaAnimationError,
  );
});

it("rejects an APNG animation control before the still-image decoder can discard it", async () => {
  const png = await sharp({ create: transparent }).png().toBuffer();
  const control = Buffer.alloc(20);
  control.writeUInt32BE(8);
  control.write("acTL", 4);
  const apng = Buffer.concat([png.subarray(0, 33), control, png.subarray(33)]);

  await expect(normalizeMediaImage(apng, "image/png")).rejects.toBeInstanceOf(
    UnsupportedMediaAnimationError,
  );
});
