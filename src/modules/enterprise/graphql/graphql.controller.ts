/**
 * ENTERPRISE GRAPHQL Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as graphqlService from './graphql.service.js';
import type { GraphQLQueryRequest } from './graphql.types.js';

export async function handleGraphQLQuery(req: Request, res: Response, next: NextFunction) {
  try {
    const { query, variables, operationName }: GraphQLQueryRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;

    const result = await graphqlService.executeGraphQLQuery(
      query,
      variables,
      actorTenantId,
      actorId
    );

    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const config = graphqlService.getGraphQLConfig();
    return res.json(config);
  } catch (error) {
    return next(error);
    next(error);
  }
}
