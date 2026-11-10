// Members' shop helpers shared by the shop pages and Admin (browser side).
export const euro = (cents) => `€${(cents / 100).toFixed(2).replace(".", ",")}`;

export const STATUS_LABEL = {
  PENDING: "awaiting payment",
  SENT: "payment sent",
  PAID: "paid",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export const statusBadge = (s) =>
  s === "PAID" || s === "DELIVERED" ? "badge-ok" : s === "CANCELLED" ? "badge-bad" : s === "SENT" ? "badge-accent" : "badge-warn";

// Downscale an uploaded photo in the browser so it stays small in the database.
export function resizeImage(file, max = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image")); };
    img.src = url;
  });
}
