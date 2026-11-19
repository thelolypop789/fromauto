// Phone photos are large: re-encode to a JPEG of at most 1600px. Formats the browser cannot
// decode (HEIC outside Safari) are uploaded as they are.
export async function shrink(file: File): Promise<{ blob: Blob; type: string; ext: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const blob = await new Promise<Blob>((ok, bad) => c.toBlob(b => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.85));
    return { blob, type: "image/jpeg", ext: "jpg" };
  } catch {
    const heic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    return { blob: file, type: heic ? "image/heic" : file.type || "image/jpeg", ext: heic ? "heic" : "jpg" };
  }
}
