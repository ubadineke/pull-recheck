import { Context } from "./context";

/**
 * Typeguards are most helpful when you have a union type and you want to narrow it down to a specific one.
 * In other words, if `SupportedEvents` has multiple types then these restrict the scope
 * of `context` to a specific event payload.
 */

/**
 * Restricts the scope of `context` to the `issue_comment.created` payload.
 */

export function isPullRequestEvent(context: Context): context is Context<"pull_request.created" | "pull_request.ready_for_review"> {
  return context.eventName === "pull_request.created" || context.eventName === "pull_request.ready_for_review";
}
