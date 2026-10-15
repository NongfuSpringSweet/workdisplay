import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const projects = ['2048 Beer', 'BingoMint', 'Catalog Precheck', 'Mahjong Study', 'Offline Game Hub', 'OneImageTool', 'PlayCards365', 'VZTool'];
const tools = ['Image to ASCII', 'Icon Workshop', 'Pixel Studio', 'GridSplit', 'Cutout'];
const domains = ['2048.beer', 'bingomint.com', 'catalogprecheck.com', 'mahjongstudy.com', 'offlinegamehub.com', 'oneimagetool.com', 'playcards365.com', 'vztool.com', ...['ascii', 'icon', 'pixel', 'split', 'cutout'].map(name => `${name}.vztool.com`)];
const slug = heading => heading.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
const sections = markdown => new Set([...markdown.matchAll(/^#{1,6} (.+)$/gm)].map(match => slug(match[1])));
let checkedLinks = 0;

for (const file of ['README.md', 'README.en.md', 'SCREENSHOTS.md']) {
  const markdown = await readFile(new URL(file, root), 'utf8');
  if (file.startsWith('README')) {
    for (const name of projects) assert(markdown.includes(`\n## ${name}\n`), `${file}: missing project ${name}`);
    for (const name of tools) assert(markdown.includes(`\n### ${name}\n`), `${file}: missing VZTool tool ${name}`);
    for (const domain of domains) assert(markdown.includes(`https://${domain}/`), `${file}: missing online entry ${domain}`);
    assert(markdown.includes(file === 'README.md' ? 'README.en.md' : 'README.md'), `${file}: missing language link`);
  }
  const links = [...markdown.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)\)|href="([^"]+)"/g)].map(match => match[1] || match[2]);
  for (const link of links) {
    if (/^https:\/\//.test(link)) { new URL(link); continue; }
    assert(!/^[a-z]+:/i.test(link), `${file}: unsupported link ${link}`);
    const [path, anchor] = link.split('#');
    const target = new URL(path || file, root);
    assert(target.href.startsWith(root.href), `${file}: link leaves repository: ${link}`);
    assert((await stat(target)).isFile(), `${file}: missing local file ${link}`);
    if (anchor) assert(sections(await readFile(target, 'utf8')).has(anchor), `${file}: missing section ${link}`);
    checkedLinks++;
  }
}

const files = await readdir(new URL('assets/screenshots/', root));
assert.equal(files.length, 15, 'Expected 13 site screenshots and two workflow screenshots');
const notes = await readFile(new URL('SCREENSHOTS.md', root), 'utf8');
for (const file of files) {
  assert(file.endsWith('.jpg'), `Unexpected screenshot file: ${file}`);
  const bytes = await readFile(new URL(`assets/screenshots/${file}`, root));
  assert(bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), `${file}: not a JPEG`);
  assert(bytes.length > 10000 && bytes.length < 2 * 1024 * 1024, `${file}: unexpected image size`);
  assert(notes.includes(`assets/screenshots/${file}`), `${file}: missing capture note`);
}

for (const [file, language] of [['index.html', 'zh-CN'], ['en.html', 'en']]) {
  const html = await readFile(new URL(file, root), 'utf8');
  assert(html.includes(`<html lang="${language}">`), `${file}: wrong language`);
  assert.equal([...html.matchAll(/<img\b/g)].length, 16, `${file}: expected cover and 15 screenshots`);
  assert(!/href="(?:README(?:\.en)?|SCREENSHOTS)\.md"/.test(html), `${file}: raw Markdown navigation`);
  for (const domain of domains) assert(html.includes(`https://${domain}/`), `${file}: missing online entry ${domain}`);
  for (const [, link] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    if (link.startsWith('https://')) continue;
    const [path, anchor] = link.split('#');
    const target = new URL(path === './' ? 'index.html' : path || file, root);
    assert(target.href.startsWith(root.href), `${file}: link leaves repository ${link}`);
    assert((await stat(target)).isFile(), `${file}: missing local resource ${link}`);
    if (anchor) assert((await readFile(target, 'utf8')).includes(`id="${anchor}"`), `${file}: missing anchor ${link}`);
    checkedLinks++;
  }
}
assert((await stat(new URL('.nojekyll', root))).isFile(), 'Missing static Pages configuration');

console.log(`OK: bilingual website, 8 projects, 5 VZTool subdomains, 15 JPEG screenshots, ${checkedLinks} local links.`);
