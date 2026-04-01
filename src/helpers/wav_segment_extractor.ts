import * as FileSystem from "expo-file-system/legacy";
import { decode, encode } from "base64-arraybuffer";

const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 1;
const BYTES_PER_SAMPLE = 2; // 16-bit
const BYTES_PER_SECOND = SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE; // 88200

/**
 * Find the byte offset where PCM data starts in a WAV file.
 * WAV headers can vary in size due to extra chunks (fact, LIST, etc).
 */
const findWavDataOffset = (bytes: Uint8Array): number => {
  for (let i = 12; i < bytes.length - 8; i++) {
    if (
      bytes[i] === 0x64 &&     // 'd'
      bytes[i + 1] === 0x61 && // 'a'
      bytes[i + 2] === 0x74 && // 't'
      bytes[i + 3] === 0x61    // 'a'
    ) {
      return i + 8; // PCM starts after "data" + 4-byte size field
    }
  }
  return 44; // fallback
};

/**
 * Extract a time range from a WAV recording file and write it as a new WAV file.
 * Works by calculating byte offsets in the PCM data based on elapsed time.
 * Only works with uncompressed PCM/WAV (iOS). Not compatible with MP3 (Android).
 */
export const extractWavSegment = async (
  recordingUri: string,
  startSeconds: number,
  endSeconds: number,
): Promise<string> => {
  const base64Audio = await FileSystem.readAsStringAsync(recordingUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const arrayBuffer = decode(base64Audio);
  const bytes = new Uint8Array(arrayBuffer);

  const dataOffset = findWavDataOffset(bytes);

  // Calculate byte offsets relative to PCM data start, aligned to 2-byte samples
  const startByte = dataOffset + (Math.floor(startSeconds * BYTES_PER_SECOND) & ~1);
  const endByte = Math.min(
    dataOffset + (Math.floor(endSeconds * BYTES_PER_SECOND) & ~1),
    bytes.length,
  );

  if (endByte <= startByte) {
    throw new Error("Segment too short to extract");
  }

  const pcmData = bytes.slice(startByte, endByte);
  const pcmLength = pcmData.length;

  // Copy the original header (everything before PCM data)
  const headerBytes = bytes.slice(0, dataOffset);
  const newFile = new Uint8Array(dataOffset + pcmLength);
  newFile.set(headerBytes, 0);

  // Update RIFF chunk size (bytes 4-7): total file size - 8
  const chunkSize = dataOffset + pcmLength - 8;
  newFile[4] = chunkSize & 0xff;
  newFile[5] = (chunkSize >> 8) & 0xff;
  newFile[6] = (chunkSize >> 16) & 0xff;
  newFile[7] = (chunkSize >> 24) & 0xff;

  // Update data chunk size (4 bytes before PCM data starts)
  const dataSizeOffset = dataOffset - 4;
  newFile[dataSizeOffset] = pcmLength & 0xff;
  newFile[dataSizeOffset + 1] = (pcmLength >> 8) & 0xff;
  newFile[dataSizeOffset + 2] = (pcmLength >> 16) & 0xff;
  newFile[dataSizeOffset + 3] = (pcmLength >> 24) & 0xff;

  // Write PCM data
  newFile.set(pcmData, dataOffset);

  const outputUri = `${FileSystem.cacheDirectory}speedrun_segment_${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(outputUri, encode(newFile.buffer), {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outputUri;
};
