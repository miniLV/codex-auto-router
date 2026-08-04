# Scope Fresh Review by persistent change

Status: Superseded by the current Runtime Router Policy.

Every Worker result that changes repository or artifact state requires Fresh Review after Root verification. A purely read-only result instead returns bounded claims and evidence locations for Root verification, avoiding a second Sol pass over work whose value is only evidence retrieval. This capability boundary applies independently of Worker model or allowlist action and avoids accumulating route-specific review exceptions.
