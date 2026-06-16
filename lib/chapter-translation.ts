import type { TodayChapter } from '@/lib/today';

export type TranslationUnit = {
  en: string;
  zh: string;
  paragraph: number;
};

const CHAPTER_ONE_TRANSLATION: TranslationUnit[] = [
  {
    paragraph: 0,
    en: 'The old shop sat at the end of a crooked little street.',
    zh: '那家老店坐落在一条弯弯曲曲的小街尽头。',
  },
  {
    paragraph: 0,
    en: 'The sign above the door was crooked too, leaning to one side like a tired old man.',
    zh: '门上方的招牌也是歪的，向一边斜着，像一个疲惫的老人。',
  },
  {
    paragraph: 0,
    en: 'Mia pushed the door open and stepped inside.',
    zh: '米娅推开门，走了进去。',
  },
  {
    paragraph: 1,
    en: 'The air was thick and dusty.',
    zh: '空气浓重，满是灰尘。',
  },
  {
    paragraph: 1,
    en: 'Rows of books lined every wall.',
    zh: '一排排书摆满了每一面墙。',
  },
  {
    paragraph: 1,
    en: 'A dusty clock on the shelf showed half past nine.',
    zh: '架子上一只布满灰尘的钟显示九点半。',
  },
  {
    paragraph: 1,
    en: 'No one was at the front desk.',
    zh: '前台没有人。',
  },
  {
    paragraph: 2,
    en: '"Hello?" Mia called softly.',
    zh: '“有人吗？”米娅轻声喊道。',
  },
  {
    paragraph: 3,
    en: 'A murmur came from the back room.',
    zh: '后屋传来一阵低语声。',
  },
  {
    paragraph: 3,
    en: 'Then a small woman with white hair walked out.',
    zh: '接着，一位白发的小个子女人走了出来。',
  },
  {
    paragraph: 3,
    en: 'This was Mrs. Lin.',
    zh: '她就是林太太。',
  },
  {
    paragraph: 4,
    en: '"You must be Mia," Mrs. Lin said.',
    zh: '“你一定是米娅，”林太太说。',
  },
  {
    paragraph: 4,
    en: 'Her voice was low, almost a murmur.',
    zh: '她的声音很低，几乎像在低语。',
  },
  {
    paragraph: 4,
    en: '"Good. I need help today."',
    zh: '“很好。今天我需要人帮忙。”',
  },
  {
    paragraph: 5,
    en: 'Mrs. Lin pointed to a tall stack of old books.',
    zh: '林太太指向一大摞旧书。',
  },
  {
    paragraph: 5,
    en: '"Sort these. Put them on the right shelves."',
    zh: '“把这些整理好，放到正确的书架上。”',
  },
  {
    paragraph: 5,
    en: 'Then she walked away.',
    zh: '然后她走开了。',
  },
  {
    paragraph: 6,
    en: 'Mia picked up the first book.',
    zh: '米娅拿起第一本书。',
  },
  {
    paragraph: 6,
    en: 'It was heavy and dusty.',
    zh: '那本书又重又满是灰尘。',
  },
  {
    paragraph: 6,
    en: 'She wiped the cover with her sleeve.',
    zh: '她用袖子擦了擦封面。',
  },
  {
    paragraph: 6,
    en: 'As she opened it, a small piece of paper fell to the floor.',
    zh: '她打开书时，一小张纸掉到了地上。',
  },
  {
    paragraph: 7,
    en: 'She picked it up.',
    zh: '她把纸捡了起来。',
  },
  {
    paragraph: 7,
    en: 'On it was a scribble — no, not just a scribble.',
    zh: '纸上有一段潦草的字迹——不，不只是乱写的字。',
  },
  {
    paragraph: 7,
    en: 'It was careful, small writing.',
    zh: '那是仔细写下的小字。',
  },
  {
    paragraph: 7,
    en: 'Hard to read, but real words.',
    zh: '很难辨认，但确实是一些字。',
  },
  {
    paragraph: 8,
    en: '*I left it where we first talked. You will know the place. — R*',
    zh: '“我把它留在我们第一次说话的地方。你会知道那个地方。——R”',
  },
  {
    paragraph: 9,
    en: 'Mia read it twice.',
    zh: '米娅读了两遍。',
  },
  {
    paragraph: 9,
    en: 'She looked around the quiet shop.',
    zh: '她环顾这间安静的店。',
  },
  {
    paragraph: 9,
    en: 'Mrs. Lin was nowhere in sight.',
    zh: '林太太不见了踪影。',
  },
  {
    paragraph: 10,
    en: 'She set the note on the desk and kept working.',
    zh: '她把纸条放在桌上，继续干活。',
  },
  {
    paragraph: 10,
    en: 'An hour later, she found another book.',
    zh: '一个小时后，她又发现了一本书。',
  },
  {
    paragraph: 10,
    en: 'Inside was another scribble in the same small hand.',
    zh: '书里有另一段同样小小的潦草字迹。',
  },
  {
    paragraph: 11,
    en: '*Do you still think about that summer? I do. Every day. — R*',
    zh: '“你还会想起那个夏天吗？我会。每一天。——R”',
  },
  {
    paragraph: 12,
    en: "Mia's heart beat a little faster.",
    zh: '米娅的心跳快了一点。',
  },
  {
    paragraph: 12,
    en: 'Who was R?',
    zh: 'R 是谁？',
  },
  {
    paragraph: 12,
    en: 'Who were these notes for?',
    zh: '这些纸条是写给谁的？',
  },
  {
    paragraph: 13,
    en: 'She looked up at the ceiling.',
    zh: '她抬头看向天花板。',
  },
  {
    paragraph: 13,
    en: 'Mrs. Lin had mentioned an attic earlier — a locked attic above the shop.',
    zh: '林太太之前提到过一个阁楼——店铺上方一个上了锁的阁楼。',
  },
  {
    paragraph: 13,
    en: 'Mia had thought nothing of it then.',
    zh: '当时米娅并没有在意。',
  },
  {
    paragraph: 14,
    en: 'Now she wondered what was up there.',
    zh: '现在，她开始想那上面到底有什么。',
  },
];

