import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ConcoursDetail, MatchDto, LigneClassementDto } from '@/types/concours';

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
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

const TYPE_EQUIPE_LABEL: Record<string, string> = {
  TETE_A_TETE: 'Tête-à-tête',
  DOUBLETTE: 'Doublette',
  TRIPLETTE: 'Triplette',
  QUADRETTE: 'Quadrette',
};

export function exportFeuillesDeMatch(
  concours: ConcoursDetail,
  matchs: MatchDto[],
  equipeLookup: Map<string, string>,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const terrainLookup = new Map<string, number>();
  for (const t of concours.terrains) {
    terrainLookup.set(t.id, t.numero);
  }

  // Group matches by tour
  const grouped = new Map<number, MatchDto[]>();
  for (const m of matchs) {
    if (!grouped.has(m.tourNumero)) grouped.set(m.tourNumero, []);
    grouped.get(m.tourNumero)!.push(m);
  }
  const tours = Array.from(grouped.entries()).sort(([a], [b]) => a - b);

  const typeLabel = TYPE_EQUIPE_LABEL[concours.formule.typeEquipe] ?? concours.formule.typeEquipe;
  const dateStr = formatDateFr(concours.dates.debut);
  const now = formatDateFr(new Date().toISOString());

  tours.forEach(([tour, tourMatchs], index) => {
    if (index > 0) doc.addPage();

    // Header
    doc.setFontSize(16);
    doc.text(concours.nom, 105, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`${concours.lieu} — ${dateStr} — ${typeLabel}`, 105, 28, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`Tour ${tour}`, 105, 38, { align: 'center' });

    // Table
    const body = tourMatchs.map((m) => {
      const terrain = m.terrainId ? terrainLookup.get(m.terrainId) ?? '' : '';
      const equipeA = equipeLookup.get(m.equipeAId) ?? m.equipeAId;
      const equipeB = equipeLookup.get(m.equipeBId) ?? m.equipeBId;
      const scoreA = m.statut === 'PROGRAMME' ? '' : String(m.score?.equipeA ?? '');
      const scoreB = m.statut === 'PROGRAMME' ? '' : String(m.score?.equipeB ?? '');
      return [String(terrain), equipeA, equipeB, scoreA, scoreB];
    });

    autoTable(doc, {
      startY: 44,
      head: [['Terrain', 'Équipe A', 'Équipe B', 'Score A', 'Score B']],
      body,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 20 },
      },
    });

    // Footer
    doc.setFontSize(8);
    doc.text(`Imprimé le ${now}`, 105, 290, { align: 'center' });
  });

  doc.save(`feuilles-match-${slugify(concours.nom)}.pdf`);
}

