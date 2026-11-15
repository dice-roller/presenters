/** Inserts a value into a trusted dice SVG template without requiring a DOM. */
export function fillValueSlot(svg: string, value: string | number): string {
  const text = String(value);
  const escaped = text.replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    }[character]!;
  });

  return svg.replace(
    /<text\b([^>]*\bdata-slot="value"[^>]*)>[\s\S]*?<\/text>/g,
    (_slot, attributes: string) => {
      const fontSize = Number(attributes.match(/\bfont-size="([\d.]+)"/)?.[1]);
      const maxWidth = Number(
        attributes.match(/\bdata-max-width="([\d.]+)"/)?.[1],
      );

      if (fontSize > 0 && maxWidth > 0 && text.length > 0) {
        // Conservative estimate: keeps common numeric values inside the face
        // without relying on browser font measurement. CSS can override the size.
        const fittedSize = Math.min(
          fontSize,
          maxWidth / (Array.from(text).length * 0.7),
        );
        attributes = attributes.replace(
          /\bfont-size="[\d.]+"/,
          `font-size="${Number(fittedSize.toFixed(2))}"`,
        );
      }

      return `<text${attributes}>${escaped}</text>`;
    },
  );
}
