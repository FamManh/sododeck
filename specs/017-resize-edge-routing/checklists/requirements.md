# Specification Quality Checklist: Resize Cards and Route Connectors

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-29
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Field names (`size`, `route.fromSide`, `route.offset`) appear in acceptance scenarios because the JSON panel is a user-visible surface and the backlog acceptance criteria name them; no framework or code structure is named.
- Deviations from the backlog draft, all driven by later founder decisions or merged 016 conventions, are listed in Assumptions: frames never grow on card resize (§g-55), no free connector end (§g-44), key steps aligned with 016 nudges (§g-45) and the 4 px size step, guide snapping instead of "⇧ snaps to grid".
- Clarified 2026-09-29: size and route shared by every view; free segment drag (no 12 px stop); richer connector styling moved to backlog 022-connector-style; enlarged cards wrap title and subtitle at the same font size.
