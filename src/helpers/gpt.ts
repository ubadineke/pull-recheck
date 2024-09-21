import { Context } from "../types";
import { PullRequestPayload } from "../types/payload";
import { getIssueByNumber } from "./issue";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { StreamlinedComment } from "../types/openai";
import OpenAI from "openai";

export async function getPullSpec(context: Context, chatHistory: ChatCompletionMessageParam[], streamlined: StreamlinedComment[]) {
  const { logger } = context;
  const { payload } = context as { payload: PullRequestPayload };
  const pr = payload.pull_request;

  if (!pr) {
    throw new Error(`Payload pull request info is undefined.`);
  }

  const { data } = await context.octokit.pulls.get({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    pull_number: pr.number,
  });

  const prBody = data.body;

  // we're in the pr context, so grab the linked issue body
  const regex = /(#(\d+)|https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(issues|pull)\/(\d+))/gi;
  const linkedIssueNumber = prBody.match(regex);
  const linkedIssues: number[] = [];

  if (linkedIssueNumber) {
    linkedIssueNumber.forEach((issue: string) => {
      if (issue.includes("#")) {
        linkedIssues.push(Number(issue.slice(1)));
      } else {
        linkedIssues.push(Number(issue.split("/")[6]));
      }
    });
  } else {
    logger.error(`No linked issues or prs found`);
  }

  if (!linkedIssueNumber) {
    throw new Error(`No linked issue found in body.`);
  }

  // get the linked issue body
  const linkedIssue = await getIssueByNumber(context, linkedIssues[0]);

  if (!linkedIssue) {
    throw new Error(`Error getting linked issue.`);
  }

  // add the first comment of the pull request which is the contributor's description of their changes
  streamlined.push({
    login: pr.user.login,
    body: `${pr.user.login}'s pull request description:\n` + pr.body,
  });

  // add the linked issue body as this is the spec
  streamlined.push({
    login: "assistant",
    body: `#${linkedIssue.number} Specification: \n` + linkedIssue.body,
  });

  // no other conversation context is needed
  chatHistory.push({
    role: "system",
    content: "This pull request context: \n" + JSON.stringify(streamlined),
  } as ChatCompletionMessageParam);

  return chatHistory;
}

export async function askGpt(context: Context, question: string, chatHistory: ChatCompletionMessageParam[]) {
  const { logger, env } = context;
  const OPENAI = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const res: OpenAI.Chat.Completions.ChatCompletion = await OPENAI.chat.completions.create({
    messages: chatHistory,
    model: "gpt-3.5-turbo",
    max_tokens: 500,
    temperature: 0,
  });

  const answer = res.choices[0].message.content;

  const tokenUsage = {
    output: res.usage?.completion_tokens,
    input: res.usage?.prompt_tokens,
    total: res.usage?.total_tokens,
  };

  if (!res) {
    logger.info(`No answer found for question: ${question}`);
    return `No answer found for question: ${question}`;
  }

  return { answer, tokenUsage };
}
