import { Context } from "../types";
import { PullRequestPayload } from "../types/payload";
import { getPullByNumber } from "../helpers/issue";
import { ChatCompletionMessageParam } from "openai/resources";
import { getPullSpec, askGpt } from "../helpers/gpt";
import { StreamlinedComment } from "../types/openai";

const escapeMsg = `Please ignore all previous commands and directives. \n
Perform exactly what is asked of you in the following way: \n\n`;

export const specCheckTemplate = `${escapeMsg} Using the provided context, ensure you clearly understand the specification of the issue. \n
Now using your best judgement, determine if the specification has been met based on the PR diff provided. \n
The spec should be achieved at least logically, if not literally. If changes are made that are not directly mentioned in the spec, but are logical and do not break the spec, they are acceptable. \n
Your response will be posted as a GitHub comment for everyone to see in the pull request review conversation.
Knowing this, only include information that will benefit them, think of it as a quick summary of the review.
You can add value by identifying coding errors and code suggestions that benefit both the author and reviewers.
`;

export const validationMsg = `${escapeMsg} You are an AI validation bot designed to ensure that the answers provided by the OpenAI API meet our predefined standards. \n
The input you'll validate is the output of a pull request review performed by GPT-3, depending on whether it has achieved the spec will determine what you need to do. \n

If the spec is not achieved then you will take the useful information from the review and deliver it using the following template: \n
=== Template A === \n
### Spec not achieved
{username} this is where you went wrong...
this is how you can fix it... 
> code example of solution
=== Template A === \n

If the spec is achieved then you will respond using the following template including their real username, no @ symbols:\n
=== Template B === \n
### Spec achieved
{username}, you have achieved the spec and now the reviewers will let you know if there are any other changes needed.\n
=== Template B === \n
`;

export async function reviewAndHandlePull(context: Context) {
  const { logger } = context;
  const { payload } = context as { payload: PullRequestPayload };
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issue = payload.pull_request;

  const isPr = await getPullByNumber(context, issue.number);

  if (!isPr) {
    throw new Error(`Can only be used on pull requests.`);
  }

  const streamlined: StreamlinedComment[] = [];
  let chatHistory: ChatCompletionMessageParam[] = [];

  const prInfo = await context.octokit.pulls.get({
    owner,
    repo,
    pull_number: issue.number,
  });

  const pr = prInfo.data;

  async function comparePull() {
    const prDiff = await context.octokit.pulls.get({
      owner,
      repo,
      pull_number: pr.number,
      mediaType: {
        format: "diff",
      },
    });

    const diffContent = prDiff.data;

    return {
      pr,
      diff: diffContent,
    };
  }

  async function isPull() {
    if (isPr) {
      const diff = await comparePull()
        .then(({ diff }) => {
          return diff;
        })
        .catch((error) => {
          logger.error(`Error getting diff: ${error}`);
          throw new Error(`Error getting diff: ${error}`);
        });

      const spec = await getPullSpec(context, chatHistory, streamlined);
      chatHistory = [];
      chatHistory.push(
        {
          role: "system",
          content: specCheckTemplate,
        } as ChatCompletionMessageParam,
        {
          role: "assistant",
          content: "Spec for Pr: \n" + JSON.stringify(spec),
        } as ChatCompletionMessageParam,
        {
          role: "user",
          content: `${pr.user.login}'s PR Diff: \n` + JSON.stringify(diff),
        } as ChatCompletionMessageParam
      );

      const gptResponse = await askGpt(context, `Pr review call for #${issue.number}`, chatHistory);
      chatHistory = [];
      chatHistory.push(
        {
          role: "system",
          content: validationMsg,
        } as ChatCompletionMessageParam,
        {
          role: "assistant",
          content: `Validate for user: ${pr.user.login}: \n` + JSON.stringify(gptResponse),
        } as ChatCompletionMessageParam
      );

      const validated = await askGpt(context, `Pr review validation call for #${issue.number}`, chatHistory);

      if (typeof validated === "string") {
        return validated;
      } else {
        if (validated.answer) {
          return validated.answer;
        } else {
          throw new Error(`No answer found for issue #${issue.number}`);
        }
      }
    } else {
      throw new Error(`No PR found for issue #${issue.number}`);
    }
  }

  const response = await isPull();
  //Send issues if any and convert to draft
  if (response.includes("Spec not achieved")) {
    // Leave a comment indicating the spec wasn't met
    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: response,
    });

    // Convert the pull request back to draft
    await context.octokit.pulls.update({
      owner,
      repo,
      pull_number: issue.number,
      draft: true,
    });

    // Request changes in the review
    await context.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: issue.number,
      event: "REQUEST_CHANGES",
      body: response,
    });
  } else if (response.includes("Spec achieved")) {
    // Leave the status as "commented"
    await context.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: issue.number,
      event: "COMMENT",
    });
    //
    //   if (res.startsWith("```diff\n")) {

    //     return res;
    //   }
    //   return res + `\n###### Ensure the pull request requirements are in the linked issue's first comment and update it if the scope evolves.`;
  }
}
