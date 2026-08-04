# Use observed isolation for Fresh Review

Status: Superseded by the current Runtime Router Policy.

Fresh Review will follow Sol Advisor's tiered isolation rule. An observed read-only runtime qualifies as Enforced Read-only Review; a broader observed runtime may qualify only as Behaviorally Read-only Review when hard isolation is unnecessary, mutation is prohibited, and repository and artifact state is verified unchanged. An unobservable runtime, a hard-isolation requirement without enforcement, or any mutation stops the review lane. This preserves Fresh Review availability without misrepresenting behavioral compliance as enforced isolation.
