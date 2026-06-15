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

export function getTranslationUnits(chapter: Pick<TodayChapter, 'id'>): TranslationUnit[] {
  if (chapter.id === 1) {
    return CHAPTER_ONE_TRANSLATION;
  }

  return [];
}
