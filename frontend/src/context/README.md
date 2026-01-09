# Context 架构重构

## 概述

为了解决原有单一巨型Context导致的性能问题，我们将状态管理重构为4个独立的Context，实现了状态隔离和细粒度订阅。

## 架构设计

### 原有问题
- 单一Context包含所有状态（50+个状态变量）
- 任何状态变化都会触发全局重新渲染
- useMemo依赖项过多，频繁重新计算
- 缺乏状态隔离

### 新架构
```
AppProvider
├── DataProvider     (核心数据：歌曲、收藏夹)
├── PlayerProvider   (播放器：播放状态、队列、控制)
├── ThemeProvider    (主题：颜色、效果、布局)
└── UIProvider       (UI：模态框、搜索、应用状态)
```

## 使用方式

### 1. 新的选择器API（推荐）

```typescript
import { usePlayerStore, useThemeStore } from '@/context';

// 只订阅当前歌曲
const currentSong = usePlayerStore(state => state.playback.currentSong);

// 只订阅主题颜色
const themeColor = useThemeStore(state => state.colors.themeColor);

// 便捷选择器
const { currentSong, isPlaying } = usePlayerStatus();
const { themeColor, backgroundColor } = useUIColors();
```

### 2. 向后兼容API

```typescript
import { useAppStore } from '@/context';

// 原有代码无需修改
const [store, actions] = useAppStore();
```

## 性能优化效果

### 重新渲染隔离
- **播放器状态变化**：只影响播放器相关组件
- **主题状态变化**：只影响主题相关组件  
- **UI状态变化**：只影响UI相关组件
- **数据状态变化**：只影响数据相关组件

### 预期性能提升
- 减少60-80%的不必要重新渲染
- 状态更新响应时间 < 16ms
- 内存使用减少20%

## 迁移指南

### 立即可用
所有现有代码无需修改，向后兼容层确保原有API正常工作。

### 渐进式迁移
1. **新组件**：使用新的选择器API
2. **性能敏感组件**：优先迁移到细粒度订阅
3. **批量迁移**：逐步替换useAppStore为具体的选择器

### 迁移示例

```typescript
// 旧代码
const [store] = useAppStore();
const currentSong = store.player.currentSong;
const themeColor = store.theme.themeColor;

// 新代码（更高性能）
const currentSong = useCurrentSong();
const themeColor = useThemeColor();
```

## 文件结构

```
frontend/src/context/
├── AppContext.tsx          # 向后兼容层
├── AppProvider.tsx         # 统一Provider
├── index.ts               # 统一导出
├── types/
│   └── contexts.ts        # 类型定义
├── contexts/              # 各个Context实现
│   ├── PlayerContext.tsx
│   ├── ThemeContext.tsx
│   ├── UIContext.tsx
│   └── DataContext.tsx
├── hooks/                 # 选择器Hooks
│   ├── usePlayerStore.ts
│   ├── useThemeStore.ts
│   ├── useUIStore.ts
│   └── useDataStore.ts
└── __tests__/             # 性能测试
    └── context-performance.test.tsx
```

## 最佳实践

### 1. 选择合适的选择器
```typescript
// ❌ 订阅整个状态对象
const player = usePlayerStore();

// ✅ 只订阅需要的字段
const currentSong = useCurrentSong();
const isPlaying = useIsPlaying();
```

### 2. 使用组合选择器
```typescript
// ❌ 多次调用
const currentSong = useCurrentSong();
const isPlaying = useIsPlaying();
const progress = useProgress();

// ✅ 一次获取相关状态
const { currentSong, isPlaying, progress } = usePlayerStatus();
```

### 3. 避免在渲染函数中创建选择器
```typescript
// ❌ 每次渲染都创建新函数
const MyComponent = () => {
  const data = usePlayerStore(state => ({ 
    song: state.playback.currentSong,
    playing: state.playback.isPlaying 
  }));
  // ...
};

// ✅ 使用预定义的选择器
const MyComponent = () => {
  const data = usePlayerStatus();
  // ...
};
```

## 测试

运行性能测试：
```bash
npm test -- context-performance.test.tsx
```

## 后续优化

1. **组件记忆化**：为关键组件添加React.memo
2. **虚拟化**：长列表使用虚拟滚动
3. **代码分割**：按功能模块懒加载
4. **缓存优化**：实现LRU缓存机制