# Image Crop Merge (Node + React)
A full‑stack demo where the frontend lets you draw a crop rectangle and the
backend re‑merges that crop into the original image, adding a red border
around it.
## Quick Start
```bash
# In the project root
npm install
npm run install:all
npm run dev
```

## CI/CD
This repo now mirrors the Storymagik pipeline: a Docker multi-stage build (`Dockerfile`) bundles the Vite client and the Express API and the GitHub Actions workflows in `.github/workflows/` build, push and deploy that image to Cloud Run on demand.

- `Deploy Staging` pushes to an Artifact Registry repo (full path stored in `GCP_STAGING_ARTIFACT_REPOSITORY`) and deploys to the staging Cloud Run service/environment.
- `Deploy Production` pushes to `gcr.io/<project>/<image>` and deploys to the production Cloud Run service/environment.

Both workflows are `workflow_dispatch` only. The inputs let you pick `deploy` vs `rollback`, optionally supply a custom release tag, and/or target a specific commit (`rollback_ref`).

### Required GitHub secrets
Populate the following secrets with newline-separated `KEY=VALUE` blocks for the env files and the usual GCP identifiers/Workload Identity data:

- `FRONTEND_ENV_STAGING`, `FRONTEND_ENV_PRODUCTION` – values consumed by the Vite build (only `VITE_` keys are exposed to the client).
- `SERVER_ENV_STAGING`, `SERVER_ENV_PRODUCTION` – API config; the workflow converts these to YAML before passing them to `gcloud run deploy`.
- `GCP_STAGING_PROJECT`, `GCP_PRODUCTION_PROJECT` – numeric or string project IDs.
- `GCP_STAGING_REGION`, `GCP_PRODUCTION_REGION` – Cloud Run regions.
- `GCP_STAGING_SERVICE_API`, `GCP_PRODUCTION_SERVICE_API` – Cloud Run service names that should receive each deployment.
- `GCP_STAGING_WIF_PROVIDER`, `GCP_PRODUCTION_WIF_PROVIDER` – Workload Identity Federation provider resource IDs.
- `GCP_STAGING_WIF_SERVICE_ACCOUNT`, `GCP_PRODUCTION_WIF_SERVICE_ACCOUNT` – Service accounts that the workflows should impersonate.
- `GCP_STAGING_ARTIFACT_REPOSITORY` – Artifact Registry repo for staging in the form `REGION-docker.pkg.dev/PROJECT/REPOSITORY`.

Once the secrets are in place, use the **Actions → Deploy Staging / Deploy Production** workflow in GitHub, choose the desired inputs, and the workflow will:

1. Materialize the client/server env files from the secrets.
2. Convert the server env file to the YAML format Cloud Run expects.
3. Build and push the Docker image (client + server) with the right `APP_ENV`.
4. Deploy the pushed image to Cloud Run and stamp a git tag (`staging-<sha>` or `prod-<sha>` by default).

Adjust the workflows if you need different build scripts, container registries, or deployment targets.
