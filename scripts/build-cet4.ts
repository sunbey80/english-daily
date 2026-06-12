/**
 * 把开源四级词表原始 txt（data/_cet4_raw.txt，来源 mahavivo/english-wordlists）
 * 解析成结构化的 data/cet4.json。
 *
 * 原始行格式：  word [音标] 词性.中文释义
 *   例：abandon [əˈbændən] vt.丢弃；放弃，抛弃
 *   例：a art.一(个)；每一(个)            （无音标）
 *
 * 产物每条： { word, lemma, zh_gloss }
 *   - word/lemma：词条原形（四级词均为原形，word == lemma，统一小写）
 *   - zh_gloss：去掉音标后的「词性+释义」，用作查词缓存的 zh_gloss
 *
 * 过滤：标题/计数/单字母分节标记/空行；以及非纯字母词条（短语、缩写等），
 * 与 lib/lemmatize.ts 的 isContentWord 规则保持一致，确保允许词表与正文还原可对齐。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAW = resolve(process.cwd(), 'data/_cet4_raw.txt');
const OUT = resolve(process.cwd(), 'data/cet4.json');

interface Cet4Entry {
  word: string;
  lemma: string;
  zh_gloss: string;
}

function build() {
  const text = readFileSync(RAW, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);

  const entries: Cet4Entry[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // 跳过标题/计数行（含中文或括号说明，且不像词条）
    if (/^大学英语|^\(共/.test(line)) continue;
    // 跳过单字母分节标记（A / B / C ...）
    if (/^[A-Za-z]$/.test(line)) continue;

    // 取首个空白前的 token 作为词条
    const head = line.split(/\s+/)[0]?.toLowerCase() ?? '';
    // 只保留纯字母词条（与 lemmatize 的 isContentWord 一致），跳过短语/缩写/带符号
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(head)) continue;
    if (seen.has(head)) continue;

    // 释义：去掉音标 [...]，取词条之后的剩余部分
    const afterHead = line.slice(line.indexOf(line.split(/\s+/)[0]) + line.split(/\s+/)[0].length);
    const zh = afterHead.replace(/\[[^\]]*\]/g, '').trim();

    seen.add(head);
    entries.push({ word: head, lemma: head, zh_gloss: zh });
  }

  writeFileSync(OUT, JSON.stringify(entries, null, 0) + '\n', 'utf8');
  console.log(`parsed ${entries.length} CET4 words -> data/cet4.json`);
  console.log('samples:', entries.slice(0, 5));
}

build();
