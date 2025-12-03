/**
 * ENTERPRISE GRAPHQL Types
 * Single endpoint with RBAC and complexity limits
 */

export interface GraphQLQueryRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface GraphQLConfig {
  maxComplexity: number;
  maxDepth: number;
  introspectionEnabled: boolean;
  playgroundEnabled: boolean;
}
