import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { ActionError } from '@/components/ui/action-error';
import { ArrowRight, CheckCircle2, Compass, Download, Info, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ConcoursStatusBadge } from './ConcoursStatusBadge';
import {
  ouvrirInscriptions,
  cloturerInscriptions,
  lancerTirage,
  genererTourSuivant,
  terminerConcours,
  exporterSauvegardeConcours,
  annulerDerniereAction,
} from '@/api/concours';
import { telechargerSauvegarde } from '@/lib/concours-backup';
import type { ConcoursDetail, TypePhase } from '@/types/concours';

const TYPE_LABELS: Record<string, string> = {
  TETE_A_TETE: 'Tête-à-tête',
  DOUBLETTE: 'Doublette',
  TRIPLETTE: 'Triplette',
  QUADRETTE: 'Quadrette',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR');
}

function formatDates(debut: string, fin: string) {
  return debut === fin ? formatDate(debut) : `${formatDate(debut)} — ${formatDate(fin)}`;
}

// ─── Règles par format ────────────────────────────────────────────────────────

function FormatRulesContent({ typePhase }: { typePhase?: TypePhase }) {
  if (typePhase === 'POULES') {
    return (
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="mb-1 font-semibold">Format GSL — Phase de poules</h3>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>Poules de 4 équipes, 5 matchs par poule</li>
            <li>M1 : A-B et C-D (1ère ronde)</li>
            <li>M2 : Gagnants vs Gagnants, Perdants vs Perdants</li>
            <li>M3 : Barrage (perdant du M2 pour la 3e place)</li>
            <li>1er et 2e qualifiés, 3e et 4e éliminés</li>
          </ul>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Phase finale</h3>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>Tableau d'élimination directe</li>
            <li>Croisement classique : 1er poule A vs 2e poule B, etc.</li>
          </ul>
        </section>
      </div>
    );
  }

  if (typePhase === 'CHAMPIONNAT') {
    return (
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="mb-1 font-semibold">Phase de poules — Round Robin</h3>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>Poules de 4 équipes, 6 matchs en 3 tours (round-robin complet)</li>
            <li>Tour 1 : A-B / C-D</li>
            <li>Tour 2 : A-C / B-D</li>
            <li>Tour 3 : A-D / B-C</li>
            <li>Nombre d'équipes : 8, 16, 32 ou 64</li>
          </ul>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Classement des poules (4 critères)</h3>
          <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
            <li>Points (Victoire = 2 pts, Défaite = 0 pt)</li>
            <li>Différence de score (marqués − encaissés)</li>
            <li>Confrontation directe (si exactement 2 équipes ex-aequo)</li>
            <li>Score marqué total</li>
          </ol>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">3 Championnats d'élimination directe</h3>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li><span className="font-medium text-green-700">Championnat A</span> — 1ers de chaque poule</li>
            <li><span className="font-medium text-blue-700">Championnat B</span> — 2es de chaque poule</li>
            <li><span className="font-medium text-orange-600">Championnat C</span> — 3es de chaque poule</li>
            <li>4es de poule éliminés</li>
          </ul>
        </section>
      </div>
    );
  }

  if (typePhase === 'ELIMINATION_SIMPLE') {
    return (
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="mb-1 font-semibold">Élimination directe</h3>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>Le perdant de chaque match est immédiatement éliminé</li>
            <li>Le vainqueur avance au tour suivant</li>
            <li>Le vainqueur de la finale remporte le concours</li>
          </ul>
        </section>
      </div>
    );
  }

  if (typePhase === 'SYSTEME_SUISSE') {
    return (
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="mb-1 font-semibold">Principe</h3>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>Tous les participants jouent le même nombre de tours</li>
            <li>À chaque tour, les équipes ayant le même nombre de points sont appariées</li>
            <li>Aucune équipe ne rencontre deux fois la même adversaire</li>
            <li>Nombre de tours recommandé : log₂ du nombre d'équipes (ex. 4 tours pour 16 équipes)</li>
          </ul>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Barème de points</h3>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li><span className="font-medium">Victoire</span> = 2 points</li>
            <li><span className="font-medium">Défaite</span> = 0 point</li>
            <li>Pas de match nul en sport-boules</li>
          </ul>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Classement final (critères par ordre)</h3>
          <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
            <li>Points cumulés</li>
            <li>Différence de score (marqués − encaissés)</li>
            <li>Points marqués total</li>
          </ol>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Appariement Aurard</h3>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>Tour 1 : tirage aléatoire</li>
            <li>Tours suivants : 1er vs 2e, 3e vs 4e, etc. parmi les équipes de même score</li>
            <li>Si nombre impair d'équipes à un niveau : le dernier joue contre le premier du groupe inférieur</li>
          </ul>
        </section>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Aucune règle disponible pour ce format.
    </p>
  );
}

const FORMAT_TITLES: Partial<Record<TypePhase, string>> = {
  POULES: 'Format GSL (Poules + Finale)',
  CHAMPIONNAT: 'Format Championnat (Round Robin + KO)',
  ELIMINATION_SIMPLE: 'Élimination directe',
  SYSTEME_SUISSE: 'Système Suisse (Aurard)',
};

const FORMAT_SHORT: Partial<Record<TypePhase, string>> = {
  POULES: 'Poule classique',
  CHAMPIONNAT: 'Round Robin',
  ELIMINATION_SIMPLE: 'Élim. directe + complémentaire',
  SYSTEME_SUISSE: 'Système Suisse (Aurard)',
};

// ─── Composant principal ──────────────────────────────────────────────────────

interface ConcoursInfoCardProps {
  concours: ConcoursDetail;
  onNavigateToTab?: (tab: string) => void;
}

export function ConcoursInfoCard({ concours, onNavigateToTab }: ConcoursInfoCardProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['concours'] });
    queryClient.invalidateQueries({ queryKey: ['concours', concours.id] });
  };

  const ouvrirMutation = useMutation({
    mutationFn: () => ouvrirInscriptions(concours.id),
    onSuccess: () => {
      invalidateAll();
      onNavigateToTab?.('inscriptions');
    },
  });

  const cloturerMutation = useMutation({
    mutationFn: () => cloturerInscriptions(concours.id),
    onSuccess: invalidateAll,
  });

  const tirageMutation = useMutation({
    mutationFn: () => lancerTirage(concours.id, {}),
    onSuccess: () => {
      invalidateAll();
      onNavigateToTab?.('matchs');
    },
  });

  const tourSuivantMutation = useMutation({
    mutationFn: () => genererTourSuivant(concours.id),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['concours', concours.id, 'matchs'] });
      onNavigateToTab?.('matchs');
    },
  });

  const terminerMutation = useMutation({
    mutationFn: () => terminerConcours(concours.id),
    onSuccess: invalidateAll,
  });

  const sauvegardeMutation = useMutation({
    mutationFn: () => exporterSauvegardeConcours(concours.id),
    onSuccess: (sauvegarde) => telechargerSauvegarde(sauvegarde, concours.nom),
  });

  const annulationMutation = useMutation({
    mutationFn: () => annulerDerniereAction(concours.id),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['concours', concours.id, 'matchs'] });
    },
  });

  const statut = concours.statut;
  const prochaineAction = concours.prochaineAction;
  const typePhase = concours.formule.typePhase ?? concours.phases[0]?.type;
  const actionError = ouvrirMutation.error
    ?? cloturerMutation.error
    ?? tirageMutation.error
    ?? tourSuivantMutation.error
    ?? terminerMutation.error
    ?? sauvegardeMutation.error
    ?? annulationMutation.error;

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-xl">{concours.nom}</CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5 rounded-full border-primary/30 px-3 text-xs text-primary hover:border-primary hover:bg-primary/10 sm:h-7"
                >
                  <Info className="h-3.5 w-3.5" />
                  Règles
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {typePhase ? (FORMAT_TITLES[typePhase] ?? typePhase) : 'Règles du concours'}
                  </DialogTitle>
                </DialogHeader>
                <FormatRulesContent typePhase={typePhase} />
              </DialogContent>
            </Dialog>
          </div>
          <ConcoursStatusBadge statut={statut} />
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          {concours.lieu && (
            <div>
              <p className="text-muted-foreground">Lieu</p>
              <p className="font-medium">{concours.lieu}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Date</p>
            <p className="font-medium">{formatDates(concours.dates.debut, concours.dates.fin)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Type</p>
            <p className="font-medium">
              {TYPE_LABELS[concours.formule.typeEquipe] ?? concours.formule.typeEquipe}
            </p>
          </div>
          {typePhase && (
            <div>
              <p className="text-muted-foreground">Format</p>
              <p className="font-medium">
                {FORMAT_SHORT[typePhase] ?? typePhase}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Équipes / Terrains</p>
            <p className="font-medium">
              {concours.nbEquipesInscrites} équipes · {concours.nbTerrains} terrains
            </p>
          </div>
        </div>
        {isAuthenticated && (
          <section className="mt-5 overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.04] [&_button]:min-h-11 sm:[&_button]:min-h-9">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  {prochaineAction.code === 'AUCUNE'
                    ? <CheckCircle2 className="h-5 w-5" />
                    : <Compass className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                    Prochaine action
                  </p>
                  <h3 className="mt-0.5 font-semibold text-foreground">{prochaineAction.titre}</h3>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {prochaineAction.description}
                  </p>
                  {prochaineAction.progression && (
                    <div className="mt-3 max-w-md">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{prochaineAction.progression.libelle}</span>
                        <span className="font-semibold text-foreground">
                          {Math.round(
                            (prochaineAction.progression.valeur / prochaineAction.progression.total) * 100,
                          )}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-primary/15"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={prochaineAction.progression.total}
                        aria-valuenow={prochaineAction.progression.valeur}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              (prochaineAction.progression.valeur / prochaineAction.progression.total) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 sm:pl-3">
                {prochaineAction.code === 'OUVRIR_INSCRIPTIONS' && (
                  <Button onClick={() => ouvrirMutation.mutate()} disabled={ouvrirMutation.isPending}>
                    Ouvrir les inscriptions <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {prochaineAction.code === 'COMPLETER_INSCRIPTIONS' && (
                  <Button onClick={() => onNavigateToTab?.('inscriptions')}>
                    Voir les inscriptions <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {prochaineAction.code === 'CLOTURER_INSCRIPTIONS' && (
                  <Button onClick={() => cloturerMutation.mutate()} disabled={cloturerMutation.isPending}>
                    Clôturer <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {prochaineAction.code === 'LANCER_TIRAGE' && (
                  <Button onClick={() => tirageMutation.mutate()} disabled={tirageMutation.isPending}>
                    Lancer le tirage <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {prochaineAction.code === 'JOUER_MATCHS' && (
                  <Button onClick={() => onNavigateToTab?.('matchs')}>
                    Voir les matchs <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {prochaineAction.code === 'GENERER_SUITE' && (
                  <Button
                    onClick={() => tourSuivantMutation.mutate()}
                    disabled={tourSuivantMutation.isPending}
                  >
                    {tourSuivantMutation.isPending ? 'Génération…' : 'Générer la suite'}
                    {!tourSuivantMutation.isPending && <ArrowRight className="h-4 w-4" />}
                  </Button>
                )}
                {prochaineAction.code === 'TERMINER_CONCOURS' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={terminerMutation.isPending}>
                        Terminer le concours <ArrowRight className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Terminer le concours ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Le concours passera en statut <strong>TERMINÉ</strong>. Tous les matchs doivent être joués.
                          Cette action est irréversible (sauf archivage).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => terminerMutation.mutate()}>
                          Terminer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </section>
        )}

        {isAuthenticated && (
          <div className="mt-3 flex flex-wrap gap-2">
            {concours.derniereActionAnnulable && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 gap-1.5 sm:h-8"
                    disabled={annulationMutation.isPending}
                  >
                    <Undo2 className="h-4 w-4" />
                    Annuler : {concours.derniereActionAnnulable.libelle}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Annuler la dernière action ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      « {concours.derniereActionAnnulable.libelle} » sera annulée et l’état précédent
                      des matchs et des terrains sera restauré. Cette annulation ne pourra pas être rejouée.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Conserver l’action</AlertDialogCancel>
                    <AlertDialogAction onClick={() => annulationMutation.mutate()}>
                      Annuler l’action
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-10 gap-1.5 text-muted-foreground sm:h-8"
              onClick={() => sauvegardeMutation.mutate()}
              disabled={sauvegardeMutation.isPending}
            >
              <Download className="h-4 w-4" />
              {sauvegardeMutation.isPending ? 'Export…' : 'Sauvegarde JSON'}
            </Button>
          </div>
        )}
        <div className="mt-3">
          <ActionError error={actionError} />
        </div>
      </CardContent>
    </Card>
  );
}
