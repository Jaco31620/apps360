/*
 * Clic-Clac — pilote de stockage Cloudflare R2 (API compatible S3).
 * Utilisé par lib/clicclac/server.js quand CLICCLAC_STORAGE=r2.
 *
 * Variables d'environnement (serveur uniquement, jamais NEXT_PUBLIC_) :
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   R2_JURISDICTION (facultatif) : "eu" si le bucket est créé avec la juridiction UE
 */
import { AwsClient } from "aws4fetch";

let _r2 = null;

export function r2Config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("Configuration R2 incomplète (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).");
  }
  const j = (process.env.R2_JURISDICTION || "").trim().toLowerCase();
  return { account: R2_ACCOUNT_ID, key: R2_ACCESS_KEY_ID, secret: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET, host: `${R2_ACCOUNT_ID}${j ? `.${j}` : ""}.r2.cloudflarestorage.com` };
}

function client() {
  if (_r2) return _r2;
  const c = r2Config();
  _r2 = {
    aws: new AwsClient({ accessKeyId: c.key, secretAccessKey: c.secret, service: "s3", region: "auto" }),
    base: `https://${c.host}/${c.bucket}`,
  };
  return _r2;
}

const objectUrl = (path) => `${client().base}/${String(path).split("/").map(encodeURIComponent).join("/")}`;

async function check(res, what) {
  if (res.ok || (what === "delete" && res.status === 404)) return;
  const txt = await res.text().catch(() => "");
  throw new Error(`R2 ${what} : HTTP ${res.status} ${txt.slice(0, 200)}`);
}

export async function r2Put(path, buffer, contentType) {
  // Signature d'abord, puis envoi avec le contenu en mémoire : aws4fetch.fetch
  // transmettrait un flux sans Content-Length, refusé par R2 (HTTP 411).
  const body = new Uint8Array(buffer);
  const signed = await client().aws.sign(objectUrl(path), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
  });
  const headers = new Headers(signed.headers);
  headers.set("Content-Length", String(body.byteLength));
  const res = await fetch(signed.url, { method: "PUT", headers, body });
  await check(res, "put");
}

export async function r2Exists(path) {
  const res = await client().aws.fetch(objectUrl(path), { method: "HEAD" });
  return res.ok;
}

export async function r2Remove(paths) {
  const list = paths.filter(Boolean);
  for (let i = 0; i < list.length; i += 10) {
    await Promise.all(list.slice(i, i + 10).map(async (p) => check(await client().aws.fetch(objectUrl(p), { method: "DELETE" }), "delete")));
  }
}

/* Liens signés. L'heure de signature est arrondie à la demi-heure : un même
 * fichier garde la même URL pendant 30 min, donc le navigateur le garde en
 * cache au lieu de le retélécharger à chaque rafraîchissement du live. La
 * validité couvre toujours au moins ttlSec après l'appel. */
const WINDOW = 1800;
export async function r2SignUrls(paths, ttlSec = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % WINDOW);
  const datetime = new Date(start * 1000).toISOString().replace(/[:-]|\.\d{3}/g, "");
  const expires = ttlSec + WINDOW;
  return Promise.all(paths.map(async (p) => {
    if (!p) return null;
    const signed = await client().aws.sign(`${objectUrl(p)}?X-Amz-Expires=${expires}`, { aws: { signQuery: true, datetime } });
    return signed.url;
  }));
}
