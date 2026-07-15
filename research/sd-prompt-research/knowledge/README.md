# Research Claim Knowledge

This directory is the Research Claim Staging Layer. It is not a Concept Graph source.

- Edit staged claims and Evidence Facts under `assertions/`.
- Add Reviews and Withdrawals under `reviews/claim-review.yaml`.
- Add Promotion Approvals and Withdrawals under `reviews/promotion-approval.yaml`.
- Never edit or delete a committed Review, Withdrawal, Approval, or Application Receipt; append a new record instead.
- Run `scripts/validate_research_claims.py` before committing.

The complete v3.9.31 Freeze contract is documented in [`docs/research-claim-staging-layer.md`](../docs/research-claim-staging-layer.md).
