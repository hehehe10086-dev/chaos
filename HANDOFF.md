# Handoff — 2026-10-05

> 写给接手的 AI 工具（Codex 或新的 Claude 会话）。只读这份文件 + 仓库就能继续，不需要聊天记录。
> 项目规则在 `CLAUDE.md`（Codex 默认读 `AGENTS.md`，本仓库没有，请把 `CLAUDE.md` 当作项目规则）。
> 进度日志在 `PROGRESS.md`，设计文档在 `README.md`（`README.zh-CN.md` 是个人译本，不用维护同步）。

## 1. 项目一句话介绍

**Chaos**：Handshake AI Skills Studio Multiplayer Game Challenge 参赛作品（截止 **2026-10-30 11:59 PM PT**，计划 10/27 功能冻结、10/29 提交）。多人历史角色扮演网页游戏：玩家在历史转折时刻各扮演一个角色、带秘密目标对话；玩家输入现代口语，LLM 改写成时代腔（Era Voice）；空位由 AI 扮演，真人可随时接管。结局由投票和规则决定，LLM 只负责表演。评委很可能一个人用两台设备测，所以**只有 2 个真人时也必须好玩**。

团队：Yuqi（计算机工程学生，git 新手）+ 一位程序员朋友。仓库 **public**：https://github.com/hehehe10086-dev/chaos

## 2. 当前状态

- **当前分支**：`feat/m1-sync`，比 `main` 多 1 个 commit：`90e6c4c feat: M1 sync sandbox — rooms, seat tokens, conditional writes, polling`。**未 push 到 GitHub**。
- **未提交的改动**：`PROGRESS.md`（本次更新）和本文件 `HANDOFF.md`，写完后已在 `feat/m1-sync` 上 commit（未 push）。
- **main**：只有脚手架（Vite + React + Tailwind + `/api/health`），通过 PR #1、#2 合并。
- **线上地址**：https://chaos-ten-hazel.vercel.app/ — Vercel 已关联 GitHub，main 自动部署，PR 自动生成 Preview URL。线上目前是 main（脚手架），`/api/health` 正常，M1 未上线。
- **本地 `.env`**：不存在。Redis 尚未创建。
- 本机环境：Windows 11、Node v24.18.0、npm 11.16.0；Yuqi 用 PowerShell 和 Git Bash。没有安装 `gh` CLI。

## 3. 这次会话完成了什么

1. 设计评审 + 开发计划（风险、技术选型、按周里程碑、分工、文件结构），结论已写进 `PROGRESS.md` 和 `CLAUDE.md`。
2. 协作文件：`.gitattributes`（全部文本 LF，图片/字体/音频 binary）、`CLAUDE.md`、`PROGRESS.md`。
3. 脚手架：Vite 8、React 19、Tailwind 4（`@tailwindcss/vite`）、Prettier、Vitest 5；`dev/vite-api-plugin.js` 让 `npm run dev` 同时跑前端和 `/api`；`vercel.json` 把非 `/api` 路径 rewrite 到 `index.html`。已部署到 Vercel。
4. **M1 同步原型**（分支 `feat/m1-sync`）：
   - `api/room.js` — `POST {op:"create",name}` 或 `{op:"join",code,name}` → `{code, token, playerId, view}`
   - `api/state.js` — `GET ?code=ABCD&since=<version>`，Header `Authorization: Bearer <token>` → `{changed:false, version}` 或 `{changed:true, view}`
   - `api/action.js` — `POST {code, action:{type:"increment"}|{type:"say",text}}`，Bearer token → `{view}`
   - `server/engine/applyAction.js` — 纯函数 `applyAction(state, action, ctx)`；动作 `join` / `increment` / `say`；`GameError(message, status)`；`MAX_PLAYERS=8`
   - `server/engine/view.js` — `viewFor(state, version, playerId)`，**唯一**决定玩家能看到什么的地方（白名单字段）；每个玩家有一个 `secret` 数字用于演示隐藏信息
   - `server/rooms.js` — `createRoom` / `joinRoom` / `performAction` / `mutateRoom`（读→改→CAS 写，冲突随机退避重试 5 次）/ `authenticate`
   - `server/store/` — `index.js` 的 `getStore()` 有 Redis 环境变量就用 Redis，否则用内存（在 Vercel 上没配 Redis 会直接抛错）；`redis.js` 用 Lua 脚本做 create-if-absent 和 compare-and-set，房间 key `room:{code}` 是 hash `{v, s}`，TTL 24h；`memory.js` 存在 `globalThis` 上
   - `server/auth.js` — token（只存 sha256 hash）、4 字母房间码（不含 I、O）
   - 前端：`src/pages/Home.jsx`（建房/输入码加入）、`src/pages/Room.jsx`（加入表单、玩家列表、秘密数字、共享计数器、消息、复制邀请链接、404/401 处理）、`src/hooks/useRoomState.js`（1.5s 轮询，标签页隐藏时暂停，首次总会请求；版本号不倒退）、`src/lib/api.js`、`src/lib/session.js`（localStorage 存 token，刷新保持身份）、`src/lib/router.js`（只有 `/` 和 `/room/ABCD`）、`src/components/ui.jsx`
   - 测试：`tests/engine.test.js`、`tests/rooms.test.js`，共 9 个，全部通过（含"视图里没有别人的 secret 和 tokenHash"的泄露测试、并发不丢更新测试）

