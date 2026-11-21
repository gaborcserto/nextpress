import "server-only";

function colorTableLength(flags: number) {
  return flags & 128 ? 3 * (2 << (flags & 7)) : 0;
}

function endOfSubBlocks(bytes: Buffer, offset: number) {
  while (offset < bytes.length) {
    const length = bytes[offset++];

    if (length === 0) {
      return offset;
    }

    offset += length;
  }

  throw new Error("Truncated GIF data");
}

// Retain the original palettes, image data, graphics controls, and standard
// loop extension. Re-quantizing composited frames can change their colors.
export function stripGifMetadata(bytes: Buffer) {
  let offset = 13 + colorTableLength(bytes[10]);
  const output = [bytes.subarray(0, offset)];

  while (offset < bytes.length) {
    const start = offset++;
    const block = bytes[start];

    if (block === 0x3b) {
      output.push(bytes.subarray(start, offset));

      return Buffer.concat(output);
    }

    if (block === 0x2c && offset + 9 < bytes.length) {
      const left = bytes.readUInt16LE(offset);
      const top = bytes.readUInt16LE(offset + 2);
      const width = bytes.readUInt16LE(offset + 4);
      const height = bytes.readUInt16LE(offset + 6);

      if (
        !width ||
        !height ||
        left + width > bytes.readUInt16LE(6) ||
        top + height > bytes.readUInt16LE(8)
      ) {
        throw new Error("GIF frame exceeds the image canvas");
      }

      offset = endOfSubBlocks(
        bytes,
        offset + 10 + colorTableLength(bytes[offset + 8]),
      );
      output.push(bytes.subarray(start, offset));
      continue;
    }

    if (block !== 0x21 || offset + 2 >= bytes.length) {
      break;
    }

    const label = bytes[offset++];
    offset = endOfSubBlocks(bytes, offset);

    if (label === 0xf9 && offset - start === 8) {
      output.push(bytes.subarray(start, offset));
    } else if (
      label === 0xff &&
      offset - start === 19 &&
      bytes[start + 2] === 11 &&
      bytes[start + 14] === 3 &&
      bytes[start + 15] === 1 &&
      ["NETSCAPE2.0", "ANIMEXTS1.0"].includes(
        bytes.toString("latin1", start + 3, start + 14),
      )
    ) {
      output.push(bytes.subarray(start, offset));
    } else if (label !== 0xff && label !== 0xfe) {
      throw new Error("Unsupported GIF extension");
    }
  }

  throw new Error("Invalid GIF block stream");
}
