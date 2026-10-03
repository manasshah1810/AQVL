# State Contrast Analysis (WCAG AA)

This document verifies the label-on-fill contrast for every semantic and highlight state in the AQVL visualization. 
Our target is WCAG AA standard, which requires a contrast ratio of **≥ 4.5:1** for normal text.

## Approach & Theming

In the 3D renderer, element surface colors (`color` property) and label text colors (`#ffffff`) do not change between Light and Dark mode UI themes. The emissive glow provides the visual brightness without impacting the readability of the white label text placed on the non-emissive surface color. 

Therefore, the contrast ratios calculated against the white label text are identical across both Light and Dark themes.

## Semantic Palette

| State       | Surface Color (Fill) | Label Color | Contrast Ratio | Status |
| ----------- | -------------------- | ----------- | -------------- | ------ |
| NEUTRAL     | `#257da5`           | `#ffffff`   | 4.61 : 1       | Pass   |
| EVALUATING  | `#a36907`           | `#ffffff`   | 4.58 : 1       | Pass   |
| TRAVERSING  | `#047f94`           | `#ffffff`   | 4.70 : 1       | Pass   |
| MODIFYING   | `#ca3e83`           | `#ffffff`   | 4.64 : 1       | Pass   |
| SUCCESS     | `#0b815a`           | `#ffffff`   | 4.88 : 1       | Pass   |
| DISCARDED   | `#6b7280`           | `#ffffff`   | 4.83 : 1       | Pass   |
| AUXILIARY   | `#984ddf`           | `#ffffff`   | 4.71 : 1       | Pass   |
| STRUCTURAL  | `#5e61e5`           | `#ffffff`   | 4.86 : 1       | Pass   |

## Highlight Palette

| Highlight State | Surface Color (Fill) | Label Color | Contrast Ratio | Status |
| --------------- | -------------------- | ----------- | -------------- | ------ |
| DEFAULT         | `#257da5`           | `#ffffff`   | 4.61 : 1       | Pass   |
| EVALUATING      | `#8f6d14`           | `#ffffff`   | 4.81 : 1       | Pass   |
| MODIFYING       | `#b35486`           | `#ffffff`   | 4.64 : 1       | Pass   |
| TRAVERSING      | `#147e8e`           | `#ffffff`   | 4.77 : 1       | Pass   |
| SUCCESS         | `#218560`           | `#ffffff`   | 4.58 : 1       | Pass   |
| FOCUS           | `#7b66b8`           | `#ffffff`   | 4.74 : 1       | Pass   |

## Conclusion
All label-on-fill color pairings successfully exceed the 4.5:1 WCAG AA contrast threshold.
