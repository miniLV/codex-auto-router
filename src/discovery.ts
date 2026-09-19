import { buildCatalog, evidenceValid, type CapabilityCatalog, type HostIdentity } from "./catalog.js";

export interface HostSnapshot extends Omit<CapabilityCatalog, "digest" | "generation"> {
  evidence_mode: "production" | "simulation";
}

/** The host bridge owns provenance. This function never reads profiles or probes a paid model. */
export class CapabilityDiscovery {
  #cached?: { key: string; catalog: CapabilityCatalog };
  #generation = 0;

  discover(host: HostIdentity, now: number, snapshot: HostSnapshot): CapabilityCatalog {
    const key = `${host.session_id}:${host.fingerprint}:${host.configuration_digest}:${snapshot.evidence_mode}`;
    if (snapshot.host.session_id !== host.session_id || snapshot.host.fingerprint !== host.fingerprint ||
      snapshot.host.configuration_digest !== host.configuration_digest) {
      this.#cached = undefined;
      return buildCatalog({ host, generation: ++this.#generation, entries: [], evidence: [], templates: [] });
    }
    // Revalidate each call, including cached observations. APPLIED is never promoted.
    const entries = snapshot.entries.filter(e => evidenceValid(e.evidence, host, now));
    const evidence = snapshot.evidence.filter(e => evidenceValid(e, host, now));
    const ids = new Set(evidence.map(e => e.id));
    const templates = snapshot.templates.filter(t => ids.has(t.evidence_ref) && t.enforcement_refs.length > 0 &&
      t.enforcement_refs.every(id => evidence.some(e => e.id === id && evidenceValid(e, host, now, true))));
    const catalog = buildCatalog({ host, generation: this.#generation, entries, evidence, templates });
    if (this.#cached?.key === key && this.#cached.catalog.digest === catalog.digest) return structuredClone(this.#cached.catalog);
    catalog.generation = ++this.#generation;
    const result = buildCatalog(catalog);
    this.#cached = { key, catalog: result };
    return structuredClone(result);
  }
}
