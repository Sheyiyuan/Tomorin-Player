# “下一首播放”插入异常定位与解决方案规划

## 1. 文档信息

- 排查日期：2026-08-05
- 代码基线：`4c89272`（`fix/cdn-non-public-ip`）
- 排查范围：前端播放队列、队列导航、歌曲启动、音频事件与队列持久化
- 约束：本轮只定位与规划，不修改业务代码

## 2. 结论

本问题的主因不是“下一首播放”的插入位置计算错误，而是插入完成后的播放链路混用了两种不同含义的 ID：

- `Song.id` 表示歌曲的业务身份；同一首歌在队列中可以出现多次。
- `QueueItem.queueItemId` 表示一次队列实例的身份；每个重复条目必须各自独立。

`enqueueNext` 和 `getNextQueueItem` 都能正确选出新插入项的 `queueItemId`，但 `usePlaySong` 随后用 `song.id` 重新执行 `findIndex`，并取第一个同歌曲条目。新插入实例因此可能被重置为队列中较早的原实例，造成高亮跳回、重复播放、下一曲顺序回退等异常。

同时确认一个相关缺陷：用户手动点播 `priorityNext` 中的条目时，该优先项不会被消费；下一次切歌仍会再次选中它。

| 级别 | 结论 | 状态 |
| --- | --- | --- |
| P0 | 播放启动阶段把 `queueItemId` 降级为 `song.id`，重复歌曲会选错队列实例 | 已确认主因 |
| P1 | 手动点播优先待播项不会更新 `priorityNext`，下一次可能重播当前项 | 已确认相关缺陷 |
| P2 | `enqueueNext` 在 state updater 内修改其他 state，队列状态不是原子更新 | 结构性风险，当前探针未复现额外插入 |
| P2 | 当前测试分别覆盖“重复实例”和“FIFO”，没有覆盖完整的插入后切歌链路 | 已确认覆盖缺口 |

本问题位于前端，不需要修改 Go 服务、数据库模型或 Wails 绑定。

## 3. 当前调用链

```text
歌曲列表“下一首播放”
  -> App.onPlayNextSong(song)
  -> PlayerContext.enqueueNext(song)
       创建新的 queueItemId
       写入 items / playOrder / priorityNext
  -> usePlaybackControls.playNext()
       getNextQueueItem(...) 返回 priorityNext[0] 的 queueItemId
       根据 queueItemId 得到正确的 nextIdx 和 nextSong
  -> usePlaySong.playSong(nextSong, queue)
       targetList.findIndex(s => s.id === song.id)
       setCurrentIndex(第一个同 song.id 的位置)
  -> currentQueueItemId 被 setCurrentIndex 再次改写，正确实例丢失
```

关键证据：

- `frontend/src/context/contexts/PlayerContext.tsx:117-136`：插入时创建新的 `queueItemId`，并按 FIFO 写入 `priorityNext`。
- `frontend/src/utils/player.ts:125-145`：导航优先返回 `priorityNext[0]`，使用的是 `queueItemId`。
- `frontend/src/hooks/player/usePlaybackControls.ts:93-120`：先按 `queueItemId` 找到正确索引和歌曲，随后调用 `playSong`。
- `frontend/src/hooks/player/usePlaySong.ts:35-41`：再次按 `song.id` 查找首个索引并写回当前索引，这是身份丢失点。
- `frontend/src/context/contexts/PlayerContext.test.tsx:56-63`：现有测试明确要求同一歌曲的重复队列项拥有不同身份，因此不能用 `song.id` 代替 `queueItemId`。

## 4. 可确定复现的状态演算

假设队列中有三首歌，当前正在播放 `B`：

```text
items        = [qA:A, qB:B, qC:C]
playOrder    = [qA, qB, qC]
current      = qB
priorityNext = []
```

用户对当前歌曲 `B` 点击“下一首播放”后，系统允许重复歌曲，因此创建新实例 `qB2`：

```text
items        = [qA:A, qB:B, qB2:B, qC:C]
playOrder    = [qA, qB, qB2, qC]
current      = qB
priorityNext = [qB2]
```

第一次切到下一首时：

1. `getNextQueueItem` 正确返回 `qB2`。
2. `usePlaybackControls` 正确得到 `nextIdx = 2`，并设置当前实例为 `qB2`。
3. `usePlaySong` 按 `song.id === B` 查找，得到第一个匹配位置 `1`。
4. `setCurrentIndex(1)` 又把当前实例改回 `qB`。
5. `priorityNext` 已消费，但播放顺序仍认为当前项是 `qB`。
6. 下一次切歌从 `qB` 前进到 `qB2`，同一首歌再次播放。

如果插入的是位于当前项之前的已存在歌曲，例如从 `B` 插入 `A`，`usePlaySong` 会把当前实例直接跳回原来的 `qA`；下一次导航将从队列前部继续，而不是从插入实例之后继续。随机播放下同样会发生身份回退，只是后续症状更难预测。

