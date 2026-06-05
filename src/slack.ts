import type { Analysis } from './types';
import { toMarkdown, headline } from './summarize';

/**
 * The "last mile": push the plain-English summary to where developers actually
 * look. The customer's words: "we find out from Slack, not from our tests."
 * So TestPulse meets them in Slack.
 *
 * Uses an Incoming Webhook (no SDK, no extra dependency) and Slack mrkdwn.
 */
export async function postToSlack(
  webhookUrl: string,
  analysis: Analysis,
  opts: { dashboardUrl?: string | null } = {},
): Promise<{ ok: boolean; status: number }> {
  const body = {
    text: headline(analysis), // notification fallback / preview text
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${headline(analysis)}*` } },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: slackify(toMarkdown(analysis, opts)) },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

/** Convert the subset of Markdown we emit into Slack mrkdwn. */
export function slackify(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '') // drop heading hashes
    .replace(/\*\*(.+?)\*\*/g, '*$1*') // **bold** -> *bold*
    .replace(/\[(.+?)\]\((.+?)\)/g, '<$2|$1>') // [t](u) -> <u|t>
    .replace(/<sub>(.*?)<\/sub>/g, '_$1_')
    .replace(/_([^_]+)_/g, '_$1_')
    .slice(0, 2900); // Slack block text limit safety
}
