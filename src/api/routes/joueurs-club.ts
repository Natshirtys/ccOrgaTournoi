import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppContext } from '../context.js';
import { createRequireAdmin } from '../auth/auth-middleware.js';
import { validateBody } from '../middleware/validation.js';
import { ApiError } from '../middleware/error-handler.js';
import { Joueur } from '../../domain/club/entities/joueur.js';
import { PosteMelee } from '../../domain/shared/enums.js';

const CLUB_PRINCIPAL_ID = 'club-principal';

const joueurSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est requis').max(120),
  poste: z.nativeEnum(PosteMelee),
});

const disponibiliteSchema = z.object({ actif: z.boolean() });

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => void fn(req, res, next).catch(next);
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value ?? '';
}

function toJson(joueur: Joueur) {
  return { id: joueur.id, nom: joueur.nomComplet, poste: joueur.poste, actif: joueur.actif };
}

async function verifierNomDisponible(ctx: AppContext, nom: string, joueurIdIgnore?: string) {
  const normalise = nom.trim().toLocaleLowerCase('fr-FR');
  const joueurs = await ctx.joueurRepository.findByClub(CLUB_PRINCIPAL_ID);
  if (joueurs.some((joueur) => joueur.id !== joueurIdIgnore
    && joueur.nomComplet.toLocaleLowerCase('fr-FR') === normalise)) {
    throw ApiError.conflict(`« ${nom.trim()} » existe déjà dans les joueurs du club`);
  }
}

export function createJoueursClubRouter(ctx: AppContext): Router {
  const router = Router();
  const protect = createRequireAdmin(ctx.authService);
  router.use(protect);

  router.get('/', asyncHandler(async (_req, res) => {
    const joueurs = await ctx.joueurRepository.findByClub(CLUB_PRINCIPAL_ID);
    joueurs.sort((a, b) => a.nomComplet.localeCompare(b.nomComplet, 'fr'));
    res.json({ data: joueurs.map(toJson) });
  }));

  router.post('/', validateBody(joueurSchema), asyncHandler(async (req, res) => {
    await verifierNomDisponible(ctx, req.body.nom);
    const joueur = new Joueur(
      ctx.joueurRepository.nextId(), req.body.nom, '', null, CLUB_PRINCIPAL_ID, '', null, true, req.body.poste,
    );
    await ctx.joueurRepository.save(joueur);
    res.status(201).json(toJson(joueur));
  }));

  router.patch('/:id', validateBody(joueurSchema), asyncHandler(async (req, res) => {
    const id = param(req.params.id);
    const existant = await ctx.joueurRepository.findById(id);
    if (!existant || existant.clubId !== CLUB_PRINCIPAL_ID) throw ApiError.notFound('Joueur non trouvé');
    await verifierNomDisponible(ctx, req.body.nom, id);
    const joueur = new Joueur(id, req.body.nom, '', null, CLUB_PRINCIPAL_ID, '', null, existant.actif, req.body.poste);
    await ctx.joueurRepository.save(joueur);
    res.json(toJson(joueur));
  }));

  router.patch('/:id/disponibilite', validateBody(disponibiliteSchema), asyncHandler(async (req, res) => {
    const joueur = await ctx.joueurRepository.findById(param(req.params.id));
    if (!joueur || joueur.clubId !== CLUB_PRINCIPAL_ID) throw ApiError.notFound('Joueur non trouvé');
    if (req.body.actif) joueur.activer(); else joueur.desactiver();
    await ctx.joueurRepository.save(joueur);
    res.json(toJson(joueur));
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const joueur = await ctx.joueurRepository.findById(param(req.params.id));
    if (!joueur || joueur.clubId !== CLUB_PRINCIPAL_ID) throw ApiError.notFound('Joueur non trouvé');
    await ctx.joueurRepository.delete(joueur.id);
    res.status(204).end();
  }));

  return router;
}