### 4.1 触发条件

| 场景 | 当前结果 |
| --- | --- |
| 插入队列中从未出现的歌曲 | 通常正常，因为 `song.id` 只有一个匹配项 |
| 插入当前歌曲 | 高概率回到原实例，之后再次进入插入实例 |
| 插入位于当前项之前的已存在歌曲 | 跳回较早实例，后续顺序回退 |
| 插入位于当前项之后的已存在歌曲 | 首次可能选对，但原条目仍会在之后按正常顺序再次播放；是否保留原条目应由产品语义决定 |
| 手动点播新插入的待播项 | 既可能因 `song.id` 跳到原实例，也不会消费对应优先项 |
| 音频地址刷新或错误重试 | `useAudioEvents` 会再次调用 `playSong(song, queue)`，重复歌曲也可能发生当前实例漂移 |

## 5. 为什么现有测试没有发现

当前测试覆盖了局部能力，但没有覆盖状态交接：

- `PlayerContext.test.tsx` 验证重复歌曲会生成不同 `queueItemId`。
- 同一文件验证多次 `enqueueNext` 后的 `priorityNext` 是 FIFO。
- `utils/player.test.ts` 验证导航会读取优先队列头部。
- `usePlaybackControls.test.ts` 当前只覆盖播放地址刷新，没有覆盖下一曲导航。
- `usePlaySong.test.ts` 没有包含重复 `song.id` 的队列。

因此每个局部测试都能通过，但没有测试串联：

```text
enqueueNext -> playNext -> usePlaySong -> 最终 currentQueueItemId
```

排查时执行了当前前端测试，结果为 38 个测试文件、126 个测试全部通过。这证明现有基线稳定，但也确认测试通过不能排除本问题。

## 6. 相关设计问题

### 6.1 优先待播项的生命周期不完整

`priorityNext` 目前只在 `playNext` 中消费。`App.handlePlayQueueItem` 手动点播队列条目时只设置当前项并调用 `playSong`，没有移除已被手动播放的优先项。

建议明确以下语义：

- 通过“下一首”自动进入优先项：消费队首。
- 手动点播某个优先项：移除该项，避免下一次再次播放。
- 手动点播非优先项：保留现有优先队列，使它仍作为下一首播放。
- 删除或清空队列项：继续同步清理对应优先项。

### 6.2 队列状态由多份独立 state 组成

`items`、`playOrder`、`currentQueueItemId`、`history` 和 `priorityNext` 需要满足强一致性，但当前由多次 setter 分别更新。`enqueueNext` 还在 `setPriorityNext` 的 updater 内调用 `setItems` 和 `setPlayOrder`。这使中间状态、React 批处理和后续维护更难推理。

项目入口启用了 React `StrictMode`。本次使用临时 StrictMode 探针验证单次插入时，没有复现重复条目，且临时文件已删除；因此该设计不列为本次直接根因，但建议在修复中避免继续扩大这种写法。

### 6.3 `consumePriorityNext` 的返回值不可靠

该函数在 state updater 外返回局部变量，但 React 状态更新不保证同步执行。当前调用方只依赖其副作用，没有使用返回值，所以尚未直接触发本问题；后续应改为无返回值，或由纯 reducer/状态转换函数同步返回完整结果。

## 7. 推荐解决方案

### 7.1 核心原则

以 `queueItemId` 作为所有队列导航和选中行为的唯一身份；`song.id` 只用于歌曲数据、缓存、历史和后端业务操作。

不要采用以下表面修复：

- 把 `findIndex` 改成 `lastIndexOf`：只能改变选错哪一个重复实例。
- 插入前按 `song.id` 去重：会破坏项目已经明确支持的重复队列项。
- 只调整 `setCurrentIndex` 调用顺序：异步刷新和重试仍会重新触发身份漂移。

### 7.2 首选落地方式

将“选择队列实例”和“解析并启动音频”拆开：

1. 队列层新增统一的按 ID 激活入口，例如 `activateQueueItem(queueItemId, reason)`。
2. 该入口按 `queueItemId` 完成当前项、历史和 `priorityNext` 的一致更新。
3. `usePlaybackControls`、队列行点击、上一曲/下一曲都只传递 `queueItemId`。
4. `usePlaySong` 不再调用 `setQueue` 或根据 `song.id` 调用 `setCurrentIndex`；它只负责本地缓存检查、播放地址解析、`currentSong` 更新、播放状态和播放历史。
5. 播放新歌单或队列外歌曲时，由 `usePlayModes` 先显式建立队列实例并选中其 `queueItemId`，再调用音频启动逻辑。
6. 音频错误重试只刷新当前实例的播放数据，不允许改变当前队列实例。

这一方式比给 `playSong` 增加一个可选索引更稳健，因为索引会随插入、删除和重排变化，而 `queueItemId` 在运行期稳定。

### 7.3 状态更新策略

本次可以分两步落地，控制改动风险：

