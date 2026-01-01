# App.tsx 迁移实现指南

> **目标**: 完成 App.tsx 的最终迁移，移除所有旧 Context 依赖
> **复杂度**: 🟡 中等 (需要处理 modal 操作映射)
> **预期时间**: 30-45 分钟

## 当前状态

### 使用的 Context
```typescript
// 第 68-79 行
const { state: themeState, actions: themeActions } = useThemeContext();
const { themes, currentThemeId, themeColor, ... } = themeState;
const { setThemes, setCurrentThemeId, setThemeColor, ... } = themeActions;

const { modals, openModal, closeModal } = useModalContext();
```

### 问题分析
1. **themeState 和 themeActions**: 直接可以用 `store.theme` 和 `store.actions` 替代
2. **modals 对象**: 需要从 `store.modals` 获取
3. **openModal/closeModal**: 问题！
   - 旧 Context: 通用函数 (接收 modal 名称)
   - 新 AppStore: 具体的 open/close 方法 (openLogin, closeLogin, etc.)
   - 需要创建适配层

## 实现步骤

### 第1步: 替换导入
```typescript
// 旧
import { useThemeContext, useModalContext } from "./context";

// 新
import { useAppStore } from "./hooks";
import { useComputedColorScheme } from "@mantine/core";
```

### 第2步: 初始化 Store
```typescript
const [store] = useAppStore();
const computedColorScheme = useComputedColorScheme('light');
```

### 第3步: 提取主题状态和操作
```typescript
// 状态
const {
  themes, currentThemeId, themeColor, backgroundColor, // ...
  colorScheme, windowControlsPos
} = store.theme;

// 操作 (直接从扁平的 store.actions 中获取)
const setThemes = store.actions.setThemes;
const setCurrentThemeId = store.actions.setCurrentThemeId;
const setThemeColor = store.actions.setThemeColor;
// ... 其他 setter (约 20+ 个)
```

### 第4步: 处理 Modal 状态
```typescript
// 状态对象
const modals = store.modals;

// 注意: store.modals 包含如下字段:
// {
//   loginOpen: boolean,
//   settingsOpen: boolean,
//   playlistOpen: boolean,
//   themeManagerOpen: boolean,
//   // ... 其他 modal 状态
// }
```

### 第5步: 创建 Modal 操作映射
这是最复杂的部分。需要创建适配函数将通用的 `openModal`/`closeModal` 映射到具体的操作:

```typescript
// Modal 名称映射
type ModalName = 'loginModal' | 'settingsModal' | 'playlistModal' | /* ... */;

// 创建适配函数
const createModalAdapters = (actions: AppActions) => {
  const modalActionMap: Record<ModalName, { open: () => void; close: () => void }> = {
    'loginModal': {
      open: actions.openLogin,
      close: actions.closeLogin,
    },
    'settingsModal': {
      open: actions.openSettings,
      close: actions.closeSettings,
    },
    'playlistModal': {
      open: actions.openPlaylist,
      close: actions.closePlaylist,
    },
    'themeManagerModal': {
      open: actions.openThemeManager,
      close: actions.closeThemeManager,
    },
    // ... 其他 modal 映射
  };

  return {
    openModal: (name: ModalName) => {
      modalActionMap[name]?.open();
    },
    closeModal: (name: ModalName) => {
      modalActionMap[name]?.close();
    },
  };
};

const { openModal, closeModal } = createModalAdapters(store.actions);
```

### 第6步: 替换 computedColorScheme 来源
```typescript
// 旧
const { computedColorScheme } = useThemeContext().state;

// 新
const computedColorScheme = useComputedColorScheme('light');
```

## 完整改动概览

```typescript
// 1. 导入变更 (第 1-20 行)
- import { useThemeContext, useModalContext } from "./context";
+ import { useAppStore } from "./hooks";
+ import { useComputedColorScheme } from "@mantine/core";

// 2. Store 初始化 (第 68 行)
+ const [store] = useAppStore();
+ const computedColorScheme = useComputedColorScheme('light');

// 3. 状态和操作 (第 69-79 行)
- const { state: themeState, actions: themeActions } = useThemeContext();
- const { modals, openModal, closeModal } = useModalContext();
+ // 从 store 提取所有状态和操作
+ const themeState = store.theme;
+ const { themes, currentThemeId, ... } = themeState;
+ const setThemes = store.actions.setThemes;
+ const setCurrentThemeId = store.actions.setCurrentThemeId;
+ // ... 其他 setters
+ const modals = store.modals;
+ const { openModal, closeModal } = createModalAdapters(store.actions);
```

## 验证清单

- [ ] TypeScript 编译通过 (0 errors)
- [ ] 构建成功 (< 5s)
- [ ] 应用启动成功
- [ ] 主题切换功能正常
- [ ] 所有模态框可以打开/关闭
- [ ] 窗口控制按钮工作正常
- [ ] 搜索功能正常
- [ ] 播放列表操作正常

## 潜在风险

⚠️ **Modal 操作映射**
- 需要确保所有使用 `openModal`/`closeModal` 的地方都能正确映射
- 推荐: 在模态框打开/关闭时添加 console.log 验证

⚠️ **状态完整性**
- 需要确保 store.theme 包含所有需要的字段
- 特别是 `colorScheme` 和 `windowControlsPos`

## 完成后

1. 提交代码
2. 运行完整构建
3. 手动测试所有模态框
4. 更新文档记录
5. 准备 Phase 5-3 (移除旧 Context)

---

**难度**: 🟡 中等
**风险**: 🟢 低 (充分的向后兼容准备)
**预计完成**: 1-2 小时
