name: Bug Report
description: Create a detailed bug report to help us improve the Sales and Intelligence Platform
title: "[BUG] "
labels: ["bug"]
assignees: []
body:
  - type: markdown
    attributes:
      value: "## Bug Description"

  - type: input
    attributes:
      label: Title
      description: Clear, concise description of the bug
    validations:
      required: true

  - type: dropdown
    attributes:
      label: Environment
      options:
        - Development
        - Staging
        - Production
    validations:
      required: true

  - type: dropdown
    attributes:
      label: Component
      options:
        - Frontend
        - Backend
        - AI Service
        - Analytics
        - Integration
    validations:
      required: true

  - type: dropdown
    attributes:
      label: Severity
      options:
        - "Critical - System/feature completely unusable, revenue impact"
        - "High - Major functionality broken, workaround not available"
        - "Medium - Feature partially broken, workaround available"
        - "Low - Minor issue, minimal impact"
    validations:
      required: true

  - type: markdown
    attributes:
      value: "## Reproduction Steps"

  - type: textarea
    attributes:
      label: Prerequisites
      description: List any required setup, authentication, or data state
      placeholder: "1. Valid user account\n2. Campaign data in system\n3. API access configured"
    validations:
      required: false

  - type: textarea
    attributes:
      label: Steps to Reproduce
      description: Provide detailed steps to reproduce the issue
      placeholder: "1. Go to...\n2. Click on...\n3. Scroll down to...\n4. See error"
    validations:
      required: true

  - type: textarea
    attributes:
      label: Expected Behavior
      description: Describe what should happen
    validations:
      required: true

  - type: textarea
    attributes:
      label: Actual Behavior
      description: Describe what actually happens
    validations:
      required: true

  - type: dropdown
    attributes:
      label: Platform
      options:
        - LinkedIn Ads
        - Google Ads
        - Both
        - N/A
    validations:
      required: true

  - type: input
    attributes:
      label: Browser Name
      description: If frontend issue, specify browser name
      placeholder: "e.g. Chrome, Firefox, Safari"
    validations:
      required: false

  - type: input
    attributes:
      label: Browser Version
      description: If frontend issue, specify browser version
      placeholder: "e.g. 96.0.4664.110"
    validations:
      required: false

  - type: input
    attributes:
      label: API Version
      description: If backend issue, specify API version
      placeholder: "e.g. v1.2.3"
    validations:
      required: false

  - type: textarea
    attributes:
      label: Error Messages
      description: Paste any relevant error messages, logs, or stack traces here
      render: shell
    validations:
      required: false

  - type: textarea
    attributes:
      label: Screenshots
      description: If applicable, add screenshots to help explain the problem
    validations:
      required: false

  - type: textarea
    attributes:
      label: Related Issues
      description: Link to related issues if any
      placeholder: "#123, #456"
    validations:
      required: false

  - type: textarea
    attributes:
      label: Workaround
      description: Describe any temporary workaround if available
    validations:
      required: false