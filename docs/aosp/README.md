# AOSP 源码副本（动效取证用）

来源：`github.com/aosp-mirror/platform_frameworks_base`，ref `android-14.0.0_r1`，
经 GitHub Contents API 逐字节取回，**未做任何编辑**（改一个字就等于编造出处）。

| 文件 | 原路径 | 用途 |
| --- | --- | --- |
| `systemui/EdgePanelParams.kt` | `packages/SystemUI/src/com/android/systemui/navigationbar/gestural/EdgePanelParams.kt` | 预测式返回指示器的几何/弹簧/阈值 |
| `systemui/BackPanelController.kt` | 同目录 | 进度计算与动画编排 |
| `systemui/BackPanel.kt` | 同目录 | 指示器绘制 |
| `systemui/dimens.xml` | `packages/SystemUI/res/values/dimens.xml` | `navigation_edge_*` 全部尺寸 |

引用方式：`docs/MOTION-SPEC.md` 里的每个数值都标了资源名，可直接在本目录 grep 验证，例如：

```bash
grep -n "navigation_edge_active_background_width\|_edge_corners\|_entry_margin" docs/aosp/systemui/dimens.xml
grep -n "commonArrowDimensAlphaThreshold\|createSpring" docs/aosp/systemui/EdgePanelParams.kt
```
