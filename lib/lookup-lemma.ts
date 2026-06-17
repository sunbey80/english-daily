/**
 * 轻量候选原形生成 —— 仅供 /api/lookup 的单词点击查询使用。
 *
 * 为什么不复用 lib/lemmatize（wink）：
 *   wink-pos-tagger / wink-lemmatizer 依赖 wink-lexicon（含 wn-words.js 1.9MB、
 *   wn-word-senses.js 847KB 等巨型对象字面量）。把它们打进 Cloudflare Worker 时，
 *   esbuild 为这些大文件构建 AST 会撑爆内存，导致构建被 OOM 中止。
 *
 * 思路：对点击的单词「过度生成」候选原形（规则后缀还原 + 常见不规则映射），
 * 由调用方用 word 表 .in('lemma', candidates) 查询，命中即可。宁可多生成不要漏。
 * 完整、精确的词形还原仍在 lib/lemmatize（生成/校验管线，跑在 Node 脚本里）。
 */

// 常见不规则名词复数 / 动词变化 / 比较级（覆盖连载故事高频词）
const IRREGULAR: Record<string, string> = {
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth',
  geese: 'goose', mice: 'mouse', people: 'person', lives: 'life', leaves: 'leaf',
  knives: 'knife', wives: 'wife', wolves: 'wolf', halves: 'half',
  ran: 'run', run: 'run', came: 'come', went: 'go', gone: 'go', done: 'do',
  said: 'say', made: 'make', took: 'take', taken: 'take', got: 'get', gotten: 'get',
  saw: 'see', seen: 'see', knew: 'know', known: 'know', gave: 'give', given: 'give',
  found: 'find', told: 'tell', thought: 'think', brought: 'bring', bought: 'buy',
  caught: 'catch', taught: 'teach', felt: 'feel', kept: 'keep', left: 'leave',
  met: 'meet', sat: 'sit', stood: 'stand', understood: 'understand', held: 'hold',
  heard: 'hear', led: 'lead', meant: 'mean', sent: 'send', spent: 'spend',
  built: 'build', lost: 'lose', won: 'win', began: 'begin', begun: 'begin',
  drank: 'drink', drunk: 'drink', sang: 'sing', swam: 'swim', rang: 'ring',
  wrote: 'write', written: 'write', drove: 'drive', driven: 'drive', rode: 'ride',
  rose: 'rise', risen: 'rise', broke: 'break', broken: 'break', chose: 'choose',
  spoke: 'speak', spoken: 'speak', stole: 'steal', froze: 'freeze',
  fell: 'fall', fallen: 'fall', flew: 'fly', flown: 'fly', grew: 'grow', grown: 'grow',
  threw: 'throw', thrown: 'throw', drew: 'draw', drawn: 'draw', blew: 'blow',
  wore: 'wear', worn: 'wear', tore: 'tear', torn: 'tear', swore: 'swear',
  was: 'be', were: 'be', been: 'be', am: 'be', are: 'be', is: 'be',
  had: 'have', has: 'have', did: 'do', does: 'do',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  more: 'much', most: 'much', less: 'little', least: 'little', further: 'far', farther: 'far',
  // 更多常见不规则动词过去式/分词 → 原形
  bent: 'bend', lent: 'lend', dealt: 'deal', knelt: 'kneel',
  slept: 'sleep', wept: 'weep', crept: 'creep', swept: 'sweep', leapt: 'leap',
  bound: 'bind', ground: 'grind', wound: 'wind', fed: 'feed', bled: 'bleed',
  fled: 'flee', sped: 'speed', paid: 'pay', laid: 'lay', shot: 'shoot',
  hung: 'hang', swung: 'swing', stuck: 'stick', struck: 'strike', dug: 'dig',
  spun: 'spin', clung: 'cling', stung: 'sting', hid: 'hide', hidden: 'hide',
  slid: 'slide', shone: 'shine', shook: 'shake', shaken: 'shake', woke: 'wake',
  woken: 'wake', bore: 'bear', borne: 'bear', bit: 'bite', bitten: 'bite',
  sank: 'sink', sunk: 'sink', shrank: 'shrink', shrunk: 'shrink',
  sprang: 'spring', sprung: 'spring',
  lit: 'light', sought: 'seek', fought: 'fight',
};

const WORD_RE = /^[a-z]+(?:-[a-z]+)*$/;

/**
 * 为一个输入单词生成候选原形列表（已去重、已过滤为纯字母）。
 */
export function lookupCandidates(input: string): string[] {
  const w = input.toLowerCase().trim();
  if (!WORD_RE.test(w)) return [];

  const set = new Set<string>([w]);
  const add = (s: string) => {
    if (s.length >= 2) set.add(s);
  };

  if (IRREGULAR[w]) add(IRREGULAR[w]);

  // 复数 / 第三人称单数
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ves')) {
    add(w.slice(0, -3) + 'f');
    add(w.slice(0, -3) + 'fe');
  }
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s')) add(w.slice(0, -1));

  // 过去式 / 过去分词
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) {
    add(w.slice(0, -2)); // played -> play
    add(w.slice(0, -1)); // liked -> like（-d）
    add(w.slice(0, -2) + 'e'); // scribbled -> scribble
    const base = w.slice(0, -2);
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      add(base.slice(0, -1)); // stopped -> stop（去双写）
    }
  }

  // 现在分词 / 动名词
  if (w.endsWith('ing')) {
    const base = w.slice(0, -3);
    add(base); // reading -> read
    add(base + 'e'); // writing -> write
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      add(base.slice(0, -1)); // running -> run
    }
  }

  // 比较级 / 最高级
  if (w.endsWith('ier')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('iest')) add(w.slice(0, -4) + 'y');
  if (w.endsWith('er')) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
  }
  if (w.endsWith('est')) {
    add(w.slice(0, -3));
    add(w.slice(0, -2));
  }

  // 副词 -ly
  if (w.endsWith('ly')) add(w.slice(0, -2));

  return [...set].filter((c) => WORD_RE.test(c));
}
