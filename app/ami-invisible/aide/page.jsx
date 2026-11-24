/*
 * Ami Invisible — mode d'emploi public (/ami-invisible/aide), lié depuis
 * l'espace organisateur et le message du backoffice.
 * Vocabulaire : « tirage » = l'échange de cadeaux (ex. Noël en famille 2026) ;
 * « tirage au sort » = l'action ; « qui offre à qui » plutôt que « paires ».
 * Les noms des étapes reprennent ceux des onglets de l'app (Infos,
 * Participants, Exclusions, Messages, Tirage).
 * Ancres : #en-bref #principe #preparer #envoyer #suivi #participants #annee-suivante #donnees #faq.
 */
import Link from "next/link";
import AppIcon from "@/components/AppIcon";

export const metadata = {
  title: "Mode d'emploi — Ami Invisible",
  description: "Organiser un échange de cadeaux tiré au sort (Secret Santa) : participants, exclusions, envoi des liens, suivi, liste de souhaits.",
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
  return <ol className="space-y-4">{children}</ol>;
}
function Step({ n, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center">{n}</span>
      <div className="pt-0.5 space-y-1.5 min-w-0">
        {title && <p className="font-bold text-gray-900">{title}</p>}
        {children}
      </div>
    </li>
  );
}
const List = ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>;
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
  ["en-bref", "En bref"], ["principe", "Le principe"], ["preparer", "Préparer"], ["envoyer", "Envoyer les liens"], ["suivi", "Suivre"],
  ["participants", "Côté participants"], ["annee-suivante", "L'année suivante"], ["donnees", "Vos données"], ["faq", "Questions"],
];

