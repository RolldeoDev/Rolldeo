# Calculated contrast evidence

Calculated from the exact sRGB hex values in [palettes.json](palettes.json). CSS HSL equivalents retain four decimal places. Method: linearize each sRGB channel at 0.04045, compute L = 0.2126R + 0.7152G + 0.0722B, then (Lmax + 0.05)/(Lmin + 0.05). Ratios below are rounded after calculation. Normal text threshold 4.5:1; meaningful boundaries and focus indicators 3:1. No opacity is applied to essential text or boundaries.

| Pair | Required | Cobalt dark | Cobalt light | Verdigris dark | Verdigris light |
|---|---:|---:|---:|---:|---:|
| text / canvas | 4.5:1 | 15.91:1 | 13.79:1 | 14.16:1 | 11.29:1 |
| text / surface | 4.5:1 | 13.58:1 | 14.95:1 | 11.24:1 | 12.46:1 |
| text / raised | 4.5:1 | 11.61:1 | 12.63:1 | 8.86:1 | 10.37:1 |
| muted / surface | 4.5:1 | 7.94:1 | 6.08:1 | 7.41:1 | 6.01:1 |
| muted / raised | 4.5:1 | 6.79:1 | 5.14:1 | 5.84:1 | 5.01:1 |
| accent / surface | 4.5:1 | 8.85:1 | 5.65:1 | 7.28:1 | 6.78:1 |
| accent / raised | 4.5:1 | 7.57:1 | 4.77:1 | 5.73:1 | 5.65:1 |
| on-accent / accent | 4.5:1 | 9.82:1 | 5.82:1 | 8.42:1 | 6.96:1 |
| on-accent / accent-hover | 4.5:1 | 12.13:1 | 8.26:1 | 10.61:1 | 9.78:1 |
| line / surface | 3:1 | 3.90:1 | 3.81:1 | 4.26:1 | 3.69:1 |
| line / raised | 3:1 | 3.33:1 | 3.22:1 | 3.36:1 | 3.07:1 |
| accent / canvas | 3:1 | 10.37:1 | 5.21:1 | 9.16:1 | 6.15:1 |
| success / surface | 4.5:1 | 9.18:1 | 6.66:1 | 7.75:1 | 6.68:1 |
| warning / surface | 4.5:1 | 9.20:1 | 6.45:1 | 8.38:1 | 6.64:1 |
| danger / surface | 4.5:1 | 8.14:1 | 6.38:1 | 6.79:1 | 6.55:1 |

These checks validate specified pairs, not rendered app accessibility. Recalculate overlays, syntax colors, selected-row fills, custom artwork, all result variants, and any additional preset. Status color is for text/icons on a surface; do not use it as a filled button background without defining and verifying its foreground. Texture belongs behind illustration, outside reading and control surfaces.
