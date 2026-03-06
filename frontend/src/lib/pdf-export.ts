import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ConcoursDetail, MatchDto, LigneClassementDto } from '@/types/concours';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPE_EQUIPE_LABEL: Record<string, string> = {
  TETE_A_TETE: 'Tête-à-tête',
  DOUBLETTE: 'Doublette',
  TRIPLETTE: 'Triplette',
  QUADRETTE: 'Quadrette',
};

const FORMAT_LABELS: Record<string, string> = {
  POULES: 'Poule classique',
  CHAMPIONNAT: 'Round Robin',
  ELIMINATION_SIMPLE: 'Élim. directe + complémentaire',
  SYSTEME_SUISSE: 'Système Suisse (Aurard)',
};

// Labels de section par type de phase (utilisés quand phaseNom est absent)
const PHASE_SECTION_LABELS: Record<string, string> = {
  POULES: 'Phase de poules',
  CHAMPIONNAT: 'Phase de poules',
  ELIMINATION_SIMPLE: 'Tableau principal',
  CONSOLANTE: 'Tableau complémentaire',
  SYSTEME_SUISSE: 'Système Suisse',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function lastTableY(doc: jsPDF, fallback: number): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

function drawFooter(doc: jsPDF, now: string): void {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(`Imprime le ${now}`, 105, 290, { align: 'center' });
  doc.setTextColor(0);
}

/**
 * Dessine l'en-tête standard (nom, lieu+date, sous-titre, séparateur).
 * Retourne la coordonnée Y disponible après le séparateur.
 */
function drawPageHeader(doc: jsPDF, concours: ConcoursDetail, subtitle: string): number {
  const dateStr = formatDateFr(concours.dates.debut);
  const dateFin = formatDateFr(concours.dates.fin);
  const dateRange =
    concours.dates.debut === concours.dates.fin ? dateStr : `${dateStr} - ${dateFin}`;
  const infoLine = [concours.lieu, dateRange].filter(Boolean).join(' - ');

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(concours.nom, 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(infoLine, 105, 27, { align: 'center' });
  doc.setTextColor(0);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(subtitle, 105, 35, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  doc.setDrawColor(180);
  doc.line(20, 39, 190, 39);
  doc.setDrawColor(0);

  return 45;
}

// ─── Groupage des matchs ──────────────────────────────────────────────────────

interface TourGroup {
  tourNum: number;
  tourNom?: string;
  matchs: MatchDto[];
}

interface PhaseGroup {
  phaseId: string;
  phaseType: string;
  phaseNom?: string;
  tours: TourGroup[];
}

function groupByPhase(matchs: MatchDto[]): PhaseGroup[] {
  const phases = new Map<
    string,
    { phaseType: string; phaseNom?: string; tours: Map<number, { tourNom?: string; matchs: MatchDto[] }> }
  >();

  for (const m of matchs) {
    const key = m.phaseId ?? 'default';
    if (!phases.has(key)) {
      phases.set(key, { phaseType: m.phaseType ?? '', phaseNom: m.phaseNom, tours: new Map() });
    }
    const phase = phases.get(key)!;
    if (!phase.tours.has(m.tourNumero)) {
      phase.tours.set(m.tourNumero, { tourNom: m.tourNom, matchs: [] });
    }
    phase.tours.get(m.tourNumero)!.matchs.push(m);
  }

  return Array.from(phases.entries()).map(([phaseId, { phaseType, phaseNom, tours }]) => ({
    phaseId,
    phaseType,
    phaseNom,
    tours: Array.from(tours.entries())
      .sort(([a], [b]) => a - b)
      .map(([tourNum, data]) => ({ tourNum, ...data })),
  }));
}

// ─── Export : feuilles de match ───────────────────────────────────────────────

export function exportFeuillesDeMatch(
  concours: ConcoursDetail,
  matchs: MatchDto[],
  equipeLookup: Map<string, string>,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = formatDateFr(new Date().toISOString());

  const typeLabel = TYPE_EQUIPE_LABEL[concours.formule.typeEquipe] ?? concours.formule.typeEquipe;
  const typePhase = concours.formule.typePhase;
  const formatLabel = typePhase ? (FORMAT_LABELS[typePhase] ?? typePhase) : '';
  const formulaLine = [typeLabel, formatLabel].filter(Boolean).join(' - ');

  const terrainLookup = new Map<string, number>();
  for (const t of concours.terrains) terrainLookup.set(t.id, t.numero);

  const phaseGroups = groupByPhase(matchs);

  // Ordonner les phases selon l'ordre défini dans concours.phases
  const phaseOrder = new Map<string, number>();
  concours.phases.forEach((p, i) => phaseOrder.set(p.id, i));
  phaseGroups.sort((a, b) => (phaseOrder.get(a.phaseId) ?? 99) - (phaseOrder.get(b.phaseId) ?? 99));

  const hasMultiplePhases = phaseGroups.length > 1;
  let isFirst = true;

  for (const phase of phaseGroups) {
    const phaseLabel = phase.phaseNom ?? PHASE_SECTION_LABELS[phase.phaseType] ?? phase.phaseType;

    for (const tour of phase.tours) {
      if (!isFirst) doc.addPage();
      isFirst = false;

      const tourLabel = tour.tourNom ?? `Tour ${tour.tourNum}`;
      const subtitle = hasMultiplePhases ? `${phaseLabel} - ${tourLabel}` : tourLabel;

      const y = drawPageHeader(doc, concours, subtitle);

      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(formulaLine, 105, y, { align: 'center' });
      doc.setTextColor(0);

      const body = tour.matchs.map((m) => {
        const terrain = m.terrainId ? String(terrainLookup.get(m.terrainId) ?? '') : '';
        const equipeA = equipeLookup.get(m.equipeAId) ?? m.equipeAId;
        const equipeB = equipeLookup.get(m.equipeBId) ?? m.equipeBId;
        const scoreA = m.statut === 'PROGRAMME' ? '' : String(m.score?.equipeA ?? '');
        const scoreB = m.statut === 'PROGRAMME' ? '' : String(m.score?.equipeB ?? '');
        return [terrain, equipeA, equipeB, scoreA, scoreB];
      });

      autoTable(doc, {
        startY: y + 6,
        head: [['Terrain', 'Equipe A', 'Equipe B', 'Score A', 'Score B']],
        body,
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 22 },
          4: { halign: 'center', cellWidth: 22 },
        },
      });

      drawFooter(doc, now);
    }
  }

  doc.save(`feuilles-match-${slugify(concours.nom)}.pdf`);
}

// ─── Export : classement (Système Suisse) ─────────────────────────────────────

export function exportClassement(
  concours: ConcoursDetail,
  classement: LigneClassementDto[],
  equipeLookup: Map<string, string>,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dateStr = formatDateFr(concours.dates.debut);
  const now = formatDateFr(new Date().toISOString());

  const typeLabel = TYPE_EQUIPE_LABEL[concours.formule.typeEquipe] ?? concours.formule.typeEquipe;
  const typePhase = concours.formule.typePhase;
  const formatLabel = typePhase ? (FORMAT_LABELS[typePhase] ?? typePhase) : '';
  const infoLine = [concours.lieu, dateStr, typeLabel, formatLabel].filter(Boolean).join(' - ');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Classement - ${concours.nom}`, 148, 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(infoLine, 148, 26, { align: 'center' });
  doc.setTextColor(0);

  const body = classement.map((l) => [
    String(l.rang),
    equipeLookup.get(l.equipeId) ?? l.equipeId,
    String(l.victoires),
    String(l.defaites),
    String(l.pointsMarques),
    String(l.pointsEncaisses),
    l.goalAverage > 0 ? `+${l.goalAverage}` : String(l.goalAverage),
    String(l.points),
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['Rang', 'Equipe', 'V', 'D', 'PM', 'PE', 'Diff', 'Pts']],
    body,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 18 },
    },
    didParseCell: (data) => {
      // Mettre en gras la ligne du 1er
      if (data.row.index === 0 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Imprime le ${now}`, 148, 200, { align: 'center' });
  doc.setTextColor(0);

  doc.save(`classement-${slugify(concours.nom)}.pdf`);
}

