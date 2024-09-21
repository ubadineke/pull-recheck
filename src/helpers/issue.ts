import { Context } from "../types";
import { IssuePayload, PullRequestPayload } from "../types/payload";

export async function getIssueByNumber(context: Context, issueNumber: number) {
  const { logger } = context;
  // const { payload } = context as { payload: IssuePayload };
  const { payload } = context as unknown as { payload: IssuePayload };
  try {
    const { data: issue } = await context.octokit.rest.issues.get({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: issueNumber,
    });
    return issue;
  } catch (e: unknown) {
    logger.debug(`Fetching issue failed! reason: ${e}`);
    return;
  }
}

export async function getPullByNumber(context: Context, pullNumber: number) {
  const { logger } = context;
  const { payload } = context as { payload: PullRequestPayload };
  try {
    const { data: pull } = await context.octokit.rest.pulls.get({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pull_number: pullNumber,
    });
    return pull;
  } catch (error) {
    logger.debug(`Fetching pull failed! reason: ${error}`);
    return;
  }
}
