# Dice artwork

Original, unnumbered SVG icons for the SVG presenter. Each uses a `0 0 100 100`
viewBox, `currentColor` strokes and a `.die-outline` class. Faceted dice also
provide `.die-facets`, so outline, facets and fill can be styled independently.

Use d10 artwork for percentile dice and d6 artwork for Fudge dice. Use `generic.svg`
for unsupported face counts. Add values, die labels and modifier indicators as
separate layers; they are not baked into these assets.

Each SVG owns an empty `<text data-slot="value">` element, including its position,
alignment, default font size and available width (`data-max-width`, in viewBox
units). Consumers provide a value, not coordinates. `packages/svg/src/value-slot.ts` fills
the slot with escaped text and conservatively reduces the font size for longer
values. This estimate is font-independent; custom fonts may need CSS adjustments.
An empty value leaves the artwork blank, as used for the zero face of Fudge dice.

The local gallery in `demo/svg/SvgDemo.vue` demonstrates the icons with values, including
the three Fudge faces and a three-digit percentile result. CSS styling requires
inline SVG; page styles do not reach inside an SVG loaded through an `<img>`.
