# AWP — AI Work Provenance protocol (sketch)

> Status: **Consequence, not milestone.** Hard cap: ~5% of effort until customer #5.
> Sequence that wins: product proves the market → protocol standardizes it → graph captures it.
> Naming rule: the protocol must be vendor-neutral — `prism.*` namespacing would kill adoption.
> Companion: [awp-events-v0.md](awp-events-v0.md) (the extracted schema — the part with teeth).

**One sentence:** an open event standard by which any tool that does, verifies, ships, or
bills AI work emits signed, content-free, confidence-graded evidence into a graph the
**customer** owns.

## The constitution (six rules)

1. **Assertions beat inference.** First-party links outrank reconstruction (the pr_link 0.99 vs coauthor 0.60 lesson, promoted to law).
2. **No naked edges.** Every causal claim carries `confidence` + `method`. This field is AWP's genuine contribution — W3C PROV has lineage, in-toto has attestation, OTel has telemetry; none has graded causal confidence.
3. **Evidence, not judgment.** Facts only (hashes, exit codes, timestamps); scores are consumer-side queries. This is *why vendors can emit* — the protocol never grades them.
4. **Content never travels.** Hashes + metadata; prompts and code stay home. Privacy as a schema property.
5. **Customer-sovereign by default.** Events flow to the customer's collector, not to Prism.
6. **Ride, don't rebuild.** OTLP transport (propose OTel GenAI semantic-convention extensions); in-toto/DSSE-style signatures; W3C-PROV-mappable for auditors.

## Event model — six verbs, small on purpose

| Event | Emitted by | Says |
|---|---|---|
| `awp.session` | agents/IDEs | bounded AI work episode (actor, tool, model, operator-hash) |
| `awp.action` | agents | semantically significant act with execution evidence |
| `awp.verify` | agents, CI | a verification ran (type, target, result, evidence) |
| `awp.link` | agents, tools | **crown jewel**: first-party assertion — this session produced that artifact |
| `awp.outcome` | delivery systems | artifact fate: merged, deployed, reverted, incident-linked |
| `awp.cost` | whoever bills | metered consumption bound to session/artifact (tokens always; dollars only from the invoicing party) |

Shared envelope: subject URIs, confidence{value, method}, machine-checkable evidence,
privacy tier, DSSE signature. Signed + content-free + third-party-verifiable = the chain of
custody that insurers, auditors, regulators, SOC2 assessors, and diligence teams all consume.

## Why vendors emit voluntarily (the incentive machine, in activation order)

1. **The gray slice.** Un-instrumented work renders as "unattributed AI work" in the customer's own charts. No vendor tolerates being the gray wedge in their customer's board deck. Emitting = getting credited. (The SSO/SCIM coercion loop, free to run.)
2. **Procurement pull.** One line in security questionnaires: "emits AWP provenance events." Arm buyers, don't lobby vendors.
3. **Liability defense.** When AI-written code causes an incident, the tool with a signed verification trail is defensible; the one without is a deposition.
4. **An afternoon of work.** One `awp.link` at PR-open captures 80% of value; we write the PR for them.
5. **One schema beats fifty bespoke audits** (EU-AI-Act-class oversight evidence, insurance underwriting).
6. **Neutral governance** — emitting doesn't strengthen a competitor.

**The "Prism disappears" test:** forces 1–5 hold with Prism gone — customers still demand
chain of custody, events land in customer-owned stores, the spec lives in a foundation.
That's what makes it a protocol and not a press release.

## How Prism captures value while giving the language away

The Datadog–OTel lesson: an open emission standard commoditizes collection and moves value to
the best backend. Prism keeps: (1) the canonical graph store + query engine (GitHub to AWP's
git), (2) referee services — conformance, third-party verification, "Prism-verified",
(3) the intervention-outcome corpus (a spec cannot commoditize patience), (4) benchmarks.

## Governance & adoption (deliberately mostly-future)

- **Now (the 5%):** publish [awp-events-v0.md](awp-events-v0.md) extracted from the shipping `pr-link` event; write the emitter PR for one OSS agent (Aider/OpenHands-class); hand design partners the procurement rider.
- **~Month 9+ (only after 3 independent emitters):** propose OTel GenAI extensions + in-toto attestation profile; CNCF sandbox only if scope demands.
- **Year 2:** conformance suite + badge; Prism chairs it.
- **Fork insurance:** permissive license, neutral trademark, published charter (the Terraform→OpenTofu lesson).

## The brake (kept from the arc, verbatim in spirit)

Protocol-first is how startups die: years of governance calls, a beautiful spec, no revenue,
then an incumbent adopts your language and attends your funeral. Nothing in this file
displaces [next-6-months.md](next-6-months.md). If protocol work ever exceeds ~5% of a month,
that's the correctness trap wearing a new costume.
