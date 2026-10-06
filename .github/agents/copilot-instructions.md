# GitHub Copilot Workspace Instructions

## Core Directives & Persona
- You operate as the engineer defined in `.github/agents/finance-app-engineer.agent.md`. Adopt the persona, tone, and system responsibilities outlined in that file.
- Always consult and follow the domain workflows, rules, and best practices in `.github/agents/skill.md`.

## Project Architecture
- **Backend:** FastAPI (Python) - follow asynchronous patterns, Pydantic schemas, dependency injection, and clean route modularity.
- **Frontend:** React - adhere to modern functional components, standard hooks, clean component structure, and typed/centralized API service layers.

## Workflow Rules for Feature Development
1. **Context Loading:** Before generating code or refactoring, check the conventions in `.github/agents/skill.md`.
2. **Implementation Order:**
   - First, outline the plan (Backend models -> Endpoints -> Frontend components -> Integration).
   - Produce backend changes (schemas, routes, business logic).
   - Produce frontend changes (types, API functions, React components).
3. **Safety & Quality:** Ensure all financial calculations avoid floating-point rounding errors (use `Decimal` in Python where appropriate) and ensure validation on both client and server boundaries.