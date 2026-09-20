/**
 * Phone cameras produce 3-8MB images. All of that has to reach the server and
 * then Google before a single field comes back, over a connection whose upload
 * is the slow direction — and none of it helps: the reader works from a
 * fraction of those pixels. Shrinking first is the difference between a read
 * that takes twenty seconds and one that takes five.
 *
 * The original is left untouched for the record; this copy is only what gets
 * read.
 */
export async function shrinkForReading(file: File, maxEdge = 1600): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

    // already small enough to send as it is
    if (scale === 1 && file.size < 900_000) {
      bitmap.close();
      return file;
    }

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // a format the browser cannot decode is sent as it is
    return file;
  }
}
