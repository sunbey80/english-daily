/**
 * GET /api/notebook —— 返回用户生词本（state=1 的词 + 出处章节，§6）。
 * 未登录时返回空列表；MVP 阶段不强制登录。
 */
import { type NextRequest, NextResponse } from 'next/server';

import { getRequestUser } from '@/lib/auth';
import { getNotebookItems } from '@/lib/notebook';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    const items = await getNotebookItems(user?.id ?? null);

    return NextResponse.json({
      authenticated: Boolean(user),
      items,
    });
  } catch (error) {
    console.error('GET /api/notebook failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const wordId =
      payload &&
      typeof payload === 'object' &&
      'word_id' in payload &&
      typeof payload.word_id === 'number'
        ? payload.word_id
        : null;

    if (!wordId) {
      return NextResponse.json({ error: 'missing_word_id' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('user_word')
      .delete()
      .eq('user_id', user.id)
      .eq('word_id', wordId);

    if (error) {
      console.error('DELETE /api/notebook failed', error);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error('DELETE /api/notebook failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
