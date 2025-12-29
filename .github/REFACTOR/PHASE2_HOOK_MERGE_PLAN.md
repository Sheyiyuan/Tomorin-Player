# 前端重构 - 阶段 2：Hook 合并计划

## 现有 Hook 分析

### 播放器 Hook (13 个)

```
hooks/player/
├── useAudioPlayer.ts          → 音频播放核心逻辑
├── usePlaylist.ts             → 播放列表管理
├── useAudioInterval.ts        → 音频区间计算（跳过片头片尾）
├── usePlaylistActions.ts      → 播放列表操作
├── useSkipIntervalHandler.ts  → 跳过区间处理
├── useDownloadManager.ts      → 下载管理
├── useAudioEvents.ts          → 音频事件监听
├── usePlaybackControls.ts     → 播放控制（播放/暂停/快进等）
├── usePlaylistPersistence.ts  → 播放列表持久化
├── useAudioSourceManager.ts   → 音频源管理
├── usePlaySong.ts             → 播放歌曲
├── usePlayModes.ts            → 播放模式（循环/随机等）
└── index.ts                   → 导出文件
```

### 合并策略

**目标：13 个 Hook → 4 个 Hook**

| 新 Hook              | 合并来源                                                                           | 职责                 |
| -------------------- | ---------------------------------------------------------------------------------- | -------------------- |
| `usePlayer`          | useAudioPlayer + usePlaybackControls + usePlaySong + usePlayModes                  | 核心播放逻辑与控制   |
| `usePlaylist`        | usePlaylist + usePlaylistActions + usePlaylistPersistence                          | 播放列表管理         |
| `useAudio`           | useAudioEvents + useAudioInterval + useSkipIntervalHandler + useAudioSourceManager | 音频事件与处理       |
| `useDownloadManager` | 保持原样                                                                           | 下载管理（相对独立） |

### 特性 Hook 整理

**保留的独立 Hook**：
- `useAuth` - 认证管理
- `useThemeEditor` - 主题编辑
- `useFavoriteActions` - 收藏操作
- `useBVResolver` - BV 号解析
- `useSearchAndBV` - 搜索与 BV
- 其他业务相关 Hook

### UI Hook 整理

**保留的独立 Hook**：
- `useHitokoto` - 一言集成
- `useModalManager` - 模态框管理

**需要创建的新 Hook**：
- `useAppInitialize` - 集中应用初始化逻辑

## 实施步骤

### 第 1 步：创建合并后的 Hook（hooks/player/）

1. `usePlayer.ts` - 合并播放控制逻辑
2. `usePlaylist.ts` - 重写播放列表逻辑
3. `useAudio.ts` - 合并音频事件处理

### 第 2 步：创建应用初始化 Hook（hooks/ui/）

1. `useAppInitialize.ts` - 集中 App.tsx 的初始化逻辑

### 第 3 步：更新 Hook 导出

1. 更新 `hooks/player/index.ts`
2. 更新 `hooks/ui/index.ts`
3. 更新 `hooks/index.ts`

### 第 4 步：验证与测试

1. TypeScript 类型检查
2. 构建验证
3. 功能测试

### 第 5 步：清理旧文件

1. 删除已合并的旧 Hook 文件

## Hook 职责重新定义

### usePlayer Hook

```typescript
interface PlayerState {
    queue: Song[];
    currentIndex: number;
    currentSong: Song | null;
    isPlaying: boolean;
    playMode: PlayMode;
}

interface PlayerActions {
    play(): void;
    pause(): void;
    nextSong(): void;
    prevSong(): void;
    seek(time: number): void;
    setPlayMode(mode: PlayMode): void;
    setSong(song: Song): void;
}

return { state, actions, audioRef };
```

### usePlaylist Hook

```typescript
interface PlaylistState {
    queue: Song[];
    currentIndex: number;
    currentSong: Song | null;
}

interface PlaylistActions {
    setQueue(queue: Song[]): void;
    setCurrentIndex(index: number): void;
    loadPlaylist(): Promise<void>;
    savePlaylist(): Promise<void>;
}

return { state, actions };
```

### useAudio Hook

```typescript
interface AudioState {
    progress: number;
    duration: number;
    volume: number;
    progressInInterval: number;
}

interface AudioActions {
    seek(time: number): void;
    setVolume(volume: number): void;
    setSkipInterval(start: number, end: number): void;
}

return { state, actions, audioRef };
```

## 时间预估

| 任务                  | 预估时间     |
| --------------------- | ------------ |
| 分析现有代码          | 30 分钟      |
| 创建 usePlayer        | 30 分钟      |
| 创建 usePlaylist      | 30 分钟      |
| 创建 useAudio         | 30 分钟      |
| 创建 useAppInitialize | 30 分钟      |
| 更新导出文件          | 20 分钟      |
| 验证与修复            | 30 分钟      |
| **总计**              | **3-4 小时** |

## 风险评估

| 风险          | 概率 | 影响 | 缓解策略              |
| ------------- | ---- | ---- | --------------------- |
| Hook 依赖复杂 | 中   | 高   | 详细分析依赖图        |
| 类型不匹配    | 中   | 中   | 渐进式迁移 + 类型检查 |
| 功能遗漏      | 低   | 高   | 全面的单元测试        |
| 性能下降      | 低   | 中   | 使用 useMemo 优化     |

## 验证清单

- [ ] 所有 Hook 成功创建
- [ ] TypeScript 类型检查通过
- [ ] Vite 构建成功
- [ ] 旧 Hook 文件成功删除
- [ ] 应用正常运行
- [ ] 功能测试通过

---

**准备开始实施阶段 2！** 🚀