1. 先修复身份链路，保留现有 Context 外部接口的大部分形状，消除 `usePlaySong` 对队列的隐式写入。
2. 再把队列相关 state 收敛为 `useReducer` 或一个纯状态转换函数，使插入、激活、消费、删除和重排成为原子动作。

第二步不应与音频代理、UI 重构或持久化格式调整混在同一个提交中。

## 8. 实施计划

### 阶段 A：先补失败用例

新增集成级测试，先证明当前实现失败：

1. 当前 `B`，插入当前歌曲 `B`，下一首必须选中新实例且只消费一次。
2. 当前 `B`，插入原本位于前方的 `A`，不得跳回原 `A` 实例。
3. 手动点播优先项后，该项必须从 `priorityNext` 移除。
4. 连续插入 `X`、`Y`，必须按 FIFO 播放，且每个实例仅消费一次。
5. 重复歌曲发生播放地址刷新/错误重试时，`currentQueueItemId` 不变。

建议优先覆盖 `PlayerProvider + usePlaybackControls + 播放启动 Hook` 的完整链路，而不只测试纯函数。

### 阶段 B：切断 `usePlaySong` 的队列副作用

- 移除其对 `setQueue`、`setCurrentIndex` 的隐式调用和相关参数。
- 审计所有 `playSong` 调用点，确保调用前已经明确选择队列实例。
- 对播放地址刷新、重试和本地缓存回退做回归验证。

### 阶段 C：统一按 `queueItemId` 激活

- 为下一曲、上一曲、队列行点击和删除当前项后的 fallback 建立同一入口。
- 避免同一路径连续调用 `setCurrentQueueItemId`、`setCurrentIndex`、`setCurrentSong`，再由 `playSong` 重复写入。
- 保留 `currentIndex` 为从 `items + currentQueueItemId` 推导出的兼容字段；运行期导航不再把索引作为身份。

### 阶段 D：补全优先队列规则

- 自动播放优先项时消费队首。
- 手动点播优先项时按 `queueItemId` 移除对应项。
- 删除、清空、重排后验证 `priorityNext` 只包含有效且不重复的 ID。
- 把 `consumePriorityNext` 改成语义明确、没有伪同步返回值的动作。

### 阶段 E：质量检查

执行：

```bash
cd frontend
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build
```

本次计划仅涉及已有前端接口，不需要执行 `wails generate module`。

## 9. 预计涉及文件

| 文件 | 计划改动 |
| --- | --- |
| `frontend/src/context/contexts/PlayerContext.tsx` | 增加/收敛按 `queueItemId` 的激活动作与优先项消费规则 |
| `frontend/src/context/types/contexts.ts` | 更新队列动作类型 |
| `frontend/src/hooks/player/usePlaybackControls.ts` | 下一曲/上一曲只选择队列实例，不再依赖歌曲 ID 回写索引 |
| `frontend/src/hooks/player/usePlaySong.ts` | 移除队列选择副作用，保留音频解析与启动职责 |
| `frontend/src/hooks/player/usePlayModes.ts` | 新队列或队列外歌曲先创建并选中实例 |
| `frontend/src/hooks/player/useAudioEvents.ts` | 重试时保持当前 `queueItemId` |
| `frontend/src/App.tsx` | 队列行点击、删除 fallback 接入统一激活入口 |
| 对应 `*.test.ts(x)` | 增加重复实例、优先项消费和跨 Hook 集成测试 |

## 10. 验收矩阵

| 场景 | 预期 |
| --- | --- |
| 插入全新歌曲 | 下一次切歌播放该实例 |
| 插入当前歌曲 | 新实例播放一次，当前高亮指向新实例 |
| 插入队列前方已存在歌曲 | 播放插入实例，不跳回原实例 |
| 插入队列后方已存在歌曲 | 先播放插入实例；原实例是否保留按“允许重复”语义执行 |
| 连续插入三首 | 严格 FIFO，每项消费一次 |
| 手动点播优先项 | 立即播放且从优先列表移除 |
| 手动点播非优先项 | 现有优先项仍是下一首 |
| 删除优先项 | 不再被导航选中 |
| 列表循环 | 插入项消费后从其实际实例位置继续 |
| 随机播放 | 优先项先于随机顺序，消费后恢复稳定随机序列 |
| 单曲循环 | 自然结束仍循环；用户手动下一曲可进入优先项 |
| URL 刷新/本地缓存失败重试 | 当前队列实例不漂移 |
| 应用重启 | 现有歌曲 ID + 索引持久化兼容，不破坏旧数据 |

## 11. 完成标准

- 队列导航路径不再使用 `song.id` 判断具体队列实例。
- `currentQueueItemId`、当前歌曲和 UI 高亮始终对应同一条目。
- `priorityNext` 中的每个实例最多消费一次。
- 上述验收矩阵有自动化覆盖，尤其包含重复歌曲。
- 现有 126 个测试继续通过，新增回归测试通过。
- 不改变后端数据结构，不要求用户迁移现有数据库。