export function exportClassement(
  concours: ConcoursDetail,
  classement: LigneClassementDto[],
  equipeLookup: Map<string, string>,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const dateStr = formatDateFr(concours.dates.debut);
  const now = formatDateFr(new Date().toISOString());

  // Header
  doc.setFontSize(16);
  doc.text(`Classement — ${concours.nom}`, 148, 18, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${concours.lieu} — ${dateStr}`, 148, 26, { align: 'center' });

  // Table
  const body = classement.map((l) => [
    String(l.rang),
    equipeLookup.get(l.equipeId) ?? l.equipeId,
    String(l.points),
    String(l.victoires),
    String(l.nuls),
    String(l.defaites),
    String(l.pointsMarques),
    String(l.pointsEncaisses),
    String(l.goalAverage),
    l.qualifiee ? 'Oui' : '',
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['Rang', 'Équipe', 'Pts', 'V', 'N', 'D', 'PM', 'PE', 'GA', 'Qualifiée']],
    body,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 18 },
      9: { halign: 'center', cellWidth: 22 },
    },
  });

  // Footer
  doc.setFontSize(8);
  doc.text(`Imprimé le ${now}`, 148, 200, { align: 'center' });

  doc.save(`classement-${slugify(concours.nom)}.pdf`);
}

export function exportArchivePdf(
  concours: ConcoursDetail,
  matchs: MatchDto[],
  classement: LigneClassementDto[],
  equipeLookup: Map<string, string>,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dateStr = formatDateFr(concours.dates.debut);
  const dateFin = formatDateFr(concours.dates.fin);
  const now = formatDateFr(new Date().toISOString());
  const typeLabel = TYPE_EQUIPE_LABEL[concours.formule.typeEquipe] ?? concours.formule.typeEquipe;
  const typePhase = concours.formule.typePhase ?? '—';

  // ─── Page 1 : Fiche récapitulative ─────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(concours.nom, 105, 28, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${concours.lieu || '—'}`, 105, 38, { align: 'center' });
  doc.text(
    concours.dates.debut === concours.dates.fin ? dateStr : `${dateStr} — ${dateFin}`,
    105,
    46,
    { align: 'center' },
  );

  doc.setFontSize(11);
  const infoRows = [
    ['Type d\'équipe', typeLabel],
    ['Format', typePhase],
    ['Équipes inscrites', String(concours.nbEquipesInscrites)],
    ['Terrains', String(concours.nbTerrains)],
  ];
  autoTable(doc, {
    startY: 56,
    body: infoRows,
    styles: { fontSize: 11, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    theme: 'plain',
  });

  // Podium top 3
  if (classement.length > 0) {
    const lastInfoY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 90;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Podium', 20, lastInfoY + 12);
    doc.setFont('helvetica', 'normal');

    const podium = classement.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    podium.forEach((l, i) => {
      const nom = equipeLookup.get(l.equipeId) ?? l.equipeId;
      doc.setFontSize(12);
      doc.text(`${medals[i] ?? `${l.rang}.`}  ${nom}`, 24, lastInfoY + 22 + i * 10);
    });
  }

  doc.setFontSize(8);
  doc.text(`Imprimé le ${now}`, 105, 290, { align: 'center' });

  // ─── Page 2+ : Classement final ─────────────────────────────────────────────
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Classement final — ${concours.nom}`, 105, 18, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${concours.lieu} — ${dateStr}`, 105, 26, { align: 'center' });

  const classBody = classement.map((l) => [
    String(l.rang),
    equipeLookup.get(l.equipeId) ?? l.equipeId,
    String(l.points),
    String(l.victoires),
    String(l.nuls),
    String(l.defaites),
    String(l.pointsMarques),
    String(l.pointsEncaisses),
    String(l.goalAverage),
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['Rang', 'Équipe', 'Pts', 'V', 'N', 'D', 'PM', 'PE', 'GA']],
    body: classBody,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 18 },
    },
  });

  doc.setFontSize(8);
  doc.text(`Imprimé le ${now}`, 105, 290, { align: 'center' });

  // ─── Pages suivantes : Feuilles de match ───────────────────────────────────
  const terrainLookup = new Map<string, number>();
  for (const t of concours.terrains) {
    terrainLookup.set(t.id, t.numero);
  }

  const grouped = new Map<number, MatchDto[]>();
  for (const m of matchs) {
    if (!grouped.has(m.tourNumero)) grouped.set(m.tourNumero, []);
    grouped.get(m.tourNumero)!.push(m);
  }
  const tours = Array.from(grouped.entries()).sort(([a], [b]) => a - b);

  tours.forEach(([tour, tourMatchs]) => {
    doc.addPage();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(concours.nom, 105, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`${concours.lieu} — ${dateStr} — ${typeLabel}`, 105, 28, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`Tour ${tour}`, 105, 38, { align: 'center' });

    const body = tourMatchs.map((m) => {
      const terrain = m.terrainId ? terrainLookup.get(m.terrainId) ?? '' : '';
      const equipeA = equipeLookup.get(m.equipeAId) ?? m.equipeAId;
      const equipeB = equipeLookup.get(m.equipeBId) ?? m.equipeBId;
      const scoreA = m.statut === 'PROGRAMME' ? '' : String(m.score?.equipeA ?? '');
      const scoreB = m.statut === 'PROGRAMME' ? '' : String(m.score?.equipeB ?? '');
      return [String(terrain), equipeA, equipeB, scoreA, scoreB];
    });

    autoTable(doc, {
      startY: 44,
      head: [['Terrain', 'Équipe A', 'Équipe B', 'Score A', 'Score B']],
      body,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 20 },
      },
    });

    doc.setFontSize(8);
    doc.text(`Imprimé le ${now}`, 105, 290, { align: 'center' });
  });

  doc.save(`archive-${slugify(concours.nom)}.pdf`);
}
