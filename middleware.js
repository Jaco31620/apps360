import { NextResponse } from "next/server";

/*
 * Ancien domaine perf360.fr (et www) : page « perf360 devient apps360 » puis
 * redirection automatique vers la même adresse sur apps360.fr (chemin et
 * paramètres conservés, pour les anciens liens et QR codes).
 *
 * Le domaine blackroll-codes.com est dédié à l'app multi-instances de codes.
 * - Racine "/" → page d'accueil interne (/accueil) via rewrite (l'URL reste "/").
 * - /manifest.json → manifeste non-installable (pas de proposition d'installer
 *   la PWA "apps360" quand on scanne un QR / ouvre le formulaire).
 * Les autres chemins passent normalement. Sur les autres domaines (apps360.fr…), rien n'est modifié.
 */
const NEW_SITE = "https://apps360.fr";
const REDIRECT_DELAY = 5; // secondes

function movedPage(target) {
  const href = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="${REDIRECT_DELAY};url=${href}">
<link rel="canonical" href="${href}">
<title>perf360 devient apps360</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#374151;padding:16px;box-sizing:border-box">
  <div style="max-width:440px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;text-align:center">
    <div style="background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;padding:28px 20px">
      <div style="font-size:15px;opacity:.9;text-decoration:line-through">perf360</div>
      <div style="font-size:30px;font-weight:800;margin-top:4px">apps360</div>
    </div>
    <div style="padding:28px 24px">
      <h1 style="font-size:20px;margin:0 0 12px;color:#111827">perf360 devient apps360 🎉</h1>
      <p style="margin:0 0 24px;line-height:1.5">Les mêmes apps, une nouvelle adresse : <b>apps360.fr</b>.<br>Vous allez être redirigé automatiquement.</p>
      <a href="${href}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:999px">Continuer vers apps360.fr →</a>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">Pensez à mettre à jour vos favoris.</p>
    </div>
  </div>
</body>
</html>`;
}

export function middleware(request) {
  const host = (request.headers.get("host") || "").toLowerCase();

  if (host === "perf360.fr" || host === "www.perf360.fr") {
    const { pathname, search } = request.nextUrl;
    return new NextResponse(movedPage(NEW_SITE + pathname + search), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" },
    });
  }

  if (!host.includes("blackroll-codes.com")) return NextResponse.next();

  const path = request.nextUrl.pathname;

  if (path === "/manifest.json") {
    // display:"browser" + pas d'icônes → non installable (supprime le prompt PWA apps360).
    return new NextResponse(JSON.stringify({ name: "BLACKROLL Codes", display: "browser" }), {
      status: 200,
      headers: { "content-type": "application/manifest+json" },
    });
  }

  if (path === "/favicon.ico") {
    // Fallback favicon : servir l'icône BLACKROLL (et non celle de apps360).
    const url = request.nextUrl.clone();
    url.pathname = "/icon-blackroll.svg";
    return NextResponse.rewrite(url);
  }

  if (path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/accueil";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// Tous les chemins sauf les fichiers internes de Next (nécessaire pour perf360.fr) ;
// les requêtes des autres domaines ressortent aussitôt via NextResponse.next().
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
