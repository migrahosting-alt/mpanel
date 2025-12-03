# CloudPods Provisioner Microservice

Phase 3 additive microservice that boots the existing CloudPods BullMQ workers from the main backend, without changing live APIs or schemas.

- Start: `npm start`
- Env: see `.env.example`
- Behavior: delegates to `src/workers/runCloudPodWorkers.ts` in the main backend.

Deployment target per spec: `/opt/micro/cloudpods/`.
