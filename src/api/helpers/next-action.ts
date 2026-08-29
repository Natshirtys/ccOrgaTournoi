import { Concours } from '../../domain/concours/entities/concours.js';
import { StatutConcours, StatutMatch, StatutPhase } from '../../domain/shared/enums.js';

export type CodeProchaineAction =
  | 'OUVRIR_INSCRIPTIONS'
  | 'COMPLETER_INSCRIPTIONS'
  | 'CLOTURER_INSCRIPTIONS'
  | 'LANCER_TIRAGE'
  | 'JOUER_MATCHS'
  | 'GENERER_SUITE'
  | 'TERMINER_CONCOURS'
  | 'AUCUNE';

export interface ProchaineAction {
  code: CodeProchaineAction;
  titre: string;
  description: string;
  progression?: {
    valeur: number;
    total: number;
    libelle: string;
  };
}

const STATUTS_MATCH_TERMINES = new Set<StatutMatch>([
  StatutMatch.TERMINE,
  StatutMatch.FORFAIT,
  StatutMatch.ABANDON,
  StatutMatch.BYE,
]);

export function obtenirProchaineAction(concours: Concours): ProchaineAction {
  switch (concours.statut) {
    case StatutConcours.BROUILLON:
      return {
        code: 'OUVRIR_INSCRIPTIONS',
        titre: 'Ouvrir les inscriptions',
        description: 'Le concours est prêt. Ouvrez les inscriptions pour commencer à enregistrer les équipes.',
      };

    case StatutConcours.INSCRIPTIONS_OUVERTES: {
      const inscrites = concours.inscriptionsActives.length;
      const minimum = concours.formule.nbEquipesMin;
      const manquantes = Math.max(0, minimum - inscrites);

      if (manquantes > 0) {
        return {
          code: 'COMPLETER_INSCRIPTIONS',
          titre: `Inscrire encore ${manquantes} équipe${manquantes > 1 ? 's' : ''}`,
          description: `Il faut au moins ${minimum} équipes pour pouvoir clôturer les inscriptions.`,
          progression: {
            valeur: inscrites,
            total: minimum,
            libelle: `${inscrites} sur ${minimum} équipes minimum`,
          },
        };
      }

      return {
        code: 'CLOTURER_INSCRIPTIONS',
        titre: 'Clôturer les inscriptions',
        description: `${inscrites} équipes sont inscrites. Vous pouvez maintenant préparer le tirage.`,
      };
    }

    case StatutConcours.INSCRIPTIONS_CLOSES:
      return {
        code: 'LANCER_TIRAGE',
        titre: 'Lancer le tirage',
        description: `${concours.inscriptionsActives.length} équipes seront réparties selon le format du concours.`,
      };

    case StatutConcours.TIRAGE_EN_COURS:
      return {
        code: 'AUCUNE',
        titre: 'Tirage en cours',
        description: 'La répartition des équipes est en cours de calcul.',
      };

    case StatutConcours.EN_COURS: {
      const matchs = concours.phases.flatMap((phase) =>
        phase.tours.flatMap((tour) => tour.matchs),
      );
      const matchsTermines = matchs.filter((match) => STATUTS_MATCH_TERMINES.has(match.statut));
      const matchsRestants = matchs.length - matchsTermines.length;

      if (matchsRestants > 0) {
        const matchsEnCours = matchs.filter((match) => match.statut === StatutMatch.EN_COURS).length;
        return {
          code: 'JOUER_MATCHS',
          titre: `${matchsRestants} résultat${matchsRestants > 1 ? 's' : ''} à renseigner`,
          description: matchsEnCours > 0
            ? `${matchsEnCours} match${matchsEnCours > 1 ? 's sont' : ' est'} actuellement en cours.`
            : 'Démarrez les matchs programmés et saisissez leurs résultats.',
          progression: {
            valeur: matchsTermines.length,
            total: matchs.length,
            libelle: `${matchsTermines.length} sur ${matchs.length} matchs terminés`,
          },
        };
      }

      const phaseEnCours = concours.phases.some((phase) => phase.statut === StatutPhase.EN_COURS);
      if (phaseEnCours) {
        return {
          code: 'GENERER_SUITE',
          titre: 'Générer la suite du concours',
          description: 'Tous les matchs actuellement programmés sont terminés. Créez le prochain tour ou la prochaine phase.',
        };
      }

      return {
        code: 'TERMINER_CONCOURS',
        titre: 'Terminer le concours',
        description: 'Toutes les phases et tous les matchs sont terminés. Le concours peut être clôturé.',
      };
    }

    case StatutConcours.TERMINE:
      return {
        code: 'AUCUNE',
        titre: 'Concours terminé',
        description: 'Les résultats sont définitifs. Vous pouvez sauvegarder le concours puis l’archiver depuis la liste.',
      };

    case StatutConcours.ARCHIVE:
      return {
        code: 'AUCUNE',
        titre: 'Concours archivé',
        description: 'Ce concours est conservé en lecture seule.',
      };
  }
}