const CHAPTER_TWO_TRANSLATION: TranslationUnit[] = [
  { paragraph: 0, en: 'The next morning, Mia arrived early.', zh: '第二天早上，米娅很早就到了。' },
  { paragraph: 0, en: 'The shop was quiet and cold.', zh: '店里安静又寒冷。' },
  { paragraph: 0, en: 'She could hear her own steps on the old floor.', zh: '她能听见自己踩在旧地板上的脚步声。' },
  { paragraph: 1, en: '*Creak. Creak.*', zh: '“嘎吱。嘎吱。”' },
  { paragraph: 2, en: 'The wooden floor made a sound with every step.', zh: '木地板每走一步都会作响。' },
  { paragraph: 2, en: 'She stopped near the tall shelf by the window.', zh: '她在窗边那排高书架旁停下。' },
  { paragraph: 2, en: 'A thin cobweb stretched across the corner.', zh: '一张细细的蜘蛛网在角落里横拉着。' },
  { paragraph: 2, en: 'It moved a little in the cold air.', zh: '它在冷空气中微微晃动。' },
  { paragraph: 3, en: 'Mia had not stopped thinking about the notes.', zh: '米娅一直没停止想那些便条。' },
  { paragraph: 3, en: 'She pulled out a small book from the low shelf.', zh: '她从矮书架上抽出一本小书。' },
  { paragraph: 3, en: 'The cover was faded — once blue, now a pale, tired color.', zh: '封面已经褪色——曾经是蓝色，如今是一种暗淡、疲惫的颜色。' },
  { paragraph: 3, en: 'She opened it slowly.', zh: '她慢慢翻开它。' },
  { paragraph: 4, en: 'A note fell out.', zh: '一张便条掉了出来。' },
  { paragraph: 4, en: 'Same small writing.', zh: '还是那样小小的字迹。' },
  { paragraph: 4, en: 'Same careful hand.', zh: '还是那样工整的笔迹。' },
  { paragraph: 5, en: '*I kept what you gave me close to my heart. The locket. Always. — R*', zh: '“我把你给我的东西一直贴身珍藏。那只小金盒。永远。——R”' },
  { paragraph: 6, en: 'Mia read the words twice.', zh: '米娅把这些字读了两遍。' },
  { paragraph: 6, en: 'A locket.', zh: '一只小金盒。' },
  { paragraph: 6, en: 'So R had kept something — something small, something worn around the neck.', zh: '这么说，R 一直留着一样东西——一样小小的、戴在脖子上的东西。' },
  { paragraph: 6, en: 'A gift, maybe.', zh: '也许是一份礼物。' },
  { paragraph: 6, en: 'From someone dear.', zh: '来自某个珍视的人。' },
  { paragraph: 7, en: 'She looked around the shop.', zh: '她环顾着店里。' },
  { paragraph: 7, en: 'Another cobweb floated near the top shelf.', zh: '顶层书架附近又有一张蜘蛛网在飘。' },
  { paragraph: 7, en: 'The morning light came in weak and low.', zh: '晨光透进来，微弱而低沉。' },
  { paragraph: 7, en: 'A small lamp in the corner began to flicker.', zh: '角落里一盏小灯开始闪烁。' },
  { paragraph: 7, en: 'Then it went steady again.', zh: '然后它又稳定了下来。' },
  { paragraph: 8, en: 'Mia moved to the next shelf.', zh: '米娅走到下一排书架。' },
  { paragraph: 8, en: 'She pulled out a thick, faded book.', zh: '她抽出一本厚厚的、褪了色的书。' },
  { paragraph: 8, en: 'The pages were yellow and soft.', zh: '书页又黄又软。' },
  { paragraph: 8, en: 'Near the middle, she found another note.', zh: '在靠近中间的地方，她又发现了一张便条。' },
  { paragraph: 9, en: '*If you ever come back, look for the locket. It will tell you everything. — R*', zh: '“如果你有一天回来，去找那只小金盒。它会把一切都告诉你。——R”' },
  { paragraph: 10, en: 'Mia held the note in both hands.', zh: '米娅用双手捧着便条。' },
  { paragraph: 10, en: 'The lamp began to flicker again, just for a second.', zh: '那盏灯又闪了一下，只有一秒。' },
  { paragraph: 10, en: 'The floor let out a long creak as she shifted her weight.', zh: '她挪动身体时，地板发出一声长长的嘎吱声。' },
  { paragraph: 11, en: 'She looked up at the ceiling.', zh: '她抬头望向天花板。' },
  { paragraph: 11, en: 'There was a small door above the back stairs — a door she had not noticed before.', zh: '后楼梯上方有一扇小门——一扇她之前没注意到的门。' },
  { paragraph: 11, en: 'It was old and dark.', zh: '它又旧又暗。' },
  { paragraph: 11, en: 'A thin cobweb crossed its edge.', zh: '一张细蜘蛛网横在它的边缘。' },
  { paragraph: 12, en: 'She had not seen Mrs. Lin go near it.', zh: '她没见过林太太靠近过它。' },
  { paragraph: 12, en: 'Not once.', zh: '一次也没有。' },
  { paragraph: 13, en: 'But someone had been up there.', zh: '但有人上去过那里。' },
  { paragraph: 13, en: 'She was sure of it now.', zh: '现在她确信这一点。' },
];

export function getTranslationUnits(chapter: Pick<TodayChapter, 'id'>): TranslationUnit[] {
  if (chapter.id === 1) {
    return CHAPTER_ONE_TRANSLATION;
  }

  if (chapter.id === 2) {
    return CHAPTER_TWO_TRANSLATION;
  }

  return [];
}
