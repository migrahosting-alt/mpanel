/**
 * ENTERPRISE GRAPHQL Router
 * Routes: /api/enterprise/graphql
 */

import { Router } from 'express';
import * as graphqlController from './graphql.controller.js';

const router = Router();

router.post('/', graphqlController.handleGraphQLQuery);
router.get('/config', graphqlController.handleGetConfig);

export default router;
