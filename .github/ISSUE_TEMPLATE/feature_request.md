name: Feature Request
description: Create a detailed feature request for the Sales and Intelligence Platform
title: "[FEATURE] "
labels: ["feature"]
assignees: []
body:
  - type: markdown
    attributes:
      value: "## Feature Description"

  - type: input
    attributes:
      label: Title
      description: Clear, concise name of the proposed feature
    validations:
      required: true

  - type: textarea
    attributes:
      label: Business Need
      description: Business justification including ROI metrics and value proposition
      placeholder: "Describe the business value, expected ROI, and market impact..."
    validations:
      required: true

  - type: textarea
    attributes:
      label: User Story
      description: As a [user type], I want [goal] so that [benefit]
      placeholder: "As a B2B marketer, I want..."
    validations:
      required: true

  - type: dropdown
    attributes:
      label: Component
      options:
        - Campaign Generation
        - Audience Intelligence
        - Analytics
        - Integration
        - Platform Infrastructure
    validations:
      required: true

  - type: markdown
    attributes:
      value: "## Technical Requirements"

  - type: dropdown
    attributes:
      label: Platform Integration
      options:
        - LinkedIn Ads
        - Google Ads
        - Both
        - N/A
    validations:
      required: true

  - type: textarea
    attributes:
      label: Dependencies
      description: Required system components, services, and external integrations
      placeholder: "- Authentication Service\n- Analytics Pipeline\n- Third-party APIs"
    validations:
      required: true

  - type: textarea
    attributes:
      label: Performance Requirements
      description: Expected performance metrics, SLAs, and scalability requirements
      placeholder: "- Response time < 200ms\n- Support for 1000 concurrent users\n- 99.9% uptime"
    validations:
      required: true

  - type: textarea
    attributes:
      label: Security Considerations
      description: Security implications, compliance requirements, and data protection needs
      placeholder: "- Data encryption requirements\n- Access control needs\n- Compliance standards"
    validations:
      required: true

  - type: markdown
    attributes:
      value: "## Implementation Details"

  - type: textarea
    attributes:
      label: Proposed Solution
      description: Technical approach, architecture, and implementation strategy
      placeholder: "Describe the technical implementation approach..."
    validations:
      required: true

  - type: textarea
    attributes:
      label: Database Changes
      description: Required schema modifications, migrations, and data model updates
      placeholder: "- New tables/collections\n- Schema modifications\n- Migration strategy"
    validations:
      required: true

  - type: textarea
    attributes:
      label: API Changes
      description: New or modified API endpoints, versioning, and documentation updates
      placeholder: "- New endpoints\n- Modified request/response schemas\n- API version impacts"
    validations:
      required: true

  - type: textarea
    attributes:
      label: UI/UX Requirements
      description: User interface designs, interaction patterns, and accessibility requirements
      placeholder: "- UI components needed\n- User interaction flows\n- Accessibility considerations"
    validations:
      required: true

  - type: markdown
    attributes:
      value: "## Testing Requirements"

  - type: textarea
    attributes:
      label: Test Scenarios
      description: Platform-specific test cases, integration scenarios, and acceptance criteria
      placeholder: "1. Verify...\n2. Validate...\n3. Ensure..."
    validations:
      required: true

  - type: textarea
    attributes:
      label: Performance Testing
      description: Load testing requirements, scalability validation, and performance benchmarks
      placeholder: "- Load testing scenarios\n- Performance metrics to validate\n- Scalability tests"
    validations:
      required: true

  - type: textarea
    attributes:
      label: Integration Testing
      description: Platform integration testing, API validation, and end-to-end test requirements
      placeholder: "- API integration tests\n- End-to-end scenarios\n- Platform-specific validations"
    validations:
      required: true

  - type: markdown
    attributes:
      value: "## Additional Context"

  - type: textarea
    attributes:
      label: Mockups
      description: UI/UX designs, wireframes, or visual documentation
      placeholder: "Attach any relevant design files, mockups, or screenshots"
    validations:
      required: false

  - type: textarea
    attributes:
      label: Related Issues
      description: Links to related issues, dependencies, or blocking items
      placeholder: "#123, #456"
    validations:
      required: false

  - type: textarea
    attributes:
      label: Timeline
      description: Proposed implementation timeline, milestones, and delivery dates
      placeholder: "- Phase 1: Design & Planning (2 weeks)\n- Phase 2: Implementation (4 weeks)\n- Phase 3: Testing (2 weeks)"
    validations:
      required: false

  - type: dropdown
    attributes:
      label: Priority
      options:
        - Critical
        - High
        - Medium
        - Low
    validations:
      required: true