# Windows 图标适配与排查

## 构建链路

Windows 应用图标不再由 ImageMagick 脚本预生成。标准链路是：

```text
assets/icons/appicon.png
  -> build/appicon.png
  -> Wails 生成 build/windows/icon.ico
  -> Wails 写入 half-beat.exe 的 RT_GROUP_ICON / RT_ICON
  -> NSIS 快捷方式引用已安装的 half-beat.exe
```

Wails v2.11.0 生成 256、128、64、48、32 和 16px 六档图标。`make package-windows` 会删除旧 `build/windows/icon.ico` 后重新构建，随后直接检查 EXE 的 PE 图标资源；源图和派生资源不一致时构建失败。

## 构建验证

```bash
make verify-app-icon
make package-windows VERSION=1.2.0 CLEAN=1
```

Windows PowerShell 入口执行同样的源图检查、派生文件清理和 EXE 资源检查，不需要安装 ImageMagick 或 icoutils。

## 已安装应用仍显示旧图标

如果新 EXE 的资源检查通过，但 Windows 11 中仍显示 Wails 图标，通常是旧安装、固定任务栏项或 Explorer 图标缓存，而不是当前安装包缺少图标。

按以下顺序处理：

1. 卸载旧版本，确认旧安装目录中的 `half-beat.exe` 已移除，再安装新包。
2. 从任务栏取消固定旧的 Half Beat Player 项。
3. 从开始菜单启动新安装的应用，确认运行中的窗口图标正确后重新固定。
4. 若资源管理器仍显示旧图标，关闭相关资源管理器窗口后重新登录 Windows；也可在任务管理器中选择“Windows 资源管理器”并执行“重新启动”。

不建议由安装器强制终止 Explorer 或删除用户的系统图标缓存。缓存刷新只用于已确认 EXE 图标资源正确后的本机排查。

## 发布验证

全新安装和覆盖安装都应检查以下位置：

- 文件资源管理器中的安装目录和 EXE。
- 开始菜单快捷方式。
- Alt+Tab 切换界面。
- 应用运行时任务栏图标。

若只有升级前固定的任务栏项仍显示旧图标，而新快捷方式与运行时窗口正确，应记录为 Windows 固定项缓存问题，不判定为打包失败。
