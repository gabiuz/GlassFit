/**
 * Pure deterministic CSV formatting utilities adhering to RFC 4180
 * and spreadsheet formula injection sanitization standards.
 */

export const UTF8_BOM = "\uFEFF";

/**
 * Sanitizes and escapes an individual CSV cell value according to RFC 4180.
 * Also mitigates CSV formula injection by prefixing risky trigger characters with a single quote.
 */
export function formatCsvCell(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined) {
        return "";
    }

    let stringValue = String(value);

    // Formula injection mitigation for spreadsheet engines:
    // If the value starts with =, +, -, @, \t, or \r and is not purely a numeric literal (e.g., negative numbers)
    const isPureNumber = typeof value === "number" || (/^-?\d+(\.\d+)?$/).test(stringValue);
    if (!isPureNumber && /^[=+\-@\t\r]/.test(stringValue)) {
        stringValue = `'${stringValue}`;
    }

    // RFC 4180 escaping: check if quotes, commas, newlines are present
    const needsEscaping = /[\",\n\r]/.test(stringValue);
    if (needsEscaping) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

/**
 * Formats a single row of cells into an RFC 4180 compliant CSV line.
 */
export function formatCsvRow(fields: (string | number | boolean | null | undefined)[]): string {
    return fields.map(formatCsvCell).join(",");
}

/**
 * Formats a comment line prefixed with '# '.
 */
export function formatCsvComment(commentText: string): string {
    return `# ${commentText}`;
}

/**
 * Formats a date string or Date object into a readable Philippine Standard Time (PST, UTC+08:00) representation.
 */
export function formatPstTimestamp(dateInput?: string | Date | null): string {
    const date = dateInput ? new Date(dateInput) : new Date();
    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    };

    const formatter = new Intl.DateTimeFormat("en-CA", options);
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const hour = getPart("hour");
    const minute = getPart("minute");
    const second = getPart("second");

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Formats a number as Philippine Peso representation (e.g. PHP 12,450.00).
 */
export function formatPhpCurrency(amount: number): string {
    return `PHP ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates an ASCII/Unicode progress bar for visual representation in CSV text.
 */
export function generateAsciiBar(value: number, total: number, width: number = 20): string {
    if (total <= 0 || value <= 0) {
        return "░".repeat(width);
    }
    const filledCount = Math.min(Math.round((value / total) * width), width);
    const emptyCount = Math.max(width - filledCount, 0);
    return "█".repeat(filledCount) + "░".repeat(emptyCount);
}

/**
 * Generates a multi-segment visual progress bar (e.g., for Done, Ongoing, Pending distribution).
 */
export function generateMultiSegmentBar(
    segments: { count: number; char: string }[],
    totalWidth: number = 24
): string {
    const totalCount = segments.reduce((sum, s) => sum + s.count, 0);
    if (totalCount <= 0) return "░".repeat(totalWidth);

    let allocatedWidth = 0;
    const parts: string[] = [];

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.count <= 0) continue;
        const isLast = i === segments.length - 1;
        const segmentWidth = isLast
            ? totalWidth - allocatedWidth
            : Math.min(Math.round((seg.count / totalCount) * totalWidth), totalWidth - allocatedWidth);

        if (segmentWidth > 0) {
            parts.push(seg.char.repeat(segmentWidth));
            allocatedWidth += segmentWidth;
        }
    }

    if (allocatedWidth < totalWidth) {
        parts.push("░".repeat(totalWidth - allocatedWidth));
    }

    return parts.join("");
}
