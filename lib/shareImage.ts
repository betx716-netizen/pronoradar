"use client";
// Image d'un coupon à partager (WhatsApp, statut, TikTok…) : logo, sélections, cote totale et lien de parrainage.
import type { CouponLeg } from "./coupon";

const W = 1080;
const PAD = 72;

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Coupe un texte trop long pour la largeur donnée (avec « … »).
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

const fontFamily = (cssVar: string, fallback: string) => {
  const v = getComputedStyle(document.body).getPropertyValue(cssVar).trim();
  return v ? `${v}, ${fallback}` : fallback;
};

export async function couponImage({ title, legs, totalOdds, link }: { title: string; legs: CouponLeg[]; totalOdds: number; link: string }): Promise<Blob> {
  const display = fontFamily("--font-bebas", "Impact, sans-serif");
  const sans = fontFamily("--font-geist-sans", "system-ui, sans-serif");
  // Les polices de l'app ne se chargent qu'à leur premier usage : on les demande avant de dessiner.
  await Promise.all([document.fonts?.load(`64px ${display}`), document.fonts?.load(`600 32px ${sans}`)]).catch(() => {});
  const shown = legs.slice(0, 10);
  const rowH = 118;
  const H = Math.max(1350, 520 + shown.length * rowH + (legs.length > shown.length ? 60 : 0) + 260);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Fond noir et vert, comme le logo.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#050505");
  bg.addColorStop(0.6, "#07160c");
  bg.addColorStop(1, "#0f3a1e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(34,197,94,0.18)";
  ctx.beginPath();
  ctx.arc(W - 80, 120, 320, 0, Math.PI * 2);
  ctx.fill();

  // En-tête : logo et nom.
  const logo = await loadImage("/icon.png");
  if (logo) ctx.drawImage(logo, PAD, 64, 120, 120);
  ctx.fillStyle = "#ffffff";
  ctx.font = `92px ${display}`;
  ctx.fillText("PRONO", PAD + 150, 152);
  const w = ctx.measureText("PRONO").width;
  ctx.fillStyle = "#4ade80";
  ctx.fillText("RADAR", PAD + 150 + w, 152);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `600 28px ${sans}`;
  ctx.fillText("COUPON ANALYSÉ PAR L'IA", PAD + 154, 192);

  // Titre du coupon.
  ctx.fillStyle = "#ffffff";
  ctx.font = `84px ${display}`;
  ctx.fillText(fit(ctx, title.toUpperCase(), W - 2 * PAD), PAD, 330);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `30px ${sans}`;
  ctx.fillText(`${legs.length} sélection${legs.length > 1 ? "s" : ""}`, PAD, 380);

  // Sélections.
  let y = 430;
  for (const l of shown) {
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.roundRect(PAD, y, W - 2 * PAD, rowH - 18, 24);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `26px ${sans}`;
    ctx.fillText(fit(ctx, l.match, W - 2 * PAD - 220), PAD + 28, y + 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 34px ${sans}`;
    ctx.fillText(fit(ctx, l.pick.selection, W - 2 * PAD - 220), PAD + 28, y + 82);
    ctx.fillStyle = "#4ade80";
    ctx.font = `64px ${display}`;
    const o = l.pick.odds.toFixed(2);
    ctx.fillText(o, W - PAD - 28 - ctx.measureText(o).width, y + 76);
    y += rowH;
  }
  if (legs.length > shown.length) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `30px ${sans}`;
    ctx.fillText(`+ ${legs.length - shown.length} autres sélections dans l'app`, PAD, y + 30);
    y += 60;
  }

  // Cote totale.
  y += 20;
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.roundRect(PAD, y, W - 2 * PAD, 150, 32);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 32px ${sans}`;
  ctx.fillText("COTE TOTALE", PAD + 40, y + 88);
  ctx.font = `120px ${display}`;
  const t = totalOdds.toFixed(2);
  ctx.fillText(t, W - PAD - 40 - ctx.measureText(t).width, y + 115);

  // Pied : lien et avertissement.
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(fit(ctx, link.replace(/^https?:\/\//, ""), W - 2 * PAD), PAD, H - 110);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `24px ${sans}`;
  ctx.fillText("Analyse par IA, aucun gain garanti · 18+ · Jouez de façon responsable", PAD, H - 60);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image impossible"))), "image/png"));
}
