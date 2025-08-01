This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:


# GTT-AI

Assistant IA Grant Thornton

---

## Présentation

GTT-AI est une application web Next.js qui sert d'assistant IA pour le cabinet Grant Thornton. Elle permet aux utilisateurs de poser des questions sur les services de Grant Thornton, d'analyser des documents PDF, et d'obtenir des réponses professionnelles et personnalisées en français.

---

## Fonctionnalités principales

- **Chat IA** : Posez des questions sur Grant Thornton, ses services, ou des sujets financiers/fiscaux. L'IA répond en français, de façon professionnelle et adaptée au contexte Grant Thornton.
- **Upload et analyse de PDF** : Téléchargez un document PDF, l'application extrait le texte et l'envoie à l'IA pour analyse. L'IA fournit des insights sur le contenu du document en lien avec les domaines d'expertise Grant Thornton (audit, fiscalité, conseil, etc.).
- **Aperçu PDF** : Visualisez le PDF uploadé dans une fenêtre latérale rétractable, avec possibilité de fermer ou rouvrir l'aperçu.
- **Copie rapide** : Copiez facilement les réponses de l'IA ou vos propres messages.
- **Interface moderne** : UI responsive, palette personnalisée, boutons animés, design professionnel.
- **Lien LinkedIn** : Accédez au profil LinkedIn du développeur via un bouton dédié dans l'en-tête.

---

## Installation

1. **Cloner le projet**
   ```sh
   git clone https://github.com/Maxonemon/gtt-ai.git
   cd gtt-ai
   ```
2. **Installer les dépendances**
   ```sh
   npm install
   ```
3. **Configurer la clé API Mistral**
   - Créez un fichier `.env.local` à la racine du projet.
   - Ajoutez votre clé API Mistral :
     ```env
     MISTRAL_API_KEY=VOTRE_CLE_API_MISTRAL
     ```
4. **Lancer l'application**
   ```sh
   npm run dev
   ```
   L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

---

## Documentation des fonctionnalités

### 1. Chat IA
- Entrez votre question dans la zone de saisie.
- Cliquez sur le bouton d'envoi (flèche) pour recevoir une réponse IA.
- Les réponses sont contextualisées pour Grant Thornton.

### 2. Upload et analyse de PDF
- Cliquez sur le bouton d'upload (icône PDF) dans la zone de saisie.
- Sélectionnez un fichier PDF.
- Le texte est extrait côté client et envoyé à l'IA pour analyse.
- L'aperçu du PDF s'affiche à droite, rétractable.
- Vous pouvez fermer l'aperçu ou supprimer le PDF à tout moment.

### 3. Aperçu PDF
- Fenêtre latérale à droite, occupe toute la hauteur.
- Bouton pour fermer/rétracter ou rouvrir l'aperçu.
- Design moderne, responsive.

### 4. Copie rapide
- Bouton "copier" sous chaque message IA ou utilisateur.
- Tooltip "Copier" au survol.

### 5. Lien LinkedIn
- Bouton LinkedIn dans l'en-tête, même style que l'ancien bouton plus.
- Redirige vers le profil LinkedIn du développeur.

---

## Technologies utilisées
- **Next.js** (App Router)
- **React**
- **Tailwind CSS**
- **lucide-react** (icônes)
- **pdfjs-dist** (extraction texte PDF côté client)
- **Mistral AI SDK** (streaming réponse IA)

---

## Conseils d'utilisation
- Les réponses IA sont en français et adaptées au contexte Grant Thornton.
- Les documents PDF doivent être non protégés et en texte (pas d'image scannée).
- La clé API Mistral est requise pour le fonctionnement du chat IA.

---

## Déploiement

Pour déployer l'application sur Vercel ou autre plateforme compatible Next.js :
- Renseignez la variable d'environnement `MISTRAL_API_KEY` dans la configuration du service.
- Suivez les instructions de déploiement Next.js.

---

## Auteur
- Développé par Malick Sy ([LinkedIn](https://www.linkedin.com/in/malicksy/))

---

## Licence
Ce projet est open-source, licence MIT.
