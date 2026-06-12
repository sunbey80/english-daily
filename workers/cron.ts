/**
 * 每日生成与发布（§7）。Cloudflare Cron Trigger 入口。
 *
 * 流程：
 *   1. 遍历进行中的故事线，确定下一节 seq。
 *   2. 生成通用版章节（MVP）；若已开个性化，批量为活跃用户生成。
 *   3. 设 publish_at = 当日 08:00，校验通过后落库。
 *   4.（第二期）触发公众号/邮件推送。
 *
 * 当前为骨架：实际改为调用内部 /api/generate（带 GENERATE_SECRET）或直接复用
 * lib/generate 的 generateChapter。
 */

export interface Env {
  GENERATE_SECRET: string;
  SITE_URL: string;
}

// 注：ScheduledEvent / ExecutionContext 等类型来自 @cloudflare/workers-types，
// 部署 Worker 时再装该包并启用其类型；此处用宽松签名让骨架先通过类型检查。
export default {
  async scheduled(_event: unknown, env: Env, _ctx: unknown): Promise<void> {
    // TODO: 调内部生成接口
    await fetch(`${env.SITE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'x-generate-secret': env.GENERATE_SECRET },
    }).catch((e) => console.error('cron generate failed', e));
  },
};
