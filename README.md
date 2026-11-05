# pixelfx-cocos

Cocos Creator **3.8.8** 预览工程：播放从 [pixelfx](../pixelfx) 导出的 PNG/JSON 特效资源。

特效源码与导出工具在 sibling 仓库 `pixelfx`；本仓库只保留 Cocos 场景、脚本与（本地生成的）`assets/resources/pixelfx/`。

## 打开工程

```bash
cd /path/to/pixelfx-cocos
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator \
  --project .
```

在 Creator 中打开 `assets/scenes/Main.scene`，点击 **Preview**。预览地址一般为 `http://localhost:7456/`。

## 导出资源

在 `pixelfx` 中改完特效后，在本目录执行：

```bash
npm run export -- fire/torch          # 增量导出指定 ID
npm run export -- fire ice             # 多个 pattern
npm run export:all                     # 全库（耗时长）
```

或在 `pixelfx` 根目录：

```bash
npm run cocos:export -- fire/torch
```

导出目录：`assets/resources/pixelfx/`（已 gitignore，勿提交）。

## 运行时组件

可复制的通用组件在 `pixelfx/cocos/runtime/PixelfxSprite.ts`。本工程内的副本在 `assets/scripts/pixelfx/`；Workbench 专用脚本仅存在于本仓库。
