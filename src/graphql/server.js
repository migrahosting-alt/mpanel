/**
 * GraphQL Server Integration
 * Apollo Server with Express
 */

import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

/**
 * Initialize GraphQL server
 */
export async function initializeGraphQL(app) {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      // Extract user from JWT token
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        try {
          const user = jwt.verify(token, process.env.JWT_SECRET);
          return { user };
        } catch (error) {
          logger.warn('Invalid JWT token in GraphQL request', { error: error.message });
          return {};
        }
      }
      
      return {};
    },
    formatError: (error) => {
      logger.error('GraphQL error', { 
        message: error.message, 
        path: error.path,
        extensions: error.extensions 
      });
      
      return {
        message: error.message,
        code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
        path: error.path
      };
    },
    introspection: process.env.NODE_ENV !== 'production',
    playground: process.env.NODE_ENV !== 'production'
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  logger.info('GraphQL server initialized', { 
    path: '/graphql',
    playground: process.env.NODE_ENV !== 'production'
  });

  return server;
}
