# Chinese-woodblock-printing
Chinese woodblock printing

## 下一次展会直接复用

- [展会网页工作流与现场检查清单](docs/EXHIBITION-WORKFLOW.md)
- [2026 AIPPI 日志、发布记录和滚动问题复盘](docs/exhibitions/2026-10-07-aippi.md)
- [正式展示网址（访客扫码用，不自动滚动）](https://cyber60j.github.io/Chinese-woodblock-printing/)
- [展台 iPad 自动循环网址](https://cyber60j.github.io/Chinese-woodblock-printing/?display=1)

按工作流提供展会名称、每组雕版图/印样、故事及是否可以上手印制，即可沿用当前双语页面和 iPad 自动循环展示。之后的展会另建记录，保留本次基线。

## 展示页播放检查

正式入口为 `index.html`，本地演示为 `aippi-2026-demo.html`，两者使用同一套播放逻辑。
修改播放逻辑后，使用 Node.js 22 或更新版本运行：

```sh
node --test tests/playback.test.cjs
```

GitHub Actions 会在 HTML、测试或检查工作流变更时运行这些测试。测试模拟整像素滚动位置、触摸事件与屏幕尺寸变化，检查继续播放、持续暂停和到底循环，并确认不带 `?display=1` 时不会自动滚动；它们不能替代真实设备检查。

## 图片处理

网页图片由 `tools/prepare_images.py` 从原图生成：透视拉直、裁掉画框和桌面，并输出整图、两档网页图和缩略图。分享预览图和网站图标由 `tools/make_share_assets.py` 生成。需要 Python 3、OpenCV、Pillow。

发布后，在准备使用的 iPad 浏览器中打开带 `?display=1` 的网址并刷新，确认：

- 点暂停后页面持续静止，点继续后立即前进，状态文字与实际动作一致。
- 手指滑动后暂停展示，松开约 10 秒后恢复；再次点继续可立即恢复。
- 横竖屏切换和浏览器工具栏收展后仍能继续滚动。
- 到底停留后回到顶部，展开雕版照片后能展示新增内容并完成循环。
