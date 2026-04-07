export const ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize"
export const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
export const ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"
export const JIRA_API_BASE = "https://api.atlassian.com/ex/jira"

export const JIRA_SCOPES = [
  "read:jira-work",
  "read:jira-user",
  "offline_access",
].join(" ")
