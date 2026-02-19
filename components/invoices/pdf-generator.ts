import { formatDate } from "@/lib/utils";
import type { Invoice, InvoiceItem, Payment, Profile } from "@/lib/types";

// jsPDF's built-in fonts don't support the ₱ symbol, so we use a plain-text formatter
function pdfCurrency(amount: number, currencyCode: string = "PHP"): string {
  return currencyCode + " " + amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type InvoiceWithRelations = Invoice & {
  client?: {
    company_name: string;
    email: string | null;
    address: string | null;
    contact_name: string | null;
  } | null;
  items: InvoiceItem[];
  payments: Payment[];
};

// Color palette
const ACCENT = [26, 26, 26] as const;       // Black/charcoal
const GRAY = [115, 115, 115] as const;       // Muted text
const LIGHT_BG = [250, 250, 250] as const;   // Section backgrounds
const BORDER = [229, 229, 229] as const;     // Light borders
const GREEN = [22, 163, 74] as const;        // Paid amount

export async function generateInvoicePdf(
  invoice: InvoiceWithRelations,
  profile: Profile | null
) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ──────────────── TOP ACCENT BAR ────────────────
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageWidth, 3, "F");

  y = 16;

  // ──────────────── HEADER ────────────────
  // Business name (left)
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text(
    profile?.business_name || profile?.full_name || "FreelanceHub",
    margin,
    y
  );

  // "INVOICE" title (right)
  doc.setFontSize(26);
  doc.text("INVOICE", pageWidth - margin, y, { align: "right" });

  y += 5;

  // Business contact details (left, smaller, gray)
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  if (profile?.email) {
    doc.text(profile.email, margin, y);
    y += 3.5;
  }
  if (profile?.phone) {
    doc.text(profile.phone, margin, y);
    y += 3.5;
  }
  if (profile?.address) {
    profile.address.split("\n").forEach((line) => {
      doc.text(line, margin, y);
      y += 3.5;
    });
  }
  if (profile?.tax_id_tin) {
    doc.text(`TIN: ${profile.tax_id_tin}`, margin, y);
    y += 3.5;
  }

  // Invoice meta info (right column)
  let rightY = 23;
  const metaLabelX = pageWidth - margin - 50;
  const metaValueX = pageWidth - margin;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text(invoice.invoice_number, metaValueX, rightY, { align: "right" });
  rightY += 7;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");

  // Issue Date
  doc.setTextColor(...GRAY);
  doc.text("Issue Date", metaLabelX, rightY);
  doc.setTextColor(0, 0, 0);
  doc.text(formatDate(invoice.issue_date), metaValueX, rightY, { align: "right" });
  rightY += 4.5;

  // Due Date
  if (invoice.due_date) {
    doc.setTextColor(...GRAY);
    doc.text("Due Date", metaLabelX, rightY);
    doc.setTextColor(0, 0, 0);
    doc.text(formatDate(invoice.due_date), metaValueX, rightY, { align: "right" });
    rightY += 4.5;
  }

  // Status
  doc.setTextColor(...GRAY);
  doc.text("Status", metaLabelX, rightY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text(
    invoice.status.replace(/_/g, " ").toUpperCase(),
    metaValueX,
    rightY,
    { align: "right" }
  );
  rightY += 4.5;

  y = Math.max(y, rightY) + 5;

  // ──────────────── DIVIDER ────────────────
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ──────────────── BILL TO ────────────────
  // Calculate box height
  let extraLines = 0;
  if (invoice.client?.contact_name) extraLines++;
  if (invoice.client?.email) extraLines++;
  if (invoice.client?.address) {
    extraLines += invoice.client.address.split("\n").length;
  }
  const billToBoxH = 16 + extraLines * 3.5;

  // Light background box
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y - 2, contentWidth * 0.5, billToBoxH, 2, 2, "F");

  // "BILL TO" label
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text("BILL TO", margin + 5, y + 2);
  y += 6;

  // Company name
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(invoice.client?.company_name ?? "\u2014", margin + 5, y + 1);
  y += 5;

  // Client details
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  if (invoice.client?.contact_name) {
    doc.text(invoice.client.contact_name, margin + 5, y);
    y += 3.5;
  }
  if (invoice.client?.email) {
    doc.text(invoice.client.email, margin + 5, y);
    y += 3.5;
  }
  if (invoice.client?.address) {
    invoice.client.address.split("\n").forEach((line) => {
      doc.text(line, margin + 5, y);
      y += 3.5;
    });
  }

  y += 10;

  // ──────────────── LINE ITEMS TABLE ────────────────
  const tableLeft = margin;
  const tableRight = pageWidth - margin;
  const tableWidth = tableRight - tableLeft;
  const colDesc = tableLeft;
  const colQty = tableLeft + tableWidth * 0.50;
  const colPrice = tableLeft + tableWidth * 0.76;
  const colAmount = tableRight;
  const rowHeight = 7.5;
  const cellPad = 3;

  // Table header (rounded top)
  doc.setFillColor(...ACCENT);
  doc.roundedRect(tableLeft, y - 1, tableWidth, rowHeight + 2, 1.5, 1.5, "F");
  doc.rect(tableLeft, y + rowHeight / 2, tableWidth, rowHeight / 2 + 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  const headerTextY = y + cellPad + 0.5;
  doc.text("Description", colDesc + cellPad, headerTextY);
  doc.text("Qty", colQty, headerTextY, { align: "center" });
  doc.text("Unit Price", colPrice - cellPad, headerTextY, { align: "right" });
  doc.text("Amount", colAmount - cellPad, headerTextY, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += rowHeight + 1;

  // Table rows
  doc.setFontSize(8);
  invoice.items.forEach((item, index) => {
    if (y > 250) {
      doc.addPage();
      doc.setFillColor(...ACCENT);
      doc.rect(0, 0, pageWidth, 3, "F");
      y = 16;
    }

    // Alternating row background
    if (index % 2 === 0) {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(tableLeft, y - 1, tableWidth, rowHeight, "F");
    }

    // Row border
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(tableLeft, y - 1 + rowHeight, tableRight, y - 1 + rowHeight);

    const rowTextY = y + cellPad - 0.5;

    // Description (black)
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(item.description.substring(0, 50), colDesc + cellPad, rowTextY);

    // Qty (gray, de-emphasized)
    doc.setTextColor(...GRAY);
    doc.text(item.quantity.toString(), colQty, rowTextY, { align: "center" });

    // Unit price (normal)
    doc.setTextColor(0, 0, 0);
    doc.text(pdfCurrency(item.unit_price, invoice.currency), colPrice - cellPad, rowTextY, { align: "right" });

    // Amount (bold, emphasized)
    doc.setFont("helvetica", "bold");
    doc.text(pdfCurrency(item.amount, invoice.currency), colAmount - cellPad, rowTextY, { align: "right" });

    y += rowHeight;
  });

  // Table bottom border
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(tableLeft, y - 1, tableRight, y - 1);
  doc.setLineWidth(0.2);

  y += 8;

  // ──────────────── TOTALS ────────────────
  const totalsLabelX = colPrice - 4;
  const totalsValueX = colAmount - cellPad;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("Subtotal", totalsLabelX, y, { align: "right" });
  doc.setTextColor(0, 0, 0);
  doc.text(pdfCurrency(invoice.subtotal, invoice.currency), totalsValueX, y, { align: "right" });
  y += 5.5;

  if (invoice.tax_amount > 0) {
    doc.setTextColor(...GRAY);
    doc.text(`Tax (${(invoice.tax_rate * 100).toFixed(1)}%)`, totalsLabelX, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.text(pdfCurrency(invoice.tax_amount, invoice.currency), totalsValueX, y, { align: "right" });
    y += 5.5;
  }

  // Total highlight bar (rounded)
  const totalBarX = totalsLabelX - 35;
  const totalBarW = colAmount - totalBarX + cellPad;
  doc.setFillColor(...ACCENT);
  doc.roundedRect(totalBarX, y - 3.5, totalBarW, 9, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Total", totalsLabelX, y + 1.5, { align: "right" });
  doc.text(pdfCurrency(invoice.total, invoice.currency), totalsValueX, y + 1.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 12;

  // PHP Equivalent (when exchange rate is set for non-PHP invoices)
  if (invoice.currency !== "PHP" && invoice.exchange_rate) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(
      `1 ${invoice.currency} = ${invoice.exchange_rate} PHP`,
      totalsLabelX,
      y,
      { align: "right" }
    );
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(
      pdfCurrency(invoice.total * invoice.exchange_rate, "PHP"),
      totalsValueX,
      y,
      { align: "right" }
    );
    y += 8;
  }

  // Payment balance
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  if (totalPaid > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text("Amount Paid", totalsLabelX, y, { align: "right" });
    doc.setTextColor(...GREEN);
    doc.text(`- ${pdfCurrency(totalPaid, invoice.currency)}`, totalsValueX, y, { align: "right" });
    y += 5.5;

    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.3);
    doc.line(totalBarX, y - 2, colAmount + cellPad, y - 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...ACCENT);
    doc.text("Balance Due", totalsLabelX, y + 2, { align: "right" });
    doc.text(pdfCurrency(invoice.total - totalPaid, invoice.currency), totalsValueX, y + 2, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 10;
  }

  // ──────────────── PAYMENT METHODS ────────────────
  const enabledMethods = profile?.payment_methods?.filter((pm) => pm.enabled) ?? [];
  if (enabledMethods.length > 0) {
    y += 4;

    if (y > 235) {
      doc.addPage();
      doc.setFillColor(...ACCENT);
      doc.rect(0, 0, pageWidth, 3, "F");
      y = 16;
    }

    // Pre-calculate box height
    let pmBoxH = 8;
    enabledMethods.forEach((pm) => {
      pmBoxH += 4;
      const detailLines = doc.splitTextToSize(pm.details, contentWidth - 14);
      pmBoxH += detailLines.length * 3.5 + 2;
    });

    // Bordered box
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y - 2, contentWidth, pmBoxH, 2, 2, "S");

    // Section label
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text("PAYMENT METHODS", margin + 5, y + 2);
    y += 7;

    doc.setFontSize(8);
    enabledMethods.forEach((pm) => {
      if (y > 260) {
        doc.addPage();
        doc.setFillColor(...ACCENT);
        doc.rect(0, 0, pageWidth, 3, "F");
        y = 16;
      }

      // Method label
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...ACCENT);
      doc.text(pm.label, margin + 5, y);
      y += 3.5;

      // Method details
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      const detailLines = doc.splitTextToSize(pm.details, contentWidth - 14);
      doc.text(detailLines, margin + 5, y);
      y += detailLines.length * 3.5 + 2;
    });

    y += 2;
  }

  // ──────────────── NOTES ────────────────
  if (invoice.notes) {
    y += 4;
    if (y > 255) {
      doc.addPage();
      doc.setFillColor(...ACCENT);
      doc.rect(0, 0, pageWidth, 3, "F");
      y = 16;
    }

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRAY);
    doc.text("NOTES", margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const noteLines = doc.splitTextToSize(invoice.notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 3.5;
  }

  // ──────────────── PAYMENT TERMS ────────────────
  if (invoice.payment_terms) {
    y += 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(`Terms: ${invoice.payment_terms}`, margin, y);
  }

  // ──────────────── FOOTER (all pages) ────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer divider
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

    // Thank you text
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 13, { align: "center" });

    // Page numbers (multi-page only)
    if (totalPages > 1) {
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 13, { align: "right" });
    }

    // Bottom accent bar
    doc.setFillColor(...ACCENT);
    doc.rect(0, pageHeight - 3, pageWidth, 3, "F");
  }

  // Download
  doc.save(`${invoice.invoice_number}.pdf`);
}
