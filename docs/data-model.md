# Production data model

The persistent release should use these core entities:

- `people`
- `projects`
- `person_projects`
- `campaigns`
- `campaign_steps`
- `enrollments`
- `tasks`
- `activities`
- `mql_handovers`
- `weekly_targets`
- `audit_log`

The `person_projects` association stores the verified relationship type. An enrollment belongs to a person, not a project, and can reference multiple projects. A lifecycle transition to MQL stops the enrollment and creates one sales handover containing the person summary, related projects, and activity history.
