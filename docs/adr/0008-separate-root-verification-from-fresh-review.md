# Separate Root Verification from Fresh Review

Status: Superseded by the current Runtime Router Policy.

The lifecycle is serial: Root Verification, Fresh Review, then Root Finalization. Root first verifies scope, ownership, baseline, repository state, and named checks without repeating semantic code review. A fresh Sol / Medium reviewer performs the sole semantic assessment of correctness, completeness, regressions, test adequacy, interfaces, and constraints. Root then applies the verdict and controls delivery; a valid correction or architectural-reconsideration verdict has no delivery transition, while a deliverable verdict still requires Root to confirm the reviewed state is unchanged. This mirrors Sol Advisor's parent-verification, fresh-review, final-acceptance sequence without duplicating review.
