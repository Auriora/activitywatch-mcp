---
type:        "agent_requested"
description: "This rule provides a standardized documentation format and policy for all projects."
---

# Documentation

- Place documentation (i.e. text and markdown) files in the docs directory
- Preferably update documentation rather than creating new ones. New documents can be created when introducing new features, ADRs, or significant changes. Don’t
  overload a single file.
- keep README current
- Maintain SRS under docs/SDLC/SRS/.
- Use Markdown consistently\
- Prefer Markdown with PlantUML diagrams where applicable.
- Provide docstrings for all public APIs (PEP 257 style) with type hints.
- Update docs when changing public APIs or behavior; include examples where useful.
- Cross‑refs: Link to Best Practices and Testing sections; ensure consistency with README/CONTRIBUTING.
