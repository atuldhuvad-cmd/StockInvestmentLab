# Settings Dependency and Impact Graph

```mermaid
flowchart LR
  D["data-model defaults"] --> W["WealthData read API"]
  W --> I["hidden Intraday rules"]
  D <--> P["Persistence backups"]
  S["inactive Settings renderer"] -. "informational only" .-> D
```

Changing either value affects only the hidden Intraday discipline calculations and backup content. Changing the renderer has no calculation or persistence impact.
