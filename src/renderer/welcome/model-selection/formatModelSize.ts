/**
 * Formats model size using GB for values at or above 1 GB, otherwise MB.
 */
export function formatModelSize(fileSizeBytes: number): string {
  if (fileSizeBytes >= 1_000_000_000) {
    const sizeGb = fileSizeBytes / 1_000_000_000;
    const rounded = Math.round(sizeGb * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} GB`;
  }
  return `${String(Math.round(fileSizeBytes / 1_000_000))} MB`;
}