// ─── Export : archive complète ────────────────────────────────────────────────

export function exportArchivePdf(
  concours: ConcoursDetail,
  matchs: MatchDto[],
  classement: LigneClassementDto[],
  equipeLookup: Map<string, string>,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dateStr = formatDateFr(concours.dates.debut);
  const dateFin = formatDateFr(concours.dates.fin);
  const dateRange =
    concours.dates.debut === concours.dates.fin ? dateStr : `${dateStr} - ${dateFin}`;
  const now = formatDateFr(new Date().toISOString());

  const typeLabel = TYPE_EQUIPE_LABEL[concours.formule.typeEquipe] ?? concours.formule.typeEquipe;
  const typePhase = concours.formule.typePhase ?? concours.phases[0]?.type;
  const formatLabel = typePhase ? (FORMAT_LABELS[typePhase] ?? typePhase) : '-';

  // ─── Page 1 : Couverture ──────────────────────────────────────────────────

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(concours.nom, 105, 45, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  if (concours.lieu) doc.text(concours.lieu, 105, 56, { align: 'center' });
  doc.text(dateRange, 105, concours.lieu ? 64 : 56, { align: 'center' });
  doc.setTextColor(0);

  doc.setDrawColor(150);
  doc.line(30, 72, 180, 72);
  doc.setDrawColor(0);

  autoTable(doc, {
    startY: 78,
    body: [
      ["Type d'equipe", typeLabel],
      ['Format', formatLabel],
      ['Equipes inscrites', String(concours.nbEquipesInscrites)],
      ['Terrains', String(concours.nbTerrains)],
    ],
    styles: { fontSize: 11, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    theme: 'plain',
  });

  // Podium
  if (classement.length > 0) {
    const podiumY = lastTableY(doc, 120) + 10;

    doc.setDrawColor(150);
    doc.line(30, podiumY, 180, podiumY);
    doc.setDrawColor(0);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Podium', 105, podiumY + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');

    const medals = ['1er', '2e', '3e'];
    classement.slice(0, 3).forEach((l, i) => {
      const nom = equipeLookup.get(l.equipeId) ?? l.equipeId;
      doc.setFontSize(13);
      doc.text(`${medals[i]}   ${nom}`, 105, podiumY + 24 + i * 11, { align: 'center' });
    });
  }

  drawFooter(doc, now);

  // ─── Page 2 : Equipes inscrites ───────────────────────────────────────────

  doc.addPage();
  let y = drawPageHeader(doc, concours, 'Equipes inscrites');

  const inscriptions = [...concours.inscriptions].sort((a, b) =>
    a.nomEquipe.localeCompare(b.nomEquipe),
  );
  const hasClub = inscriptions.some((i) => i.club);
  const hasJoueurs = inscriptions.some((i) => i.joueurs && i.joueurs.length > 0);

  const inscHead = ['#', 'Equipe'];
  if (hasClub) inscHead.push('Club');
  if (hasJoueurs) inscHead.push('Joueurs');

  const inscBody = inscriptions.map((insc, idx) => {
    const row = [String(idx + 1), insc.nomEquipe];
    if (hasClub) row.push(insc.club ?? '');
    if (hasJoueurs) row.push(insc.joueurs?.join(', ') ?? '');
    return row;
  });

  autoTable(doc, {
    startY: y,
    head: [inscHead],
    body: inscBody,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: { 0: { halign: 'center', cellWidth: 12 } },
  });

  drawFooter(doc, now);

  // ─── Page 3 : Classement final ────────────────────────────────────────────

  if (classement.length > 0) {
    doc.addPage();
    y = drawPageHeader(doc, concours, 'Classement final');

    const classBody = classement.map((l) => [
      String(l.rang),
      equipeLookup.get(l.equipeId) ?? l.equipeId,
      String(l.victoires),
      String(l.defaites),
      String(l.pointsMarques),
      String(l.pointsEncaisses),
      l.goalAverage > 0 ? `+${l.goalAverage}` : String(l.goalAverage),
      String(l.points),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Rang', 'Equipe', 'V', 'D', 'PM', 'PE', 'Diff', 'Pts']],
      body: classBody,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 16 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'center', cellWidth: 18 },
        7: { halign: 'center', cellWidth: 18 },
      },
      didParseCell: (data) => {
        if (data.row.index === 0 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    drawFooter(doc, now);
  }

  // ─── Pages suivantes : Résultats par phase et par tour ───────────────────

  const terrainLookup = new Map<string, number>();
  for (const t of concours.terrains) terrainLookup.set(t.id, t.numero);

  const terminatedMatchs = matchs.filter(
    (m) => m.statut === 'TERMINE' || m.statut === 'FORFAIT',
  );
  const phaseGroups = groupByPhase(terminatedMatchs);

  // Ordonner selon l'ordre des phases du concours
  const phaseOrder = new Map<string, number>();
  concours.phases.forEach((p, i) => phaseOrder.set(p.id, i));
  phaseGroups.sort((a, b) => (phaseOrder.get(a.phaseId) ?? 99) - (phaseOrder.get(b.phaseId) ?? 99));

  for (const phase of phaseGroups) {
    if (phase.tours.every((t) => t.matchs.length === 0)) continue;

    const phaseLabel = phase.phaseNom ?? PHASE_SECTION_LABELS[phase.phaseType] ?? phase.phaseType;

    doc.addPage();
    y = drawPageHeader(doc, concours, phaseLabel);

    let firstTour = true;

    for (const tour of phase.tours) {
      if (tour.matchs.length === 0) continue;

      const tourLabel = tour.tourNom ?? `Tour ${tour.tourNum}`;

      if (!firstTour) {
        const currentY = lastTableY(doc, y);
        if (currentY > 240) {
          doc.addPage();
          y = drawPageHeader(doc, concours, `${phaseLabel} (suite)`);
        } else {
          y = currentY + 10;
        }
      }
      firstTour = false;

      // En-tête du tour
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(tourLabel, 20, y);
      doc.setFont('helvetica', 'normal');
      doc.setDrawColor(200);
      doc.line(20, y + 2, 190, y + 2);
      doc.setDrawColor(0);
      y += 7;

      const body = tour.matchs.map((m) => {
        const terrain = m.terrainId ? String(terrainLookup.get(m.terrainId) ?? '') : '';
        const equipeA = equipeLookup.get(m.equipeAId) ?? m.equipeAId;
        const equipeB = equipeLookup.get(m.equipeBId) ?? m.equipeBId;
        const score =
          m.statut === 'FORFAIT'
            ? 'Forfait'
            : m.score
              ? `${m.score.equipeA} - ${m.score.equipeB}`
              : '-';
        // Mettre en gras le gagnant dans les données
        const aWins = m.score && m.score.equipeA > m.score.equipeB;
        const bWins = m.score && m.score.equipeB > m.score.equipeA;
        return [aWins ? `* ${equipeA}` : equipeA, score, bWins ? `* ${equipeB}` : equipeB, terrain];
      });

      autoTable(doc, {
        startY: y,
        head: [['Equipe A', 'Score', 'Equipe B', 'Terrain']],
        body,
        styles: { fontSize: 10, cellPadding: 2.5 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9 },
        columnStyles: {
          1: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
          3: { halign: 'center', cellWidth: 20 },
        },
      });

      y = lastTableY(doc, y + 20);
    }

    drawFooter(doc, now);
  }

  doc.save(`archive-${slugify(concours.nom)}.pdf`);
}
