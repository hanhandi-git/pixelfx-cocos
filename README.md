# pixelfx-cocos

**Languages / 语言:** [English](README.md) · [简体中文](README.zh-CN.md)

Cocos Creator **3.8.8** preview project for playing PNG/JSON sprite sheets exported from [pixelfx-extended](https://github.com/hanhandi-git/pixelfx-extended).

Effect source and export tools live in the **pixelfx** repo. This repo holds the Creator scenes, scripts, and locally generated `assets/resources/pixelfx/` (gitignored).

## Open the project

```bash
cd /path/to/pixelfx-cocos
/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator \
  --project .
```

Open `assets/scenes/Main.scene` in Creator and press **Preview**. The dev server is usually at `http://localhost:7456/`.

## Export resources

After editing effects in **pixelfx**, from this directory:

```bash
npm run export -- fire/torch          # incremental export for one or more ids
npm run export -- fire ice
npm run export:all                    # full library (slow)
```

Or from the **pixelfx** root:

```bash
npm run cocos:export -- fire/torch
```

Output: `assets/resources/pixelfx/` (gitignored — regenerate, do not commit).

## Runtime component

The copy-paste component is `pixelfx/cocos/runtime/PixelfxSprite.ts`. This project keeps a copy under `assets/scripts/pixelfx/`; Workbench-only scripts exist only here.
