/*
 * Ami Invisible — mode d'emploi public (/ami-invisible/aide), lié depuis
 * l'espace organisateur et le message du backoffice.
 * Ancres : #principe #preparer #envoyer #suivi #participants #annee-suivante #donnees #faq.
 */
import Link from "next/link";

export const metadata = {
  title: "Mode d'emploi — Ami Invisible",
  description: "Organiser un tirage au sort de cadeaux : participants, exclusions, envoi des liens, suivi, liste de souhaits.",
};

function Section({ id, icon, title, children }) {
  return (
    <section id={id} className="bg-white rounded-3xl p-6 sm:p-7 shadow scroll-mt-6">
      <h2 className="text-xl font-extrabold text-gray-900 mb-3">{icon} {title}</h2>
      <div className="space-y-3 text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}
function Steps({ children }) {
  return <ol className="space-y-2.5">{children}</ol>;
}
function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
const Tip = ({ children }) => <p className="text-sm bg-orange-50 text-orange-900 rounded-2xl px-4 py-3">💡 {children}</p>;
const B = ({ children }) => <b className="text-gray-900">{children}</b>;
function Faq({ q, children }) {
  return (
    <details className="group border-b border-gray-100 last:border-0 py-3">
      <summary className="cursor-pointer font-semibold text-gray-900 list-none flex justify-between gap-3">
        {q}<span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="mt-2 text-gray-700 text-sm leading-relaxed space-y-2">{children}</div>
    </details>
  );
}

const TOC = [
  ["principe", "Le principe"], ["preparer", "Préparer le tirage"], ["envoyer", "Envoyer les liens"], ["suivi", "Suivre et relancer"],
  ["participants", "Côté participants"], ["annee-suivante", "L'année suivante"], ["donnees", "Vos données"], ["faq", "Questions fréquentes"],
];

export default function AmiInvisibleHelp() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <Link href="/ami-invisible" className="text-sm font-bold text-gray-500 hover:text-gray-700">← Ami Invisible</Link>
        <div className="text-center">
          <div className="text-5xl">🎁</div>
          <h1 className="text-3xl font-extrabold text-red-600 mt-1">Mode d'emploi</h1>
          <p className="text-gray-500 mt-1">Organiser un tirage au sort de cadeaux en 5 minutes</p>
        </div>

        <nav className="bg-white rounded-3xl shadow p-4 flex flex-wrap gap-2 justify-center">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-xs font-bold text-red-600 border-2 border-red-100 rounded-full px-3 py-1 hover:bg-red-50">{label}</a>
          ))}
        </nav>

        <Section id="principe" icon="🎲" title="Le principe">
          <p>Chaque participant offre un cadeau à une autre personne, tirée au sort. Personne ne sait qui lui offre le sien.</p>
          <p>Vous saisissez les participants, Ami Invisible fait le tirage et envoie à chacun <B>un lien personnel</B> par e-mail. En l'ouvrant, il découvre à qui il offre un cadeau, et à personne d'autre.</p>
          <p>Si vous participez, <B>vous ne voyez pas les paires</B> non plus : vous jouez comme tout le monde.</p>
          <Tip>Il faut un compte apps360 pour organiser (connexion par lien e-mail, sans mot de passe). Les participants, eux, n'ont besoin de rien : juste de leur lien.</Tip>
        </Section>

        <Section id="preparer" icon="📝" title="Préparer le tirage">
          <p>Cliquez sur <B>＋ Nouveau tirage</B>. Tout est enregistré au fil de la saisie : vous pouvez vous arrêter et reprendre plus tard, sur n'importe quel appareil.</p>
          <Steps>
            <Step n={1}><B>Le tirage</B> : son nom, votre prénom (affiché aux participants), si vous participez ou non, le tutoiement ou le vouvoiement des messages. Date, lieu et budget sont facultatifs. Vous pouvez activer la <B>liste de souhaits</B>.</Step>
            <Step n={2}><B>Participants</B> : prénom et e-mail pour chacun (le nom est facultatif). Ajoutez-les un par un, collez une liste toute prête, ou reprenez-les de votre <B>carnet</B>. Si vous participez, ajoutez-vous aussi.</Step>
            <Step n={3}><B>Exclusions</B> (facultatif) : par exemple, pour qu'un couple ne s'offre pas de cadeau. Cochez « dans les deux sens » pour que l'exclusion soit réciproque. Vous pouvez aussi éviter les paires d'un ancien tirage.</Step>
            <Step n={4}><B>Messages</B> : l'e-mail que recevront les participants, et le message affiché quand ils découvrent leur résultat. Les textes par défaut conviennent ; vous pouvez les personnaliser, avec un aperçu.</Step>
            <Step n={5}><B>Tirage</B> : vérifiez le récapitulatif, puis <B>🎲 Effectuer le tirage</B>. Rien n'est encore envoyé.</Step>
          </Steps>
          <Tip>Pour coller une liste : une personne par ligne, prénom, nom puis e-mail, par exemple « Sophie Martin sophie@exemple.fr ». Une liste copiée d'un tableur ou d'un e-mail fonctionne en général telle quelle.</Tip>
        </Section>

        <Section id="envoyer" icon="📨" title="Envoyer les liens">
          <p>Après le tirage, cliquez sur <B>Envoyer les liens par e-mail</B>. Une fenêtre montre l'e-mail tel qu'il sera reçu (choisissez un participant pour voir son aperçu) : retouchez l'objet ou le texte si vous le souhaitez, puis envoyez.</p>
          <p>L'e-mail contient seulement le lien personnel, <B>jamais le résultat</B> : rien ne se trahit dans une boîte de réception partagée ou dans un aperçu de notification.</p>
          <p>Vous pouvez aussi <B>copier le lien</B> d'une personne pour le lui envoyer autrement (SMS, WhatsApp…).</p>
          <Tip>N'ouvrez pas vous-même le lien d'un participant : il affiche son résultat.</Tip>
          <p className="text-sm text-gray-500">Tant qu'aucun lien n'est envoyé, vous pouvez encore <B>refaire le tirage</B> (pour ajouter quelqu'un, changer une exclusion…).</p>
        </Section>

        <Section id="suivi" icon="👀" title="Suivre et relancer">
          <p>Pour chaque participant, vous voyez si son lien a été <B>envoyé</B> et s'il l'a <B>ouvert</B>. Si quelqu'un n'a rien reçu, vérifiez son adresse dans ses courriers indésirables, puis cliquez sur <B>Renvoyer</B>.</p>
          <p>Date, lieu, budget et liste de souhaits restent modifiables après le tirage : les participants voient toujours la dernière version sur leur page.</p>
          <p>Si vous n'avez fait qu'organiser (sans participer), <B>👀 Voir qui offre à qui</B> affiche les paires. Chaque affichage est noté dans le journal du tirage.</p>
          <Tip>Certaines messageries d'entreprise ouvrent automatiquement les liens pour les analyser : un « ouvert » peut alors apparaître sans que la personne ait regardé.</Tip>
        </Section>

        <Section id="participants" icon="🎁" title="Côté participants">
          <p>En cliquant sur son lien, le participant voit tout de suite à qui il offre un cadeau, avec la date, le lieu et le budget s'ils sont indiqués. Il peut rouvrir le lien autant de fois qu'il veut.</p>
          <p>Si la <B>liste de souhaits</B> est activée, il écrit ses idées de cadeaux et voit celles de la personne à qui il offre. Une liste n'est visible que par la personne qui offre le cadeau à son auteur : vous ne la voyez pas, car elle trahirait les paires.</p>
          <p>Il peut aussi <B>supprimer ses coordonnées</B> : son e-mail est effacé, vous en êtes prévenu par e-mail, et son nom reste dans le tirage pour que la personne qui lui offre un cadeau sache toujours à qui elle l'offre.</p>
        </Section>

        <Section id="annee-suivante" icon="🔁" title="L'année suivante">
          <p>Sur votre page d'accueil, cliquez sur <B>Repartir de ce tirage</B> à côté d'un ancien tirage. Vous retrouvez les participants, les exclusions, les options et les messages ; seule la date est à refaire.</p>
          <p>L'ancien tirage est automatiquement coché dans <B>« Éviter les paires d'anciens tirages »</B> : personne n'offrira à la même personne que l'an dernier. Les paires restent secrètes, même pour vous.</p>
          <p>Toutes les personnes de vos tirages rejoignent votre <B>carnet</B>, pour les retrouver en un clic dans un autre tirage.</p>
        </Section>

        <Section id="donnees" icon="🔒" title="Vos données">
          <ul className="list-disc pl-5 space-y-1">
            <li>Vos tirages et votre carnet sont conservés tant que vous utilisez Ami Invisible. Après 11 mois sans utilisation, un e-mail vous propose de tout garder 12 mois de plus, en un clic ; sans réponse, tout est supprimé au bout de 12 mois.</li>
            <li>Les listes de souhaits sont effacées un mois après la date de l'échange (trois mois après le tirage s'il n'y a pas de date).</li>
            <li>Vous pouvez supprimer un tirage (🗑) ou toutes vos données, depuis votre page d'accueil.</li>
          </ul>
          <p>Tout le détail : <Link href="/ami-invisible/confidentialite" className="underline text-red-600">Confidentialité</Link>.</p>
        </Section>

        <Section id="faq" icon="❓" title="Questions fréquentes">
          <Faq q="Un participant n'a pas reçu l'e-mail">
            <p>Demandez-lui de regarder dans ses courriers indésirables (l'expéditeur est noreply@apps360.fr), vérifiez son adresse, puis cliquez sur <B>Renvoyer</B>. Vous pouvez aussi copier son lien et le lui envoyer par message.</p>
          </Faq>
          <Faq q="Je me suis trompé d'adresse e-mail">
            <p>Avant l'envoi, refaites le tirage et corrigez l'adresse à l'étape Participants. Si les liens sont déjà partis, copiez le lien de la personne et envoyez-le-lui directement, ou écrivez-nous à <a href="mailto:contact@apps360.fr" className="underline">contact@apps360.fr</a>.</p>
          </Faq>
          <Faq q="Je dois ajouter quelqu'un après l'envoi">
            <p>Les paires déjà envoyées ne peuvent pas changer sans tout dévoiler. Le plus simple : repartez de ce tirage (bouton sur la page d'accueil), ajoutez la personne, faites un nouveau tirage et renvoyez les liens à tous, en prévenant que le premier tirage est annulé. Supprimez ensuite l'ancien tirage.</p>
          </Faq>
          <Faq q="« Impossible de trouver une combinaison valide »">
            <p>Les exclusions ou les paires à éviter sont trop nombreuses pour le nombre de participants. Retirez une exclusion, ou décochez un ancien tirage à l'étape Exclusions.</p>
          </Faq>
          <Faq q="Je participe : comment savoir à qui j'offre ?">
            <p>Comme tout le monde : par votre propre lien, reçu par e-mail. Pensez à vous ajouter à la liste des participants avec votre adresse.</p>
          </Faq>
          <Faq q="Combien de participants au maximum ?">
            <p>100 par tirage. Au moins 2, mais le jeu est plus amusant à partir de 4 ou 5.</p>
          </Faq>
          <Faq q="C'est gratuit ?">
            <p>Oui, sans publicité. Une question, une idée ? <a href="mailto:contact@apps360.fr" className="underline">contact@apps360.fr</a></p>
          </Faq>
        </Section>

        <div className="text-center pb-4">
          <Link href="/ami-invisible" className="inline-block bg-red-500 hover:bg-red-600 text-white font-bold rounded-full px-8 py-3.5">🎁 Organiser un tirage</Link>
        </div>
      </div>
    </div>
  );
}