export default function AmiInvisibleHelp() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <Link href="/ami-invisible" className="text-sm font-bold text-gray-500 hover:text-gray-700">← Ami Invisible</Link>
        <div className="text-center">
          <AppIcon app="ami-invisible" className="w-16 h-16 shadow-lg" />
          <h1 className="text-3xl font-extrabold text-red-600 mt-1">Mode d'emploi</h1>
          <p className="text-gray-500 mt-1">Organiser un échange de cadeaux tiré au sort, en quelques minutes</p>
        </div>

        <nav className="bg-white rounded-3xl shadow p-4 flex flex-wrap gap-2 justify-center">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-xs font-bold text-red-600 border-2 border-red-100 rounded-full px-3 py-1 hover:bg-red-50">{label}</a>
          ))}
        </nav>

        <Section id="en-bref" icon="⚡" title="En bref">
          <Steps>
            <Step n={1}>Vous créez votre <B>tirage</B> : c'est votre échange de cadeaux, par exemple « Noël en famille 2026 ».</Step>
            <Step n={2}>Vous ajoutez les <B>participants</B> : un prénom et une adresse e-mail pour chacun.</Step>
            <Step n={3}>Ami Invisible fait le <B>tirage au sort</B> : chacun se voit attribuer une personne à qui offrir un cadeau.</Step>
            <Step n={4}>Chaque participant reçoit <B>par e-mail un lien</B> qui lui montre, à lui seul, à qui il offre.</Step>
          </Steps>
        </Section>

        <Section id="principe" icon="🎲" title="Le principe">
          <p>C'est le jeu connu sous le nom de <B>Secret Santa</B> ou « Père Noël secret » : chaque participant offre un cadeau à une autre personne du groupe, tirée au sort. Chacun sait à qui il offre, mais personne ne sait qui lui offre le sien, jusqu'à l'échange.</p>
          <p>Si vous participez vous-même, <B>le résultat ne vous est pas affiché</B> : vous jouez comme tout le monde. Si vous organisez sans participer, vous pouvez voir qui offre à qui.</p>
          <Tip>Pour organiser, il suffit de votre adresse e-mail : vous recevez un lien, vous cliquez, c'est fait. Pas de mot de passe à retenir, pas de formulaire ni d'informations personnelles à remplir. Vous retrouvez ainsi vos tirages d'une fois à l'autre, sur votre téléphone comme sur votre ordinateur. Les participants, eux, n'ont rien à faire : leur lien suffit.</Tip>
        </Section>

        <Section id="preparer" icon="📝" title="Préparer le tirage">
          <p>Cliquez sur <B>＋ Nouveau tirage</B>. La préparation se fait en 5 étapes, une par onglet. Tout est <B>enregistré automatiquement</B> : vous pouvez vous arrêter et reprendre plus tard, même sur un autre appareil.</p>
          <Steps>
            <Step n={1} title="Infos">
              <List>
                <li><B>Nom du tirage</B> : le nom de votre échange de cadeaux, par exemple « Noël en famille 2026 » ou « Cadeaux du bureau ».</li>
                <li><B>Votre prénom</B> : il apparaît dans les messages (« le tirage organisé par Sophie »).</li>
                <li><B>Participez-vous ?</B> « Oui » si vous offrez et recevez un cadeau vous aussi ; « Non » si vous organisez seulement.</li>
                <li><B>Tutoiement ou vouvoiement</B> : la façon dont les messages s'adressent aux participants.</li>
                <li><B>Date, lieu, budget</B> de l'échange : facultatifs, ils sont rappelés aux participants.</li>
                <li><B>Liste de souhaits</B> : si vous l'activez, chaque participant peut noter ses idées de cadeaux pour aider la personne qui lui offre.</li>
              </List>
            </Step>
            <Step n={2} title="Participants">
              <p>Pour chacun : le <B>prénom</B> et l'<B>adresse e-mail</B> (obligatoires), le nom si vous voulez. Si vous participez, ajoutez-vous aussi.</p>
              <p>Trois façons de les ajouter : un par un ; en <B>collant une liste</B> toute prête ; ou depuis votre <B>carnet</B>, qui garde les personnes de vos tirages précédents pour ne pas les ressaisir.</p>
            </Step>
            <Step n={3} title="Exclusions (facultatif)">
              <p>Pour empêcher qu'une personne tombe sur une autre, par exemple pour qu'un couple ne s'offre pas de cadeau. Cochez <B>« dans les deux sens »</B> pour que ni l'un ni l'autre ne puisse tomber sur l'autre.</p>
              <p>Vous pouvez aussi éviter que quelqu'un retombe sur la même personne que lors d'un tirage précédent : cochez ce tirage dans la liste.</p>
            </Step>
            <Step n={4} title="Messages">
              <p>Les participants reçoivent deux textes :</p>
              <List>
                <li><B>l'e-mail</B>, qui contient leur lien personnel (mais pas le résultat) ;</li>
                <li><B>le message de résultat</B>, affiché sur leur page quand ils cliquent sur le lien.</li>
              </List>
              <p>Les textes proposés conviennent ; vous pouvez les personnaliser et voir un aperçu de chacun.</p>
            </Step>
            <Step n={5} title="Tirage">
              <p>Vérifiez le récapitulatif, puis cliquez sur <B>🎲 Effectuer le tirage</B>. Ami Invisible attribue à chacun la personne à qui il offre. <B>Rien n'est encore envoyé</B> à ce stade.</p>
            </Step>
          </Steps>
          <Tip>Pour coller une liste : une personne par ligne, avec prénom, nom puis e-mail, par exemple « Sophie Martin sophie@exemple.fr ». Une liste copiée d'un tableur ou d'un e-mail fonctionne en général telle quelle.</Tip>
        </Section>

        <Section id="envoyer" icon="📨" title="Envoyer les liens">
          <p>Une fois le tirage au sort fait, cliquez sur <B>Envoyer les liens par e-mail</B>. Vous voyez l'e-mail tel que chacun le recevra ; vous pouvez encore le modifier, puis vous l'envoyez à tous en un clic.</p>
          <p>Chaque e-mail contient <B>un lien personnel</B>, propre à chaque participant. Le résultat n'est jamais écrit dans l'e-mail : il ne s'affiche qu'en cliquant sur le lien.</p>
          <p>Avec <B>Envoyer autrement</B>, à côté d'un nom, vous obtenez un message prêt à transmettre par WhatsApp, SMS ou une autre messagerie.</p>
          <Tip>N'ouvrez pas vous-même le lien d'un participant : il affiche à qui il offre. Sa page indique d'ailleurs la date de première ouverture.</Tip>
          <p>Tant qu'aucun lien n'est parti, le bouton <B>Refaire le tirage</B> vous ramène à la préparation, pour ajouter quelqu'un ou changer une exclusion. Le tirage au sort sera refait entièrement : chacun peut tomber sur une autre personne.</p>
        </Section>

        <Section id="suivi" icon="👀" title="Suivre et relancer">
          <p>Pour chaque participant, vous voyez :</p>
          <List>
            <li><B>Envoyé</B> : l'e-mail est parti ;</li>
            <li><B>Ouvert</B> : la personne a cliqué sur son lien et vu son résultat.</li>
          </List>
          <p>Quelqu'un n'a rien reçu ? Demandez-lui de regarder dans ses courriers indésirables, puis cliquez sur <B>Renvoyer</B> à côté de son nom.</p>
          <p>La date, le lieu, le budget et la liste de souhaits restent modifiables après le tirage au sort : les participants voient toujours la dernière version.</p>
          <p>Si vous organisez sans participer, le bouton <B>👀 Voir qui offre à qui</B> affiche le résultat complet. Chaque affichage est enregistré, par souci de transparence.</p>
        </Section>

        <Section id="participants" icon="🎁" title="Côté participants">
          <p>En cliquant sur son lien, le participant voit tout de suite à qui il offre un cadeau, avec la date, le lieu et le budget s'ils sont indiqués. Il peut rouvrir le lien autant de fois qu'il veut. Aucun compte à créer, rien à installer.</p>
          <p>Si la <B>liste de souhaits</B> est activée, il note ses idées de cadeaux et voit celles de la personne à qui il offre. Seule la personne qui doit lui offrir un cadeau voit sa liste : ni vous, ni les autres participants (ce qui trahirait le secret).</p>
          <p>Il peut aussi <B>supprimer ses coordonnées</B>. Son e-mail est alors effacé et vous êtes prévenu par e-mail. Son nom reste dans le tirage, pour que la personne qui lui offre un cadeau sache toujours à qui elle l'offre.</p>
        </Section>

        <Section id="annee-suivante" icon="🔁" title="L'année suivante">
          <p>Sur votre page d'accueil, cliquez sur <B>Repartir de ce tirage</B> à côté d'un ancien tirage. Vous retrouvez les participants, les exclusions, les options et les messages : vous n'avez plus rien à ressaisir, seule la date est à indiquer.</p>
          <p>L'ancien tirage est automatiquement coché pour que <B>personne ne retombe sur la même personne</B> que la fois précédente. Vous ne voyez toujours pas qui offrait à qui.</p>
          <p>Les personnes de vos tirages sont aussi gardées dans votre <B>carnet</B>, pour les ajouter en un clic à un tout autre tirage.</p>
        </Section>

        <Section id="donnees" icon="🔒" title="Vos données">
          <List>
            <li>Vos tirages et votre carnet sont conservés tant que vous utilisez Ami Invisible. Après 11 mois sans utilisation, un e-mail vous propose de tout garder 12 mois de plus, en un clic ; sans réponse, tout est supprimé au bout de 12 mois.</li>
            <li>Les listes de souhaits sont effacées un mois après la date de l'échange (trois mois après le tirage au sort s'il n'y a pas de date).</li>
            <li>Vous pouvez supprimer un tirage (🗑) ou toutes vos données, depuis votre page d'accueil.</li>
          </List>
          <p>Tout le détail : <Link href="/ami-invisible/confidentialite" className="underline text-red-600">Confidentialité</Link>.</p>
        </Section>

        <Section id="faq" icon="❓" title="Questions fréquentes">
          <Faq q="Les participants doivent-ils créer un compte ou installer quelque chose ?">
            <p>Non. Ils cliquent sur le lien reçu par e-mail, c'est tout.</p>
          </Faq>
          <Faq q="Un participant n'a pas reçu l'e-mail, ou l'a effacé">
            <p>Demandez-lui de regarder dans ses courriers indésirables (l'expéditeur est noreply@apps360.fr), vérifiez son adresse, puis cliquez sur <B>Renvoyer</B> à côté de son nom. Si sa messagerie bloque l'e-mail, utilisez <B>Modifier l'adresse</B> ou <B>Envoyer autrement</B>.</p>
          </Faq>
          <Faq q="Je me suis trompé d'adresse e-mail">
            <p>Cliquez sur <B>Modifier l'adresse</B> à côté de son nom, même après l'envoi. Si l'e-mail était déjà parti, un nouveau lien est envoyé à la bonne adresse et l'ancien ne fonctionne plus.</p>
          </Faq>
          <Faq q="Je dois ajouter quelqu'un après l'envoi">
            <p>On ne peut pas modifier un tirage au sort déjà envoyé sans trahir le secret. Le plus simple : sur la page d'accueil, cliquez sur <B>Repartir de ce tirage</B>, ajoutez la personne, refaites le tirage au sort et envoyez les nouveaux liens à tous, en prévenant que le premier tirage est annulé. Supprimez ensuite l'ancien tirage (🗑).</p>
          </Faq>
          <Faq q="Je peux encore changer la date, le lieu ou le budget ?">
            <p>Oui, à tout moment, dans le tirage. Les participants voient la nouvelle version en rouvrant leur lien.</p>
          </Faq>
          <Faq q="Je participe : comment savoir à qui j'offre ?">
            <p>Comme tout le monde : avec votre propre lien, reçu par e-mail. Pensez à vous ajouter à la liste des participants, avec votre adresse.</p>
          </Faq>
          <Faq q="« Impossible de trouver une combinaison valide »">
            <p>Il y a trop d'exclusions pour le nombre de participants : le tirage au sort ne trouve aucune solution qui les respecte toutes. Retirez une exclusion, ou décochez un ancien tirage, à l'étape Exclusions.</p>
          </Faq>
          <Faq q="Un participant est marqué « ouvert » alors qu'il dit ne pas avoir regardé">
            <p>Certaines messageries, surtout professionnelles, ouvrent automatiquement les liens pour vérifier qu'ils sont sans danger. Cela peut compter comme « ouvert ».</p>
          </Faq>
          <Faq q="Combien de participants au maximum ?">
            <p>100 par tirage. Il en faut au moins 2, mais le jeu est plus amusant à partir de 4 ou 5.</p>
          </Faq>
          <Faq q="C'est gratuit ?">
            <p>Oui, sans publicité. Une question, une idée ? <a href="mailto:contact@apps360.fr" className="underline">contact@apps360.fr</a></p>
          </Faq>
        </Section>

        <div className="text-center pb-4">
          <Link href="/ami-invisible" className="inline-block bg-red-500 hover:bg-red-600 text-white font-bold rounded-full px-8 py-3.5">Organiser un tirage</Link>
        </div>
      </div>
    </div>
  );
}
