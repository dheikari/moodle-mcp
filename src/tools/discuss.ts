import {
  cached,
  getCourses,
  getDiscussionPosts,
  getDiscussions,
  getForums,
  type Course,
} from "../api.js";
import { fmtDate, fmtSize, html2md, table } from "../format.js";
import type { MoodleClient } from "../ws.js";
import { resolveCourse } from "./courses.js";

/**
 * Three levels in one tool: forums of a course, discussions of a forum, posts of
 * a discussion. Which one you get depends on which argument you pass.
 */
export async function forum(
  client: MoodleClient,
  opts: { course?: string | number; forumid?: number; cmid?: number; discussion?: number; limit?: number },
): Promise<string> {
  const limit = opts.limit ?? 15;

  if (opts.discussion) {
    const posts = await getDiscussionPosts(client, opts.discussion);
    if (posts.length === 0) return `Discussion ${opts.discussion} has no readable posts.`;
    const byId = new Map(posts.map((p) => [p.id, p]));
    const depth = (p: (typeof posts)[number]): number => {
      let d = 0;
      let cur = p;
      while (cur.parentid && byId.has(cur.parentid) && d < 12) {
        cur = byId.get(cur.parentid)!;
        d++;
      }
      return d;
    };
    const out = [`# Discussion ${opts.discussion} — ${posts[0]!.subject}`, `${posts.length} post(s)`];
    for (const p of posts.sort((a, b) => a.timecreated - b.timecreated)) {
      const indent = "  ".repeat(depth(p));
      out.push(
        "",
        `${indent}**${p.author?.fullname ?? "?"}** · ${fmtDate(p.timecreated)} · post ${p.id}${p.isdeleted ? " · deleted" : ""}`,
      );
      const body = html2md(p.message, 4000);
      if (body) out.push(body.replace(/^/gm, `${indent}> `));
      for (const a of p.attachments ?? []) {
        out.push(`${indent}> attachment: ${a.filename} (${fmtSize(a.filesize)}) — moodle_download({ url: "${a.fileurl}" })`);
      }
    }
    return out.join("\n");
  }

  if (opts.forumid || opts.cmid) {
    let forumid = opts.forumid;
    if (!forumid && opts.cmid) {
      // Need the course to look forums up by cmid.
      const cm = await client.call<{ cm: { course: number } }>("core_course_get_course_module", { cmid: opts.cmid });
      const forums = await getForums(client, [cm.cm.course]);
      forumid = forums.find((f) => f.cmid === opts.cmid)?.id;
      if (!forumid) throw new Error(`cmid ${opts.cmid} is not a forum in course ${cm.cm.course}.`);
    }
    const discussions = await getDiscussions(client, forumid!, limit);
    if (discussions.length === 0) return `Forum ${forumid} has no discussions.`;
    const rows = discussions.map((d) => [
      d.discussion,
      d.pinned ? `📌 ${d.subject}` : d.subject,
      d.userfullname,
      fmtDate(d.modified),
      d.numreplies,
      d.numunread || "",
    ]);
    return `Forum ${forumid} — ${discussions.length} discussion(s):\n\n${table(["discussion", "subject", "started by", "last activity", "replies", "unread"], rows)}\n\nmoodle_forum({ discussion: <id> }) reads a thread.`;
  }

  const targets: Course[] = opts.course !== undefined
    ? [await resolveCourse(client, opts.course)]
    : (await cached(client, "courses", () => getCourses(client))).filter(
        (c) => !c.enddate || c.enddate * 1000 > Date.now(),
      );

  const forums = await getForums(
    client,
    targets.map((c) => c.id),
  );
  if (forums.length === 0) return "No forums visible in those courses.";
  const names = new Map(targets.map((c) => [c.id, c.shortname]));
  const rows = forums.map((f) => [
    f.id,
    f.cmid,
    names.get(f.course) ?? f.course,
    f.name,
    f.type,
    f.numdiscussions,
    f.unreadpostscount || "",
  ]);
  return `${forums.length} forum(s):\n\n${table(["forumid", "cmid", "course", "name", "type", "discussions", "unread"], rows)}\n\nmoodle_forum({ forumid: <id> }) lists its discussions.`;
}