## 4. 正在做、还没做完的事（最重要）

**M1 处于"代码写完、等 Yuqi 验证 + 接 Redis"阶段。** 具体顺序：

1. **Yuqi 本地双窗口验证（未验证）**。上一次 Yuqi 打开 http://localhost:5173 得到 `ERR_CONNECTION_REFUSED`，原因是 dev server 没在运行（不是代码问题）。需要 Yuqi 在终端运行 `npm run dev` 并**保持该终端开着**，然后：正常窗口建房 → 无痕窗口（Ctrl+Shift+N）用房间码加入 → 两边点 +1、发消息，2 秒内同步 → 两边秘密数字不同且互相看不到 → 刷新后身份不变 → "Copy invite link" 在新无痕窗口打开会出现加入表单。
2. **建 Upstash Redis（Yuqi 操作，需要他的账号）**：Vercel 项目 → Storage → Create Database → Upstash for Redis；区域 **Washington, D.C. (us-east-1)**；Free；**不要加 read region**（只读副本会破坏读己所写）；连接到 Production/Preview/Development 三个环境。Vercel 会注入 `KV_REST_API_URL`、`KV_REST_API_TOKEN`。本地把 `.env.example` 复制成 `.env`，填 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`（或 KV_ 名字，两者都支持）。**不要让 Yuqi 把 token 贴到聊天里。**
3. **用真实 Redis 验证 `server/store/redis.js`（未验证）**。这段代码从未连过真实 Upstash。重点确认：`redis.eval(...)` 两个 Lua 脚本返回 1/0 正常；`redis.hmget(key,'v','s')` 在 `automaticDeserialization:false` 下返回 `{v, s}` 字符串对象、key 不存在时返回 null（若返回结构不同，修改 `get()`）。验证方法：重启 `npm run dev` 后终端不再出现 `[store] No Redis env vars found`；重启 dev server 后房间仍在；用 Git Bash 跑 20 个并发 `increment`，计数正好 +20（命令见第 7 节）。
4. **push + PR + 线上测试**：`git push -u origin feat/m1-sync`（push 前先问 Yuqi）→ Yuqi 在 GitHub 网页开 PR（标题手动改成 `feat: M1 sync sandbox`）→ 在 Vercel Preview URL 用电脑 + 真手机测第 1 步的全部项目 → 合并 → 本地 `git switch main && git pull --prune && git branch -d feat/m1-sync`。
5. 线上 M1 通过后，M1 里程碑完成，进入第 8 节的任务。

## 5. 已做的技术决定及原因

| 决定                                                                                                                                                                                                                                                                                    | 原因                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 不用游戏引擎；React + Vite + Tailwind；**JavaScript**（ES modules + JSDoc，不用 TS）                                                                                                                                                                                                    | 手机网页文字输入体验；团队熟悉；Yuqi 选了 JS                                                                                                                                      |
| Vercel serverless + **polling**（不用 WebSocket）                                                                                                                                                                                                                                       | 比赛要求 serverless；回合制容忍 1–2s 延迟                                                                                                                                         |
| **Upstash Redis**（不用 Supabase）                                                                                                                                                                                                                                                      | Supabase 免费项目闲置 1 周自动暂停，评审可能在截止后几周进行；Upstash 免费层 256MB / 每月 50 万命令 / 1 个库（2026-10-04 查证），超额可开 pay-as-you-go（$0.2/10 万命令）并设预算 |
| Server 唯一真相；`seatToken` 认证（只存 hash，放 Authorization header，不放 URL）；所有写入按 `version` 做 CAS                                                                                                                                                                          | 防隐藏信息泄露（改 URL 参数看别人秘密）、防 race condition                                                                                                                        |
| 没有后台定时器：回合推进用 **lazy tick**（请求进来时发现 deadline 过了就推进，用 Redis 锁保证只推进一次）——**尚未实现**                                                                                                                                                                 | serverless 没有常驻进程                                                                                                                                                           |
| AI 台词在回合开始时预生成（`@vercel/functions` 的 `waitUntil`）——**尚未实现**                                                                                                                                                                                                           | 不能让 LLM 延迟卡住 poll                                                                                                                                                          |
| LLM：通过 `server/llm/client.js` 封装（**尚未创建**）；候选主力 Claude Haiku 4.5（$1/$5 每百万 token），旁白可用 Claude Sonnet 5.5（$2/$10）；W1 用同一组测试句和 Gemini Flash（3.6/3.7 Flash $0.75/$3.75；免费层数据会被用于改进产品）对比 Era Voice 效果再定。估算 Haiku 每局约 $0.13 | 质量直接影响 Creativity 分；成本可控，重点是防失控                                                                                                                                |
| 成本控制：`LLM_MODE=mock`、prompt caching、限制输出长度、Redis 每日调用计数上限、每 room/IP 限流                                                                                                                                                                                        | 公开 URL + LLM = 被刷钱风险                                                                                                                                                       |
| **AI 投票**：每个 AI seat 有数值 `lean`，初始值由规则给；每回合 LLM 用 structured output 判断 −1/0/+1，`lean` 每回合最多变 1；投票按阈值决定                                                                                                                                            | 让说服对话有意义，同时保持"规则决定结局"、可调试                                                                                                                                  |
| 旁白 prompt 不含任何秘密；Era Voice prompt 只含说话者自己的一句话                                                                                                                                                                                                                       | 防剧透、防 prompt injection                                                                                                                                                       |
| **第一个故事：B-59 潜艇（1962 古巴导弹危机）**                                                                                                                                                                                                                                          | 历史上发射核鱼雷需三位军官一致同意 = 天然的秘密投票机制；角色少、有倒计时、10–15 分钟。顾虑：苏联军官的时代腔反差不如宫廷体，第二个故事（P1）建议选宫廷/古代场景                  |
| 砍掉 AI 评判的 in-character bonus；moderation 只做 prompt 约束 + 长度/关键词过滤                                                                                                                                                                                                        | 时间不够、公平性难解释                                                                                                                                                            |
| 本地 `/api` 由 `dev/vite-api-plugin.js` 提供（不用 `vercel dev`）                                                                                                                                                                                                                       | `vercel dev` 需要登录和关联项目；两人都不用装额外工具                                                                                                                             |
| `/api/*.js` 用 Web 标准 handler：`export const GET = route(async (request) => Response)`                                                                                                                                                                                                | Vercel 原生支持，本地插件易模拟                                                                                                                                                   |
| 辅助代码放 `server/`，不放 `api/`                                                                                                                                                                                                                                                       | `api/` 下每个文件都会变成一个 Vercel function                                                                                                                                     |
| 分工建议（**未确认**）：Yuqi 负责 `api/`、`server/`、`tests/`；朋友负责 `src/`、`public/assets/`；`shared/`、`stories/`、`docs/spec.md` 共同维护，改动走 PR                                                                                                                             | 减少 merge conflict                                                                                                                                                               |

## 6. 踩过的坑 / 不要再尝试的方法

- **localhost `ERR_CONNECTION_REFUSED`** = dev server 没运行。不是代码问题，让 Yuqi 运行 `npm run dev` 并保持终端开着。
- **Claude 桌面版的 Terminal 面板集成坏了**：通过 `run_in_terminal` 启动命令失败，报错原文（中文）：`使用"1"个参数调用"ReadAllText"时发生异常:"未能找到路径"C:\Users\lenovo\AppData\Roaming\Claude\terminal-shell-integration\pwsh\claude-desktop.ps1"的一部分。"`。不要再尝试替 Yuqi 在终端里启动 dev server，直接让他自己运行。
- **Claude 的 Browser 预览面板隐藏时 `document.hidden === true`**，轮询会暂停。已修复：`useRoomState.js` 第一次请求总会发出，之后才在隐藏时暂停。用预览面板测轮询时注意这一点。
- **未知的 `/api/xxx` 曾返回 200**（掉进 Vite 的 SPA fallback）。已修复：`dev/vite-api-plugin.js` 用 `existsSync` 判断文件不存在就返回 404。
- **Prettier 会格式化 `.claude/settings.local.json`**（Yuqi 的本地文件，被全局 gitignore 忽略）。已加入 `.prettierignore`。
- **没有 `gh` CLI**：PR 只能在 GitHub 网页上开。GitHub 会用分支名自动生成标题（例如 PR #1 变成 "Chore/repo setup"），**创建 PR 前要手动改标题**。不要为了改已合并 PR 的标题去重写 main 历史或 force push。建议（未执行）：仓库设置只保留 "Squash and merge"，默认信息用 PR 标题。
- **同一个浏览器的两个普通标签页共享 localStorage**，会被当成同一个玩家。测试多人要用正常窗口 + 无痕窗口。
- **内存存储**只适合本地：dev server 重启后房间会丢；Vercel 上多个 function 实例不共享内存，所以 `getStore()` 在 `process.env.VERCEL` 存在且没有 Redis 时会抛错，这是故意的。
- `@upstash/redis` 1.39.0 的 `Redis.fromEnv()` 读 `UPSTASH_REDIS_REST_URL/TOKEN` 或 `KV_REST_API_URL/TOKEN`（已从 npm 包源码确认）。代码用 `automaticDeserialization: false`，自己做 JSON.parse。
- Upstash 免费库长期不活跃是否会被归档：**未查证**，上线后需在 Upstash dashboard 确认。

## 7. 怎么在本地运行、怎么验证

```bash
npm install
npm run dev        # http://localhost:5173 ，前端 + /api 一起跑；手机同 Wi-Fi 用 Vite 打印的 Network 地址
npm test           # vitest run，应为 9 passed
npm run build      # 输出到 dist/
npm run format     # Prettier
```

快速 API 检查（Git Bash，dev server 运行中）：

```bash
curl -s localhost:5173/api/health
# 建房（拿到 code 和 token）
curl -s -X POST localhost:5173/api/room -H 'Content-Type: application/json' -d '{"op":"create","name":"Alice"}'
# 轮询（把 CODE、TOKEN 换成上一步的值）
curl -s "localhost:5173/api/state?code=CODE" -H "Authorization: Bearer TOKEN"
# 20 个并发 +1，之后计数应正好 +20
for i in $(seq 20); do curl -s -o /dev/null -X POST localhost:5173/api/action -H "Authorization: Bearer TOKEN" -H 'Content-Type: application/json' -d '{"code":"CODE","action":{"type":"increment"}}' & done; wait
```

人工验证清单见第 4 节第 1 步。

## 8. 接下来的任务清单（按优先级）

1. 完成第 4 节的 M1 收尾（本地验证 → Redis → 线上 Preview + 真手机 → 合并）。
2. 和 Yuqi + 朋友一起写 `docs/api.md`：所有 action 格式、per-seat view JSON 结构；在 `shared/fixtures/` 放示例 view JSON，让前端可以先用假数据开发。
3. 写 `docs/spec.md`：B-59 完整剧本——角色（3–4 个 seat：Savitsky 艇长、Maslennikov 政委、Arkhipov 参谋长，可选第 4 个）、每个角色的简报和秘密目标（**保证任意两个 seat 都有直接冲突**）、回合 beat、投票规则（发射需一致同意）、结局表、计分（完成秘密目标 + 猜中别人的目标，猜目标用剧本预写的 3 选 1）。和 Yuqi 讨论定稿后再写代码。
4. Era Voice 模型对比：用 20 句测试输入比较 Claude Haiku 4.5 与 Gemini Flash（独立脚本，不进游戏；需要 Yuqi 提供 API key 到 `.env`）。
5. W2（10/11–10/17）core loop：扩展 `server/engine/`（回合、lazy tick + Redis 锁、同时揭示、旁白、AI seat + `lean`、投票、结局、秘密揭示、猜目标、计分），`server/llm/client.js` + `mock.js` + 超时/fallback，`stories/b59/story.json`。验收：线上两个浏览器完整玩完一局。
6. W3（10/18–10/24）：中途接管 AI seat + recap、断线/超时 AI stand-in、edge cases（刷新、房主离开、房间满、最后一轮锁定）、规则页 + 简报卡、视觉小说 UI（先用占位图，图片需求写进 `docs/art-list.md`）、限流 + 每日上限。
7. W4（10/25–10/30）：找新人试玩、修 bug、10/27 冻结、真机全流程复测、准备 title / cover / description、10/29 提交。
8. 降低轮询成本（P1 前做）：游戏结束或空闲后降频到 10s。

## 9. 需要 Yuqi 决定的问题

1. 分工：朋友偏前端还是后端？（第 5 节表格里的分工尚未确认）
2. LLM 付费：用谁的账户？是否接受"Haiku 主力 + 每日约 $3 上限"？
3. 是否把仓库合并方式改成只用 "Squash and merge"？
4. B-59 的第 4 个 seat 要不要加、加谁（剧本讨论时定）。

---

**和 Yuqi 协作的方式**（也写在 `CLAUDE.md`）：回复用中文，技术术语保留英文；每个 git 操作和关键决定用一两句话解释；小步推进，每步给出 localhost 验证方法，等 Yuqi 确认再继续；每个能跑的小功能 commit 一次（`feat:` / `fix:` / `docs:` / `chore:`）；main 永远可玩，新功能走分支 + PR；push、开 PR 等对外操作先问；价格、额度等易变信息要现查，不凭记忆。
