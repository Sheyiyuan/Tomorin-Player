# Phase 5 Store 迁移进度 - 渐进式迁移方案

## 📊 当前状态 (2025年1月1日)

### ✅ 已完成
- AppProvider 已实现并包含完整应用状态
- useAppStore Hook 已定义为单一数据入口
- AppContext 统一管理所有状态
- AppStore 类型定义完整

### 🔄 过渡状态
- 旧 Context 保留以确保兼容性
- App.tsx 仍使用 useThemeContext 和 useModalContext
- 三层 Provider 嵌套保持不变
- 应用运行正常，零类型错误

### 📈 迁移方案
采用**渐进式迁移**而非一次性全量迁移，理由如下：
1. 降低迁移风险
2. 保持应用稳定性
3. 允许组件级别的独立迁移
4. 便于逐步测试验证

## 🛣️ 迁移路线图

### Phase 5-1: 基础架构准备 ✅ 完成
**目标**: 建立新 Store 基础
**实施**:
- [x] 创建 AppStore 类型定义
- [x] 实现 AppProvider 组件
- [x] 定义 useAppStore Hook
- [x] 保留旧 Context 兼容

**成果**: 应用兼容新旧 Store

---

### Phase 5-2: 选择性迁移 (待进行)
**目标**: 逐个组件迁移到 useAppStore
**步骤**:
1. 选择无依赖的组件开始
2. 替换组件中的 Context 为 useAppStore
3. 验证组件功能正常
4. 重复直到所有组件迁移完成

**建议迁移顺序**:
- 第1批: 独立卡片组件 (CurrentPlaylistCard, SongDetailCard)
- 第2批: 模态框组件 (由于彼此独立)
- 第3批: 布局组件 (TopBar, WindowControls)
- 第4批: App.tsx 主组件

**示例流程**:
```typescript
// 迁移前
const { modals, openModal, closeModal } = useModalContext();

// 迁移后
const [store] = useAppStore();
const { modals, ...modalActions } = store.modals;
const { openModal, closeModal } = store.actions;
```

---

### Phase 5-3: 清理旧 Context (待进行)
**目标**: 移除不再使用的旧 Context
**步骤**:
1. 确认所有组件已迁移
2. 从 main.tsx 移除 ThemeProvider
3. 从 main.tsx 移除 ModalProvider
4. 删除旧 Context 文件
5. 验证构建和功能

**删除的文件**:
- `frontend/src/context/ThemeContext.tsx`
- `frontend/src/context/ModalContext.tsx`
- (需要 App.tsx 完全迁移才能执行)

---

### Phase 5-4: 验证和优化 (待进行)
**目标**: 确保迁移完整性和性能
**检查项**:
- [ ] 所有组件类型检查通过
- [ ] 应用功能完整运行
- [ ] 构建时间不增加
- [ ] 包体积保持稳定
- [ ] 没有控制台错误

## 📋 当前 AppStore 结构

```typescript
interface AppStore {
  // 各个状态域
  player: PlayerState;      // 播放器状态
  playlist: PlaylistState;  // 歌单状态
  theme: ThemeState;        // 主题状态
  modals: ModalState;       // 模态框状态
  ui: UIState;              // UI 状态
  data: DataState;          // 数据缓存

  // 所有操作集合
  actions: AppActions;
}

// useAppStore 返回格式
const [store, storeActions] = useAppStore();
// store: AppStore
// storeActions: AppActions
```

## 🔑 关键迁移点

### 状态访问
```typescript
// 旧方式
const { state, actions } = useThemeContext();
const { themeColor } = state;
const { setThemeColor } = actions;

// 新方式
const [store] = useAppStore();
const { themeColor } = store.theme;  // 直接访问
// 操作通过 actions 或直接调用
```

### 操作调用
```typescript
// 旧方式
const { setThemeColor } = useThemeContext().actions;
setThemeColor('#FF0000');

// 新方式
const [store, actions] = useAppStore();
actions.setThemeColor('#FF0000');
```

## ⚙️ 实施建议

### 迁移检查清单
- [ ] 选择目标组件
- [ ] 备份原始代码
- [ ] 更新导入语句
- [ ] 替换状态访问方式
- [ ] 替换操作调用方式
- [ ] 运行类型检查 (`pnpm tsc --noEmit`)
- [ ] 运行构建 (`pnpm build`)
- [ ] 手动测试组件功能

### 构建验证命令
```bash
# 类型检查
pnpm tsc --noEmit

# 构建验证
pnpm build

# 开发模式运行
pnpm dev
```

## 📊 迁移进度追踪

### 当前统计
| 项目 | 状态 | 进度 |
|------|------|------|
| **基础架构** | ✅ 完成 | 100% |
| **类型定义** | ✅ 完成 | 100% |
| **模态框迁移** | ⏳ 待进行 | 0% |
| **布局迁移** | ⏳ 待进行 | 0% |
| **卡片迁移** | ⏳ 待进行 | 0% |
| **App.tsx 迁移** | ⏳ 待进行 | 0% |
| **旧 Context 清理** | ⏳ 待进行 | 0% |

### 优先级排序
1. 🔴 高: App.tsx 完全迁移 (阻止其他优化)
2. 🟡 中: 模态框组件迁移 (可独立进行)
3. 🟡 中: 布局组件迁移 (可独立进行)
4. 🟢 低: 卡片组件迁移 (可独立进行)

## ⚠️ 注意事项

1. **向后兼容性**: 旧 Context 保留直到所有组件迁移完成
2. **增量迁移**: 不要一次性改所有文件，容易出错
3. **充分测试**: 每个组件迁移后都要验证功能
4. **保持构建稳定**: 确保每次 commit 都能构建成功

## 🎯 下一步

1. 选择第一个独立的组件进行试验迁移
2. 验证迁移流程和注意事项
3. 根据试验结果调整迁移计划
4. 逐步迁移剩余组件

---

**状态**: Phase 5-1 完成，Phase 5-2 待进行
**预计完成时间**: Phase 5 整体需要 2-3 小时完成所有迁移
**风险评估**: 低 (采用渐进式迁移确保稳定性)

