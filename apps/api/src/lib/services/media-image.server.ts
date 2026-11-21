import "server-only";

import sharp from "sharp";

import { stripGifMetadata } from "./media-gif.server";

import type { MediaInputMime } from "@nextpress/shared/media";

const maxPixels = 16_000_000;
const maxDimension = 8192;
const maxFrames = 100;
const maxDurationMs = 60_000;

const formats = {
  "image/png": { decoder: "png", encoder: "png", extension: "png" },
  "image/jpeg": { decoder: "jpeg", encoder: "jpeg", extension: "jpg" },
  "image/webp": { decoder: "webp", encoder: "webp", extension: "webp" },
  "image/avif": { decoder: "heif", encoder: "avif", extension: "avif" },
  "image/gif": { decoder: "gif", encoder: null, extension: "gif" },
} as const satisfies Record<MediaInputMime, object>;

export class UnsupportedMediaAnimationError extends Error {}

function matchesSignature(bytes: Buffer, mime: MediaInputMime) {
  switch (mime) {
    case "image/png":
      return bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/jpeg":
      return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case "image/webp":
      return (
        bytes.toString("latin1", 0, 4) === "RIFF" &&
        bytes.toString("latin1", 8, 12) === "WEBP"
      );
    case "image/gif":
      return ["GIF87a", "GIF89a"].includes(bytes.toString("latin1", 0, 6));
    case "image/avif":
      return bytes.toString("latin1", 4, 8) === "ftyp";
  }
}

function rejectAnimatedPng(bytes: Buffer) {
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    const chunk = bytes.toString("ascii", offset + 4, offset + 8);

    if (chunk === "acTL" || chunk === "fcTL" || chunk === "fdAT") {
      throw new UnsupportedMediaAnimationError();
    }

    offset += size + 12;
  }
}

function verifyAvifBrand(bytes: Buffer) {
  const end = bytes.readUInt32BE(0);

  if (
    bytes.toString("latin1", 4, 8) !== "ftyp" ||
    end < 16 ||
    end > bytes.length ||
    end % 4 !== 0
  ) {
    throw new Error("Invalid AVIF file type");
  }

  let stillImage = false;

  for (let offset = 8; offset < end; offset += 4) {
    if (offset === 12) {
      continue;
    }

    const brand = bytes.toString("latin1", offset, offset + 4);

    if (brand === "avis") {
      throw new UnsupportedMediaAnimationError();
    }

    stillImage ||= brand === "avif";
  }

  if (!stillImage) {
    throw new Error("Invalid AVIF brand");
  }
}

export async function normalizeMediaImage(bytes: Buffer, mime: MediaInputMime) {
  if (!matchesSignature(bytes, mime)) {
    throw new Error("Invalid image signature");
  }

  if (mime === "image/png") {
    rejectAnimatedPng(bytes);
  }

  if (mime === "image/avif") {
    verifyAvifBrand(bytes);
  }

  if (
    mime === "image/webp" &&
    bytes.toString("latin1", 12, 16) === "VP8X" &&
    (bytes[20] & 2) !== 0
  ) {
    throw new UnsupportedMediaAnimationError();
  }

  const { decoder, encoder, extension } = formats[mime];
  const image = sharp(bytes, {
    limitInputPixels: maxPixels,
    failOn: "warning",
    animated: mime === "image/gif",
  });

  const metadata = await image.metadata();

  if (metadata.format !== decoder) {
    throw new Error("Image format mismatch");
  }

  if (mime === "image/avif" && metadata.compression !== "av1") {
    throw new Error("Invalid AVIF compression");
  }

  const frames = metadata.pages ?? 1;
  const frameHeight = metadata.pageHeight ?? metadata.height;

  if (frames > 1 && mime !== "image/gif") {
    throw new UnsupportedMediaAnimationError();
  }

  if (
    metadata.width < 1 ||
    frameHeight < 1 ||
    metadata.width > maxDimension ||
    frameHeight > maxDimension ||
    frames < 1 ||
    frames > maxFrames ||
    metadata.width * frameHeight * frames > maxPixels ||
    (metadata.delay?.reduce((sum, delay) => sum + Math.max(delay, 100), 0) ??
      0) > maxDurationMs
  ) {
    throw new Error("Image exceeds processing limits");
  }

  const encoding = {
    png: {},
    jpeg: { quality: 90 },
    webp: { lossless: true, effort: 2 },
    avif: { quality: 75, effort: 2 },
  };

  if (encoder === null) {
    const data = stripGifMetadata(bytes);

    // Decode the sanitized image in full before making any durable write.
    await sharp(data, {
      limitInputPixels: maxPixels,
      failOn: "warning",
      animated: true,
    })
      .timeout({ seconds: 10 })
      .raw()
      .toBuffer();

    return { data, extension, width: metadata.width, height: frameHeight };
  }

  const { data, info } = await image
    .autoOrient()
    .toFormat(encoder, encoding[encoder])
    .timeout({ seconds: 10 })
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    extension,
    width: info.width,
    height: info.pageHeight ?? info.height,
  };
}
