# Bound a Delivery Cycle to three Worker executions

Status: Superseded by the current Runtime Router Policy.

A Delivery Cycle permits at most three Worker dispatches total. Luna, Terra, and corrections count at dispatch; failures and timeouts count even without a reviewable candidate. Reviewer launches do not consume Worker budget, but each Persistent-change Candidate receives exactly one fresh review. A recurring finding requires architectural reconsideration instead of another correction.
