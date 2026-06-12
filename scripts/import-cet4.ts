/**
 * 把 data/cet4.json 灌入 word 表，置 in_cet4 = true，并缓存 zh_gloss。
 *
 * 用法： npm run import:cet4
 * 依赖： .env.local 中的 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
 *        （服务端 client 绕过 RLS）。
 *
 * 幂等：以 lemma 唯一键 upsert，可重复执行。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

interface Cet4Entry {
  word: string;
  lemma: string;
  zh_gloss: string;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SECRET_KEY，请检查 .env.local');
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const file = resolve(process.cwd(), 'data/cet4.json');
  const entries: Cet4Entry[] = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`读取 ${entries.length} 条四级词`);

  const rows = entries.map((e) => ({
    lemma: e.lemma,
    in_cet4: true,
    zh_gloss: e.zh_gloss,
  }));

  // 分批 upsert，避免单次请求过大
  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('word')
      .upsert(batch, { onConflict: 'lemma', ignoreDuplicates: false });
    if (error) {
      console.error(`批次 ${i} 失败：`, error.message);
      process.exit(1);
    }
    done += batch.length;
    console.log(`已写入 ${done}/${rows.length}`);
  }

  const { count } = await supabase
    .from('word')
    .select('*', { count: 'exact', head: true })
    .eq('in_cet4', true);
  console.log(`完成。word 表中 in_cet4=true 的词共 ${count} 条。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
