import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { configureTestEnvironment } from './helpers/test-environment';
import { getPool, query } from '../src/lib/db.js';
import {
  parseRssXml,
  getTodayDateString,
  generateNewsArticleWithGemini,
  syncDaily3DNews,
} from '../src/services/ai-news.service.js';

configureTestEnvironment();
after(async () => {
  if (process.env.DATABASE_URL) await getPool().end();
});

const SAMPLE_RSS_2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>All3DP RSS Feed</title>
    <link>https://all3dp.com</link>
    <description>3D Printing News</description>
    <item>
      <title>Bambu Lab Launches New Multi-Material Upgrade</title>
      <link>https://all3dp.com/bambu-lab-new-ams</link>
      <pubDate>Wed, 28 Oct 2026 10:00:00 +0000</pubDate>
      <description><![CDATA[<p>Bambu Lab has introduced an updated AMS system with faster filament change times and lower purge waste.</p>]]></description>
    </item>
    <item>
      <title>Prusa Releases Core One Enclosed 3D Printer</title>
      <link>https://all3dp.com/prusa-core-one</link>
      <pubDate>Tue, 27 Oct 2026 14:30:00 +0000</pubDate>
      <description>Prusa Research has unveiled the new Core One enclosed printer targeted at engineering print farms.</description>
    </item>
  </channel>
</rss>`;

const SAMPLE_ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Hackaday 3D Printer Hacks</title>
  <entry>
    <title>DIY Pellet Extruder for Large Format Printing</title>
    <link href="https://hackaday.com/diy-pellet-extruder" />
    <updated>2026-10-28T09:00:00Z</updated>
    <summary>A maker built a custom pellet extruder using CNC machined auger screws.</summary>
  </entry>
</feed>`;

test('parseRssXml parses RSS 2.0 items correctly and strips HTML', () => {
  const items = parseRssXml(SAMPLE_RSS_2);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Bambu Lab Launches New Multi-Material Upgrade');
  assert.equal(items[0].link, 'https://all3dp.com/bambu-lab-new-ams');
  assert.ok(items[0].snippet?.includes('Bambu Lab has introduced an updated AMS system'));
  assert.ok(!items[0].snippet?.includes('<p>')); // HTML stripped

  assert.equal(items[1].title, 'Prusa Releases Core One Enclosed 3D Printer');
  assert.equal(items[1].link, 'https://all3dp.com/prusa-core-one');
});

test('parseRssXml parses Atom feed items correctly', () => {
  const items = parseRssXml(SAMPLE_ATOM);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'DIY Pellet Extruder for Large Format Printing');
  assert.equal(items[0].link, 'https://hackaday.com/diy-pellet-extruder');
  assert.ok(items[0].snippet?.includes('pellet extruder'));
});

test('parseRssXml handles broken/invalid XML gracefully without throwing', () => {
  const items = parseRssXml('not-xml-at-all <<<>>>');
  assert.deepEqual(items, []);
});

test('getTodayDateString returns YYYY-MM-DD format', () => {
  const dateStr = getTodayDateString();
  assert.match(dateStr, /^\d{4}-\d{2}-\d{2}$/);
});

test('generateNewsArticleWithGemini fails fast when GEMINI_API_KEY is missing', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  const prevGoogleKey = process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  try {
    await assert.rejects(
      async () => {
        await generateNewsArticleWithGemini([{ title: 'Test', link: 'https://test.com' }], { apiKey: '' });
      },
      (err: unknown) => {
        const error = err as { code?: string; status?: number };
        return error.code === 'GEMINI_NOT_CONFIGURED' && error.status === 422;
      },
    );
  } finally {
    if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    if (prevGoogleKey) process.env.GOOGLE_API_KEY = prevGoogleKey;
  }
});

let dbAvailable = false;
if (process.env.DATABASE_URL) {
  try {
    const client = new (await import('pg')).Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query('select 1');
    await client.end();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
}

test('syncDaily3DNews skips execution if post for customDate already exists (idempotency)', { skip: !dbAvailable }, async () => {
  const customDate = '2026-01-01';
  const slug = `diem-tin-in-3d-${customDate}`;

  // Insert a dummy existing post
  await query('delete from blog_posts where slug = $1', [slug]);
  const dummy = await query<{ id: string }>(
    `insert into blog_posts (title, slug, content, status) values ($1, $2, $3, 'DRAFT') returning id`,
    ['Điểm tin cũ', slug, 'Nội dung cũ'],
  );

  try {
    const result = await syncDaily3DNews({ customDate, force: false });
    assert.equal(result.status, 'SKIPPED_ALREADY_EXISTS');
    assert.equal(result.slug, slug);
    assert.equal(result.postId, dummy.rows[0].id);
  } finally {
    await query('delete from blog_posts where slug = $1', [slug]);
  }
});
