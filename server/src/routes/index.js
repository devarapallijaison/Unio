import { Router } from 'express';
import { z } from 'zod';
import * as authCtrl from '../controllers/auth.controller.js';
import * as brand from '../controllers/brand.controller.js';
import * as creator from '../controllers/creator.controller.js';
import * as project from '../controllers/project.controller.js';
import * as pub from '../controllers/public.controller.js';
import * as verify from '../controllers/verification.controller.js';
import { dbState } from '../config/db.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  APPLICATION_STATUS,
  INVITATION_STATUS,
  PROJECT_STATUS,
} from '../models/enums.js';
import { idParams, objectId } from '../validators/common.js';
import * as v from '../validators/index.js';
import { ok } from '../utils/http.js';

const router = Router();

router.get('/health', (_req, res) => ok(res, { status: 'ok', db: dbState(), time: new Date().toISOString() }));

/* ---------- Auth ---------- */
router.post('/auth/register', authLimiter, validate({ body: v.registerBody }), authCtrl.register);
router.post('/auth/login', authLimiter, validate({ body: v.loginBody }), authCtrl.login);
router.post('/auth/logout', authCtrl.logout);
router.get('/auth/me', requireAuth, authCtrl.me);

/* ---------- Public discovery ---------- */
router.get('/creators', validate({ query: v.creatorListQuery }), pub.listCreators);
router.get('/creators/:id', optionalAuth, validate({ params: idParams }), pub.getCreator);
router.get('/campaigns', validate({ query: v.campaignListQuery }), pub.listCampaigns);
router.get('/campaigns/categories', pub.listCategories);
router.get('/campaigns/:id', optionalAuth, validate({ params: idParams }), pub.getCampaign);
router.post(
  '/campaigns/:id/applications',
  requireAuth,
  requireRole('creator'),
  validate({ params: idParams, body: v.applicationBody }),
  pub.apply,
);

/* ---------- Creator ---------- */
const asCreator = [requireAuth, requireRole('creator')];
router.get('/creator/profile', asCreator, creator.getProfile);
router.put('/creator/profile', asCreator, validate({ body: v.creatorProfileBody }), creator.updateProfile);
router.get('/creator/portfolio', asCreator, creator.listPortfolio);
router.post('/creator/portfolio', asCreator, validate({ body: v.portfolioBody }), creator.addPortfolio);
router.put('/creator/portfolio/:id', asCreator, validate({ params: idParams, body: v.portfolioBody }), creator.updatePortfolio);
router.delete('/creator/portfolio/:id', asCreator, validate({ params: idParams }), creator.deletePortfolio);
router.get('/creator/applications', asCreator, validate({ query: v.statusListQuery(APPLICATION_STATUS) }), creator.listApplications);
router.patch('/creator/applications/:id/withdraw', asCreator, validate({ params: idParams }), creator.withdrawApplication);
router.get('/creator/invitations', asCreator, validate({ query: v.statusListQuery(INVITATION_STATUS) }), creator.listInvitations);
router.patch(
  '/creator/invitations/:id/respond',
  asCreator,
  validate({ params: idParams, body: v.invitationRespondBody }),
  creator.respondInvitation,
);
router.get('/creator/projects', asCreator, validate({ query: v.statusListQuery(PROJECT_STATUS) }), creator.listProjects);

/* ---------- Brand ---------- */
const asBrand = [requireAuth, requireRole('brand')];
router.get('/brand/profile', asBrand, brand.getProfile);
router.put('/brand/profile', asBrand, validate({ body: v.brandProfileBody }), brand.updateProfile);
router.get('/brand/campaigns', asBrand, validate({ query: v.brandListQuery }), brand.listCampaigns);
router.post('/brand/campaigns', asBrand, validate({ body: v.campaignBody }), brand.createCampaign);
router.get('/brand/campaigns/:id', asBrand, validate({ params: idParams }), brand.getCampaign);
router.put('/brand/campaigns/:id', asBrand, validate({ params: idParams, body: v.campaignBody }), brand.updateCampaign);
router.patch(
  '/brand/campaigns/:id/status',
  asBrand,
  validate({ params: idParams, body: v.campaignStatusBody }),
  brand.setCampaignStatus,
);
router.get(
  '/brand/campaigns/:id/applications',
  asBrand,
  validate({ params: idParams, query: v.statusListQuery(APPLICATION_STATUS) }),
  brand.listCampaignApplications,
);
router.get('/brand/campaigns/:id/recommendations', asBrand, validate({ params: idParams }), brand.recommendations);
router.post(
  '/brand/campaigns/:campaignId/invitations',
  asBrand,
  validate({ params: z.object({ campaignId: objectId }), body: v.invitationBody }),
  brand.invite,
);
router.get('/brand/applications', asBrand, validate({ query: v.statusListQuery(APPLICATION_STATUS) }), brand.listApplications);
router.patch(
  '/brand/applications/:id/status',
  asBrand,
  validate({ params: idParams, body: v.applicationReviewBody }),
  brand.reviewApplication,
);
router.get('/brand/invitations', asBrand, validate({ query: v.statusListQuery(INVITATION_STATUS) }), brand.listInvitations);
router.patch('/brand/invitations/:id/cancel', asBrand, validate({ params: idParams }), brand.cancelInvitation);
router.get('/brand/projects', asBrand, validate({ query: v.statusListQuery(PROJECT_STATUS) }), brand.listProjects);

/* ---------- Verification ---------- */
router.get('/creator/verifications', asCreator, verify.listOwn);
router.post('/creator/verifications', asCreator, validate({ body: v.verificationCreateBody }), verify.create);
router.put('/creator/verifications/:id', asCreator, validate({ params: idParams, body: v.verificationUpdateBody }), verify.update);
router.delete('/creator/verifications/:id', asCreator, validate({ params: idParams }), verify.remove);

const asReviewer = [requireAuth, requireRole('reviewer')];
router.get('/review/verifications', asReviewer, validate({ query: v.reviewListQuery }), verify.listForReview);
router.patch('/review/verifications/:id', asReviewer, validate({ params: idParams, body: v.reviewDecisionBody }), verify.decide);

/* ---------- Projects (participants only) ---------- */
router.get('/projects/:id', requireAuth, validate({ params: idParams }), project.getProject);
router.patch('/projects/:id/status', requireAuth, validate({ params: idParams, body: v.projectStatusBody }), project.updateStatus);
router.patch(
  '/projects/:id/deliverables/:deliverableId',
  requireAuth,
  validate({ params: v.deliverableParams, body: v.deliverableBody }),
  project.updateDeliverable,
);
router.post('/projects/:id/feedback', requireAuth, requireRole('brand'), validate({ params: idParams, body: v.feedbackBody }), project.addFeedback);

export default router;
