# CI/CD Quick Reference

## Common Commands

### Local Development
```bash
# Run tests
npm test
npm run test:watch
npm run test:coverage

# Lint & Format
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run ci:lint        # Combined lint + format check

# Docker
npm run docker:build
npm run docker:run
npm run docker:stop
npm run docker:logs
```

### GitHub CLI
```bash
# Trigger workflows
gh workflow run test.yml
gh workflow run security.yml
gh workflow run deploy.yml -f environment=staging

# View workflow status
gh run list --workflow=test.yml
gh run view <run-id>
gh run watch <run-id>

# Create release
gh release create v1.0.0 --generate-notes
```

## Workflow Triggers

| Event | Workflows Triggered |
|-------|-------------------|
| Push to PR | test, lint, security |
| Push to main/develop | test, lint, security, docker |
| Create tag (v*.*.*) | docker, deploy |
| Weekly (Monday) | security, dependabot |
| Manual | deploy |

## Required Secrets

```bash
# Production Deployment
DATABASE_URL
SSH_PRIVATE_KEY
REMOTE_HOST
REMOTE_USER
REMOTE_PATH
SLACK_WEBHOOK

# Security Scanning (Optional)
SNYK_TOKEN
CODECOV_TOKEN
```

## Branch Protection Checklist

- [x] Require pull request
- [x] Require 1 approval
- [x] Require status checks:
  - backend-tests
  - frontend-tests
  - eslint-backend
  - eslint-frontend
- [x] Require up-to-date branches
- [x] Require linear history
- [x] Include administrators

## Deployment Process

1. Create tag: `git tag -a v1.0.0 -m "Release 1.0.0"`
2. Push tag: `git push origin v1.0.0`
3. Workflow auto-triggers deploy
4. Monitor in Actions tab
5. Verify health check
6. Check Slack notification

## Troubleshooting

### Tests Failing
```bash
# Run locally first
npm run ci:test

# Check logs in Actions tab
# Review test output
# Fix issues and push
```

### Lint Errors
```bash
# Auto-fix locally
npm run lint:fix
npm run format

# Verify
npm run ci:lint
```

### Docker Build Fails
```bash
# Test local build
npm run docker:build

# Check Dockerfile syntax
# Verify dependencies in package.json
# Clear cache: docker builder prune
```

### Deployment Fails
```bash
# Check secrets are set
# Verify SSH key permissions
# Test SSH connection manually
# Review deploy.yml workflow logs
```

## Monitoring

- **Actions Tab**: Workflow runs and logs
- **Security Tab**: Vulnerability reports
- **Insights**: Dependency graph and alerts
- **Codecov**: Coverage reports
- **Slack**: Deployment notifications

## Emergency Rollback

```bash
# Option 1: Revert tag
git tag -d v1.0.1
git push origin :refs/tags/v1.0.1
git push origin v1.0.0  # Previous working version

# Option 2: Manual deployment
ssh user@server
cd /app/mpanel
git checkout v1.0.0
docker-compose down
docker-compose up -d
```

## Support

- GitHub Actions Docs: https://docs.github.com/en/actions
- Workflow Syntax: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions
- Troubleshooting: https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows
