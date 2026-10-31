# OpenAI API connection

The manually triggered workflow `.github/workflows/producer-openai-smoke.yml` checks the project-scoped service-account key stored as the repository Actions secret `OPENAI_API_KEY`.

- Uses Responses API and `gpt-6.1-sol`.
- Sends one tiny connectivity prompt; output is capped at 80 tokens.
- Sets `store:false`.
- Does not print or persist the secret.
- Does not modify application code, create PRs, or deploy.
- Run only via GitHub Actions → Producer OpenAI API Smoke Test → Run workflow.

After a successful smoke test, build the task planner and patch generator as separate, approval-gated modules. Do not enable recurring agent execution until spend caps and approval boundaries are tested.
