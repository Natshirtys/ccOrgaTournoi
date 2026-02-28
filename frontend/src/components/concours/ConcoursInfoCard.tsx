import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConcoursStatusBadge } from './ConcoursStatusBadge';
import {
  ouvrirInscriptions,
  cloturerInscriptions,
  lancerTirage,
  genererTourSuivant,
} from '@/api/concours';
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
};

// ─── Composant principal ──────────────────────────────────────────────────────

interface ConcoursInfoCardProps {
  concours: ConcoursDetail;
}

export function ConcoursInfoCard({ concours }: ConcoursInfoCardProps) {
  const queryClient = useQueryClient();
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['concours'] });
    queryClient.invalidateQueries({ queryKey: ['concours', concours.id] });
  };

  const ouvrirMutation = useMutation({
    mutationFn: () => ouvrirInscriptions(concours.id),
    onSuccess: invalidateAll,
  });

  const cloturerMutation = useMutation({
    mutationFn: () => cloturerInscriptions(concours.id),
    onSuccess: invalidateAll,
  });

  const tirageMutation = useMutation({
    mutationFn: () => lancerTirage(concours.id, {}),
    onSuccess: invalidateAll,
  });

  const tourSuivantMutation = useMutation({
    mutationFn: () => genererTourSuivant(concours.id),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['concours', concours.id, 'matchs'] });
    },
  });

  const statut = concours.statut;
  const typePhase = concours.formule.typePhase ?? concours.phases[0]?.type;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl">{concours.nom}</CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Règles du format"
                >
                  <Info className="h-4 w-4" />
                </button>
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
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Lieu</p>
            <p className="font-medium">{concours.lieu}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Dates</p>
            <p className="font-medium">
              {formatDate(concours.dates.debut)} — {formatDate(concours.dates.fin)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Type</p>
            <p className="font-medium">
              {TYPE_LABELS[concours.formule.typeEquipe] ?? concours.formule.typeEquipe}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Équipes / Terrains</p>
            <p className="font-medium">
              {concours.nbEquipesInscrites} équipes · {concours.nbTerrains} terrains
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {statut === 'BROUILLON' && (
            <Button
              size="sm"
              onClick={() => ouvrirMutation.mutate()}
              disabled={ouvrirMutation.isPending}
            >
              Ouvrir inscriptions
            </Button>
          )}
          {statut === 'INSCRIPTIONS_OUVERTES' && (
            <Button
              size="sm"
              onClick={() => cloturerMutation.mutate()}
              disabled={cloturerMutation.isPending}
            >
              Clôturer inscriptions
            </Button>
          )}
          {statut === 'INSCRIPTIONS_CLOSES' && (
            <Button
              size="sm"
              onClick={() => tirageMutation.mutate()}
              disabled={tirageMutation.isPending}
            >
              Lancer tirage
            </Button>
          )}
          {statut === 'EN_COURS' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => tourSuivantMutation.mutate()}
              disabled={tourSuivantMutation.isPending}
            >
              {tourSuivantMutation.isPending ? 'En cours...' : 'Tour / phase suivant(e)'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
