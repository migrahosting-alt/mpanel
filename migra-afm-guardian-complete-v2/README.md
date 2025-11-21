# Migra AFM Guardian — Full Build (LLM + Tools)

This repo contains the full **Migra AFM Guardian** backend:
- Gateway → HTTPS/API entry, `/chat` → forwards to Orchestrator
- Orchestrator → LLM-powered tool router + reply engine
- Adapters → DNS / User Summary / Backups stubs (ready to swap to real PDNS/mPanel)
- Infra → Docker Compose stack (gateway, orchestrator, adapters)
- Packages → shared types, SDK stub, and a simple HTML widget demo

## Quick Start

```bash
unzip migra-afm-guardian-complete-v2.zip
cd migra-afm-guardian-complete-v2

cp .env.example .env
# edit .env and set LLM_API_KEY to your OpenAI key

docker compose -f infra/docker-compose.yml up --build -d

# test
curl http://localhost:8080/health
curl http://localhost:8090/health
curl http://localhost:8095/health
```
