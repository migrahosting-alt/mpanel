# Contributing to MPanel

Thank you for your interest in contributing to MPanel! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Test thoroughly
6. Submit a pull request

## Development Setup

```bash
# Run the setup script
chmod +x setup.sh
./setup.sh

# Start development servers
npm run dev                    # Backend
cd frontend && npm run dev     # Frontend
```

## Project Structure

```
mpanel/
├── src/                    # Backend source code
│   ├── config/            # Configuration files
│   ├── controllers/       # Request handlers
│   ├── db/               # Database migrations and schemas
│   ├── middleware/       # Express middleware
│   ├── models/           # Data models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── utils/            # Utility functions
├── frontend/             # React frontend
│   └── src/
│       ├── components/   # Reusable components
│       ├── pages/        # Page components
│       ├── services/     # API client services
│       └── utils/        # Frontend utilities
├── monitoring/           # Monitoring configuration
└── docs/                # Documentation

## Coding Standards

### Backend (Node.js)

- Use ES6+ features
- Use async/await instead of callbacks
- Follow the existing code style
- Add JSDoc comments for functions
- Handle errors appropriately
- Use meaningful variable names

Example:
```javascript
/**
 * Create a new invoice
 * @param {Object} invoiceData - Invoice data
 * @returns {Promise<Object>} Created invoice
 */
async function createInvoice(invoiceData) {
  try {
    // Implementation
  } catch (error) {
    logger.error('Error creating invoice:', error);
    throw error;
  }
}
```

### Frontend (React)

- Use functional components with hooks
- Follow React best practices
- Use Tailwind CSS for styling
- Keep components small and focused
- Add PropTypes for type checking
- Use meaningful component names

Example:
```jsx
import React from 'react';

export default function ProductCard({ product, onSelect }) {
  return (
    <div className="card">
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button onClick={() => onSelect(product)}>
        Select
      </button>
    </div>
  );
}
```

### Database

- Use migrations for schema changes
- Add indexes for frequently queried fields
- Use transactions for related operations
- Follow naming conventions (snake_case for tables/columns)
- Add comments for complex queries

## Testing

### Running Tests

```bash
npm test                 # Run all tests
npm test -- --coverage   # Run with coverage
```

### Writing Tests

- Write unit tests for business logic
- Write integration tests for APIs
- Test edge cases and error handling
- Aim for >80% code coverage

Example test:
```javascript
import { describe, it, expect } from 'node:test';
import Invoice from '../models/Invoice.js';

describe('Invoice Model', () => {
  it('should create an invoice', async () => {
    const invoice = await Invoice.create({
      tenantId: 'test-tenant',
      customerId: 'test-customer',
      // ... other data
    });
    
    expect(invoice).toBeDefined();
    expect(invoice.id).toBeDefined();
  });
});
```

## Git Workflow

### Branches

- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Production hotfixes

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

Examples:
```
feat(billing): add tax calculation service
fix(auth): resolve token expiration issue
docs(readme): update installation instructions
```

## Pull Request Process

1. **Update your branch** with the latest from main
2. **Test your changes** thoroughly
3. **Update documentation** if needed
4. **Write a clear PR description**:
   - What changes were made
   - Why they were made
   - How to test them
5. **Link related issues**
6. **Request reviews** from maintainers

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] No commented-out code
- [ ] Environment variables documented

## Adding New Features

### Backend API Endpoint

1. Create model in `src/models/`
2. Create service in `src/services/`
3. Create controller in `src/controllers/`
4. Add routes in `src/routes/`
5. Add tests
6. Update API documentation

### Frontend Component

1. Create component in `src/components/` or `src/pages/`
2. Add necessary styles with Tailwind
3. Create service for API calls if needed
4. Add to routing if it's a page
5. Test responsiveness

### Database Schema Change

1. Update `src/db/schema.sql`
2. Create migration script if needed
3. Test migration locally
4. Document the change
5. Update models if needed

## Documentation

- Keep README.md up to date
- Document new features
- Add JSDoc comments
- Update API documentation
- Include examples

## Security

- Never commit secrets or API keys
- Use environment variables
- Validate all user input
- Sanitize database queries
- Follow OWASP guidelines
- Report security issues privately

## Performance

- Optimize database queries
- Use indexes appropriately
- Implement caching where beneficial
- Minimize bundle sizes
- Use lazy loading
- Profile before optimizing

## Questions?

- Open an issue for questions
- Check existing documentation
- Ask in pull request comments
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

Thank you for contributing to MPanel! 🎉
