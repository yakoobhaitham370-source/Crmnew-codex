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

## Daily work queue

The dashboard is an operational queue, with date and task-type filters, not a collection of metric cards. Each named medication refill and clinical follow-up is one task. Date ranges are overdue, today, days 1–7 ahead, and completed today. Counts reflect the current search and task type. Completed refills require an explicit history event; opening a patient or a reminder never completes a task. Exclude archived patients and invalid medication schedules; flag invalid records for review. Use local calendar dates and refresh the current day on focus and while open.

Patient records validate identity fields, dates and supply lengths before saving. Shared phone numbers require explicit acknowledgement and show matching active and archived records. Keep allergies visible across record tabs and in the refill dialog. An empty allergy field means not recorded; only an explicit entry means no known allergies. Preserve the existing local storage and optional Google Apps Script integration.

Validation: `npm test`, `npm run lint`, `npm run build`. Browser smoke checks cover queue filters, selected-medication refill, confirmed follow-up completion, persistence after reload, duplicate acknowledgement, invalid record input, both themes, Arabic RTL and narrow screens.
