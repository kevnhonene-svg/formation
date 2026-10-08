# Forma — formation en ligne

Première version : application React + TypeScript, Supabase Auth, profils étudiant/formateur, catalogue, inscriptions et salle vidéo WebRTC.

## Étape 1 — Préparer le projet React

Vite démarre le projet local. Dans un terminal ouvert dans le dossier :

```bash
npm install
npm run dev
```

Les pages principales sont accessibles avec React Router : `/`, `/formations`, `/formations/:courseId`, `/dashboard`, `/connexion`, `/inscription` et `/salle/:courseId`. Tailwind est configuré dans `tailwind.config.js`; les styles de marque et les mises en page sont centralisés dans `src/style.css`.

## Étape 2 — Connecter Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **Project Settings → API**, copiez l'URL du projet et la clé publique `anon` ou `publishable`. La clé `service_role` ne doit jamais apparaître dans le navigateur.
3. Copiez `.env.example` en `.env.local` et remplacez les deux valeurs par celles du projet.
4. Dans **SQL Editor**, collez puis exécutez `supabase/schema.sql`.
5. Redémarrez le serveur Vite après avoir créé `.env.local`.

Pour un premier essai, vous pouvez désactiver temporairement la confirmation d'adresse dans **Authentication → Providers → Email**. Sinon, l'étudiant devra confirmer l'e-mail reçu avant de se connecter.

## Étape 3 — Inscription et connexion

Les formulaires utilisent Supabase Auth. L'inscription demande le nom et le rôle. Le déclencheur SQL crée automatiquement le profil dans `profiles`. Les mots de passe ne sont pas stockés par l'application : Supabase Auth les gère.

## Étape 4 — Profils étudiant et formateur

Le rôle est enregistré lors de la création du compte. Les politiques RLS de la base empêchent un compte étudiant de publier des formations. En production, ajoutez une validation des formateurs et empêchez la modification du rôle depuis l'application.

Si un compte a été créé avant l'exécution du schéma et reçoit une erreur RLS lors d'une inscription, exécutez cette réparation dans **Supabase → SQL Editor** :

```sql
insert into public.profiles(id, full_name, role)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', ''),
       case when u.raw_user_meta_data ->> 'role' = 'trainer'
            then 'trainer'::public.app_role else 'student'::public.app_role end
from auth.users as u
on conflict (id) do nothing;
```

Vérifiez ensuite dans **Table Editor → profiles** que votre compte a `role = student`. Seuls les profils étudiant peuvent s'inscrire. Si vous avez créé le compte avec le rôle formateur par erreur, corrigez ce compte précis depuis SQL Editor (remplacez l'adresse) :

```sql
update public.profiles
set role = 'student'
where id = (select id from auth.users where email = 'votre-adresse@example.com');
```

## Étape 5 — Formations et inscriptions

Un formateur peut créer une formation depuis **Mon espace**. Les formations publiées apparaissent dans le catalogue. Un étudiant connecté peut s'inscrire ; une contrainte PostgreSQL évite les inscriptions en double.

## Étape 6 — Première salle de visioconférence

Depuis le détail d'une formation, ouvrez la salle. Le navigateur demande micro et caméra. WebRTC transporte le média entre navigateurs ; Supabase Realtime sert à échanger les informations nécessaires à l'établissement de l'appel et au chat. Le partage d'écran est fourni par l'API navigateur.

Il faut autoriser caméra/micro et utiliser HTTPS (ou `localhost`). Sans connexion, seule la prévisualisation locale est disponible. Cette salle est un prototype pédagogique : la connexion pair-à-pair en maillage a une capacité limitée, aucun serveur TURN n'est configuré, et les sessions ne sont pas encore privées par inscription.

## Interface et progression

Le thème clair/sombre est mémorisé sur l'appareil. Les cartes du catalogue utilisent des images distantes Unsplash ; une connexion Internet est nécessaire pour les afficher. Les valeurs de durée et de notation visibles sur les cartes sont des éléments de présentation. La base actuelle ne contient pas encore les leçons ni le suivi réel de progression ; les espaces indiquent donc clairement les métriques qui ne sont pas encore disponibles.

### Périmètre volontairement simple

Le stockage de fichiers, les vidéos de cours, la progression, la planification des sessions et les grandes classes seront des étapes ultérieures. Les tables Auth, profils, formations et inscriptions sont déjà protégées par RLS.
