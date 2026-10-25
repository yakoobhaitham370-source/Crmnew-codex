# PharmPulse interface

Use a compact Microsoft Fluent UI v9 visual language implemented with Tailwind CSS and semantic CSS tokens. The existing application uses React components and Lucide icons; Fluent React packages are not installed.

- System UI / Segoe UI typography. Monospace only for dates, counts, IDs and numerical values.
- Flat surfaces, 1px borders, 4px corners, no decorative gradients, blur or drop shadows.
- Compact 12px panel padding, 8–12px gaps, 40px section headers and pivot navigation with a 3px active underline.
- Light: canvas #FAF9F8, surface #FFFFFF, stroke #EDEBE9, text #242424, secondary #605E5C, brand #0078D4, hover #106EBE, pressed #005A9E.
- Dark (root `.dark` class): canvas #11100F, surface #201F1E, secondary surface #252423, stroke #3B3A39, text #F3F2F1, secondary #A19F9D, brand #2899F5.
- Semantic success, warning and critical tokens live in src/index.css and adapt to both modes. Use matching foreground, background and border tokens together.
- Every control needs hover, active, disabled and visible keyboard focus states. Respect reduced motion.
- Preserve Arabic RTL and English LTR layouts. Tables align to the reading direction and scroll within their own container. Header actions wrap at narrow widths.
- Preserve clinical calculations, data, action handlers and existing workflows when styling components. No invented patient data or integration claims.
