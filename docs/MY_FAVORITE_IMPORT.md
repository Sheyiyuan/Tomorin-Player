# 导入登录用户收藏夹功能

## 功能概述

允许登录用户直接从自己的 B站 收藏夹列表中选择并导入收藏夹到本地歌单,无需手动输入 fid。

## 实现架构

### 1. 后端 API

使用已有的 API:
```go
func (s *Service) GetMyFavoriteCollections() ([]models.BiliFavoriteCollection, error)
```

返回登录用户的收藏夹列表,包含:
- `id` - 收藏夹 ID
- `title` - 收藏夹标题
- `count` - 视频数量
- `cover` - 封面图

### 2. 前端 Hook

#### `useMyFavoriteImport`

**文件**: `frontend/src/hooks/features/useMyFavoriteImport.ts`

**功能**:
1. 获取登录用户的收藏夹列表
2. 管理收藏夹选择状态
3. 复用 `useFidImport` 的导入逻辑

**接口**:
```typescript
interface UseMyFavoriteImportOptions {
    themeColor: string;
    songs: Song[];
    onStatusChange?: (status: string) => void;
}

返回值:
{
    // 状态
    myCollections: MyFavoriteCollection[];
    isLoading: boolean;
    isImporting: boolean;
    selectedCollectionId: number | null;
    
    // 方法
    setSelectedCollectionId: (id: number | null) => void;
    fetchMyCollections: () => Promise<MyFavoriteCollection[]>;
    importSelectedCollection: () => Promise<ImportResult | null>;
}
```

### 3. UI 组件

#### `CreateFavoriteModal`

**更新**:
- 添加收藏夹选择器 (Select 组件)
- 显示收藏夹列表 (标题 + 视频数量)
- 支持加载状态和重新获取

**新增 Props**:
```typescript
// 状态
myCollections: MyCollectionOption[];
isLoadingCollections: boolean;
selectedMyCollectionId: number | null;

// 操作
onMyCollectionSelect: (id: number | null) => void;
onFetchMyCollections: () => void;
```

### 4. 集成到 useFavoriteActions

导出 `myFavoriteImport` 对象,使其可在 App.tsx 中使用:
```typescript
return {
    deleteFavorite,
    editFavorite,
    saveEditFavorite,
    createFavorite,
    addToFavorite,
    myFavoriteImport, // 新增
};
```

## 使用流程

### 用户操作

1. 点击"新建歌单"按钮
2. 选择创建方式："导入登录收藏夹 (需登录)"
3. 等待收藏夹列表加载 (自动获取)
4. 从下拉列表选择要导入的收藏夹
5. 输入歌单名称 (可选,会自动使用收藏夹标题)
6. 点击"确认"

### 技术流程

```
用户选择 "importMine" 模式
    ↓
CreateFavoriteModal 自动调用 fetchMyCollections()
    ↓
获取登录用户收藏夹列表 (GetMyFavoriteCollections API)
    ↓
显示收藏夹选择器 (标题 + 数量)
    ↓
用户选择收藏夹
    ↓
点击"确认" → handleSubmitCreateFavorite
    ↓
createFavorite({ mode: "importMine", selectedMyFavId: 123 })
    ↓
调用 importFromFid(String(selectedMyFavId)) 复用导入逻辑
    ↓
创建新歌单,自动使用收藏夹标题作为歌单名
```

## 技术亮点

### 1. 代码复用

**不重复造轮子**:
- 直接复用 `useFidImport` 的导入逻辑
- 统一处理 fid 导入和我的收藏夹导入
- 减少维护成本

```typescript
// useMyFavoriteImport 内部
const { isImporting, importFromFid } = useFidImport({
    themeColor,
    songs,
    onStatusChange,
});

const importSelectedCollection = async () => {
    if (selectedCollectionId === null) return null;
    return await importFromFid(String(selectedCollectionId));
};
```

### 2. 智能命名

**自动使用收藏夹标题**:
- `importFromFid` 返回 `collectionTitle`
- 如果用户未修改默认歌单名,自动使用收藏夹标题
- 提供更好的用户体验

```typescript
let finalName = name;
if (collectionTitle && (name === "新歌单" || !name.trim())) {
    finalName = collectionTitle;
}
```

### 3. 自动获取列表

**模态框打开时自动加载**:
- 使用 React `useEffect` 监听模式切换
- 避免用户手动点击"获取列表"
- 减少操作步骤

```typescript
React.useEffect(() => {
    if (opened && createFavMode === "importMine" && myCollections.length === 0 && !isLoadingCollections) {
        onFetchMyCollections();
    }
}, [opened, createFavMode, myCollections.length, isLoadingCollections, onFetchMyCollections]);
```

### 4. 错误处理

**友好的错误提示**:
- 未登录 → 提示登录并打开登录模态框
- 未选择收藏夹 → 橙色提示
- 收藏夹为空 → 显示"暂无可用收藏夹"并提供重新获取按钮
- API 错误 → 显示详细错误消息

## 相关文件

| 文件 | 说明 |
|------|------|
| `frontend/src/hooks/features/useMyFavoriteImport.ts` | 核心 Hook 实现 |
| `frontend/src/hooks/features/useFavoriteActions.ts` | 集成到歌单操作 |
| `frontend/src/components/CreateFavoriteModal.tsx` | UI 组件更新 |
| `frontend/src/App.tsx` | 状态和方法传递 |
| `internal/services/service.go` | 后端 API (已有) |

## 测试建议

1. **登录测试**
   - 未登录时选择"导入登录收藏夹" → 应提示登录
   - 登录后切换到此模式 → 自动获取收藏夹列表

2. **列表获取测试**
   - 有收藏夹 → 显示列表
   - 无收藏夹 → 显示提示和重新获取按钮
   - 网络错误 → 显示错误消息

3. **导入测试**
   - 选择收藏夹 → 成功导入
   - 未选择收藏夹点击确认 → 提示选择
   - 大收藏夹 (100+ 视频) → 进度正常显示
   - 重复视频 → 正确去重

4. **命名测试**
   - 默认名字 → 使用收藏夹标题
   - 自定义名字 → 使用用户输入

## 未来改进

1. **缓存收藏夹列表** - 避免每次打开模态框都重新获取
2. **收藏夹封面** - 在选择器中显示收藏夹封面图
3. **批量导入** - 支持一次导入多个收藏夹
4. **过滤选项** - 按视频数量、创建时间等筛选收藏夹
5. **预览功能** - 导入前预览收藏夹内容

## 编译验证

✅ 编译成功 (2025-12-26)
```
vite v5.4.21 building for production...
✓ 2601 modules transformed.
dist/assets/index-D1FTACqb.js   533.64 kB │ gzip: 167.42 kB
✓ built in 2.69s
```

## 状态

✅ 功能完成  
✅ 编译通过  
⏳ 待用户测试验证  

---

**创建日期**: 2025-12-26  
**版本**: v1.0.0  
**作者**: GitHub Copilot
