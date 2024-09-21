import { EmitterWebhookEvent as WebhookEvent } from "@octokit/webhooks";
export type PullRequestPayload = WebhookEvent<"pull_request">["payload"];
export type IssuePayload = WebhookEvent<"issues">["payload"];
