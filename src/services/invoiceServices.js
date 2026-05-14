import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import Invoice from "../model/invoice.model.js";
import Counter from "../model/counter.model.js";
import Order from "../model/order.model.js";
import CompanyService from "./companyServices.js";
import ObjectStorageService from "../middlewares/uploads.js";
import { AppError } from "../utils/apiResponse.js";

// ── Constants ───────────────────────────────────────────────────────────────
const PAGE_WIDTH = 595.28; // A4
const MARGIN = 40;
const RIGHT = PAGE_WIDTH - MARGIN;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const GST_RATE = 18;
const CGST_RATE = GST_RATE / 2;
const SGST_RATE = GST_RATE / 2;
const ACCENT = "#E67E22";   // orange
const DARK = "#2C3E50";
const GREY = "#7F8C8D";
const RED = "#E74C3C";
const GREEN = "#27AE60";

const TERMS = [
  "All prices include applicable GST.",
  "Products sold are genuine and quality tested.",
  "Warranty applicable as per product policy.",
  "This is a computer-generated invoice.",
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(date) {
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

function formatCurrency(num) {
  return `₹ ${Number(num || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeText(val) {
  return val ?? "";
}

// ═══════════════════════════════════════════════════════════════════════════
export default class InvoiceService {
  // ── PUBLIC: Generate & upload invoice ─────────────────────────────────────
  static async generateInvoice(orderId, type = "ORDER") {
    try {
      const order = await Order.findById(orderId)
        .populate("customerId")
        .populate({
          path: "address",
          populate: [
            { path: "city", select: "name" },
            { path: "state", select: "name" },
            { path: "country", select: "name" },
            { path: "pincode", select: "code" },
          ],
        })
        .populate("product.productId", "name slug")
        .populate("product.variantId", "mrp finalPrice discount size color")
        .populate("product.comboId", "name comboPrice")
        .lean();

      if (!order) throw new AppError("Order not found", 404);

      const company = await CompanyService.getCompany();

      // Sequential Invoice Number
      const counter = await Counter.findOneAndUpdate(
        { id: "invoice" },
        { $inc: { seq: 1 } },
        { returnDocument: "after", upsert: true },
      );
      const invoiceNumber = `INV-${new Date().getFullYear()}-${counter.seq.toString().padStart(6, "0")}`;

      // ── Build PDF ──
      const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));

      return new Promise((resolve, reject) => {
        doc.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const fileName = `invoices/${invoiceNumber}.pdf`;
            const pdfUrl = await ObjectStorageService.uploadBuffer(buffer, fileName);

            // ── Calculate totals for DB ──
            const { subtotal, totalDiscount, totalTax, grandTotal, taxBreakdown } =
              InvoiceService._calculateTotals(order);

            const invoice = await Invoice.create({
              invoiceNumber,
              orderId,
              customerId: order.customerId._id,
              invoiceType: type,
              paymentStatus: order.paymentStatus,
              pdfUrl,
              totals: {
                subtotal,
                discount: totalDiscount,
                couponDiscount: order.couponDiscount || 0,
                shippingCharge: order.shippingCharge || 0,
                grandTotal,
              },
              taxes: taxBreakdown,
              metadata: {
                cancellationReason: order.cancellationReason,
                paymentMethod: order.paymentMethod,
              },
            });

            await Order.findByIdAndUpdate(orderId, {
              ...(type === "CANCELLATION"
                ? { cancellationInvoiceUrl: pdfUrl }
                : { invoiceUrl: pdfUrl }),
            });

            resolve(invoice);
          } catch (err) {
            reject(err);
          }
        });

        (async () => {
          try {
            await InvoiceService._buildPdf(doc, order, company, invoiceNumber, type);
            doc.end();
          } catch (err) {
            reject(err);
          }
        })();
      });
    } catch (err) {
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF BUILDER — modern orange-accent design
  // ═══════════════════════════════════════════════════════════════════════════
  static async _buildPdf(doc, order, company, invoiceNumber, type) {
    const customer = order.customerId;
    const addr = order.address || {};
    const isCancel = type === "CANCELLATION";
    const today = formatDate(new Date());
    const orderDate = formatDate(order.createdAt);
    const fullName = `${safeText(customer.firstName)} ${safeText(customer.lastName)}`.trim() || "N/A";
    const addrLines = [
      safeText(addr.street),
      [safeText(addr.city?.name), safeText(addr.state?.name)].filter(Boolean).join(", "),
      [safeText(addr.country?.name), addr.pincode?.code ? addr.pincode.code : ""].filter(Boolean).join(" - "),
    ].filter(Boolean);

    let y = MARGIN;

    // ── 1. HEADER ────────────────────────────────────────────────────────────
    let logoW = 0;
    if (company.header_logo) {
      try {
        const buf = await ObjectStorageService.getBuffer(process.env.LINODE_OBJECT_BUCKET, company.header_logo);
        doc.image(buf, MARGIN, y, { height: 35 });
        logoW = 45;
      } catch (e) {}
    }
    doc.font("Helvetica-Bold").fontSize(16).fillColor(DARK);
    doc.text(company.site_name || "DSM Store", MARGIN + logoW, y, { width: 250 });
    doc.font("Helvetica").fontSize(8).fillColor(GREY);
    doc.text(company.address || "", MARGIN + logoW, y + 20, { width: 250 });

    // INVOICE title right
    doc.font("Helvetica-Bold").fontSize(22).fillColor(ACCENT);
    doc.text("INVOICE", RIGHT - 150, y, { width: 150, align: "right" });

    const rX = RIGHT - 200;
    let ry = y + 28;
    doc.font("Helvetica").fontSize(8).fillColor(GREY);
    doc.text("Order:", rX, ry, { width: 100, align: "right" });
    doc.font("Helvetica-Bold").fillColor(DARK).text(String(order._id).slice(-12).toUpperCase(), rX + 102, ry, { width: 100 });
    ry += 12;
    doc.font("Helvetica").fillColor(GREY).text("Invoice #:", rX, ry, { width: 100, align: "right" });
    doc.font("Helvetica-Bold").fillColor(DARK).text(invoiceNumber, rX + 102, ry, { width: 100 });
    ry += 12;
    doc.font("Helvetica").fillColor(GREY).text("Date:", rX, ry, { width: 100, align: "right" });
    doc.font("Helvetica-Bold").fillColor(DARK).text(orderDate, rX + 102, ry, { width: 100 });
    ry += 14;

    // Status badge
    const statusText = isCancel ? "Cancelled" : (order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus);
    const badgeColor = isCancel ? RED : (order.paymentStatus === "PAID" ? GREEN : ACCENT);
    const badgeW = doc.widthOfString(statusText) + 16;
    doc.roundedRect(RIGHT - badgeW - 2, ry, badgeW, 16, 8).fill(badgeColor);
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#fff");
    doc.text(statusText, RIGHT - badgeW + 6, ry + 4, { width: badgeW - 12 });

    y = Math.max(y + 50, ry + 25);
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(2).strokeColor(ACCENT).stroke();
    y += 15;

    // ── 2. BILL TO / SHIP TO / DELIVERY ──────────────────────────────────────
    const secY = y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT).text("BILL TO", MARGIN, secY);
    let by = secY + 14;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text(fullName, MARGIN, by); by += 12;
    doc.font("Helvetica").fontSize(8).fillColor(GREY);
    if (customer.email) { doc.text(customer.email, MARGIN, by); by += 11; }
    if (customer.number) { doc.text(`+91 ${customer.number}`, MARGIN, by); by += 11; }
    for (const l of addrLines) { doc.text(l, MARGIN, by, { width: 200 }); by += 11; }

    const shipX = MARGIN + 220;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT).text("SHIP TO", shipX, secY);
    doc.font("Helvetica").fontSize(8).fillColor(GREY).text("Same as Billing Address", shipX, secY + 14);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(ACCENT).text("DELIVERY", shipX, secY + 36);
    doc.font("Helvetica").fontSize(8).fillColor(GREY);
    doc.text("3-5 Business Days", shipX, secY + 48);
    doc.text(`Mode: ${order.shippingMode === "air" ? "By Air" : "By Road"}`, shipX, secY + 59);

    if (isCancel && order.cancellationReason) {
      by += 5;
      doc.font("Helvetica-Bold").fontSize(9).fillColor(RED);
      doc.text(`Cancellation Reason: ${order.cancellationReason}`, MARGIN, by, { width: CONTENT_WIDTH });
      by += 14;
    }

    y = Math.max(by, secY + 75) + 12;
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor("#ddd").stroke();
    y += 12;

    // ── 3. PRODUCT TABLE ─────────────────────────────────────────────────────
    const tC = [
      { l: "#",           x: MARGIN,       w: 25 },
      { l: "PRODUCT",     x: MARGIN + 25,  w: 145 },
      { l: "DESCRIPTION", x: MARGIN + 170, w: 150 },
      { l: "MRP",         x: MARGIN + 320, w: 70 },
      { l: "PRICE",       x: MARGIN + 390, w: CONTENT_WIDTH - 390 },
    ];
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(2).strokeColor(ACCENT).stroke();
    y += 6;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(GREY);
    for (const c of tC) doc.text(c.l, c.x, y, { width: c.w });
    y += 14;
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor("#eee").stroke();
    y += 8;

    doc.font("Helvetica").fontSize(8).fillColor(DARK);
    let itemsTotal = 0, totalQty = 0, totalMrp = 0;

    for (let i = 0; i < order.product.length; i++) {
      if (y + 20 > 760) { doc.addPage(); y = MARGIN; }
      const item = order.product[i];
      const isCombo = item.itemType === "combo";
      const name = isCombo ? (item.comboId?.name || "Combo") : (item.productId?.name || "Product");
      const variant = !isCombo && item.variantId;
      const desc = variant ? [variant.size, variant.color].filter(Boolean).join(", ") : "-";
      const mrp = isCombo ? (item.comboId?.comboPrice || item.price) : (variant?.mrp || item.price);

      totalMrp += mrp * item.quantity;
      itemsTotal += item.price * item.quantity;
      totalQty += item.quantity;

      doc.fillColor(DARK).text(String(i + 1), tC[0].x, y, { width: tC[0].w });
      doc.text(name, tC[1].x, y, { width: tC[1].w });
      doc.fillColor(GREY).text(desc, tC[2].x, y, { width: tC[2].w });
      doc.fillColor(DARK).text(formatCurrency(mrp), tC[3].x, y, { width: tC[3].w });
      doc.text(formatCurrency(item.price), tC[4].x, y, { width: tC[4].w });
      y += 20;
      doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.3).strokeColor("#eee").stroke();
      y += 8;
    }
    y += 5;

    // ── 4. SUMMARY ───────────────────────────────────────────────────────────
    const sX = MARGIN + 250;
    const sW = RIGHT - sX;
    const prodDisc = totalMrp - itemsTotal;
    const couponDisc = order.couponDiscount || 0;
    const saved = prodDisc + couponDisc;
    const subtotal = itemsTotal - couponDisc;
    const fee = order.shippingCharge || 0;
    const cgst = parseFloat(((subtotal * CGST_RATE) / 100).toFixed(2));
    const sgst = parseFloat(((subtotal * SGST_RATE) / 100).toFixed(2));

    const sRows = [
      { l: "Items Total (incl. GST)", v: formatCurrency(itemsTotal), c: DARK },
      { l: "Items Quantity", v: `${totalQty} Items`, c: DARK },
    ];
    if (prodDisc > 0) sRows.push({ l: "Discount", v: formatCurrency(prodDisc), c: RED });
    if (couponDisc > 0) sRows.push({ l: "Coupon Applied", v: formatCurrency(couponDisc), c: RED });
    if (saved > 0) sRows.push({ l: "Saved", v: `-${formatCurrency(saved)}`, c: GREEN });

    for (const r of sRows) {
      doc.font("Helvetica").fontSize(9).fillColor(GREY).text(r.l, sX, y, { width: sW - 5 });
      doc.fillColor(r.c).text(r.v, sX, y, { width: sW - 5, align: "right" });
      y += 16;
    }
    y += 2;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text("Subtotal", sX, y);
    doc.text(formatCurrency(subtotal), sX, y, { width: sW - 5, align: "right" });
    y += 16;
    doc.font("Helvetica").fontSize(9).fillColor(GREY).text("Delivery Fee", sX, y);
    doc.fillColor(DARK).text(formatCurrency(fee), sX, y, { width: sW - 5, align: "right" });
    y += 20;

    doc.moveTo(sX, y).lineTo(RIGHT, y).lineWidth(1).strokeColor(ACCENT).stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(13).fillColor(DARK).text("Grand Total", sX, y);
    doc.text(formatCurrency(order.orderTotal), sX, y, { width: sW - 5, align: "right" });
    y += 30;

    // ── 5. TAX BOX ───────────────────────────────────────────────────────────
    if (y + 80 > 760) { doc.addPage(); y = MARGIN; }
    const tbY = y;
    doc.rect(MARGIN, tbY, CONTENT_WIDTH, 68).lineWidth(1.5).strokeColor(ACCENT).stroke();
    doc.rect(MARGIN, tbY, 80, 18).fill(ACCENT);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#fff").text("Tax Details", MARGIN + 8, tbY + 5);
    let tY = tbY + 25;
    doc.font("Helvetica").fontSize(8);
    doc.fillColor(GREY).text(`CGST (${CGST_RATE}%)`, MARGIN + 12, tY);
    doc.fillColor(DARK).text(formatCurrency(cgst), RIGHT - 100, tY, { width: 90, align: "right" });
    tY += 14;
    doc.fillColor(GREY).text(`SGST (${SGST_RATE}%)`, MARGIN + 12, tY);
    doc.fillColor(DARK).text(formatCurrency(sgst), RIGHT - 100, tY, { width: 90, align: "right" });
    tY += 16;
    doc.font("Helvetica-Bold").fillColor(DARK).text(`GSTIN: ${company.gst || "N/A"}`, MARGIN + 12, tY);
    y = tbY + 80;

    // ── 6. PAID WITH ─────────────────────────────────────────────────────────
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor("#ddd").stroke();
    y += 10;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text(`Paid With: ${order.paymentMethod}`, MARGIN, y);
    y += 20;

    // ── 7. QR + SIGNATORY ────────────────────────────────────────────────────
    if (y + 80 > 760) { doc.addPage(); y = MARGIN; }
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor("#ddd").stroke();
    y += 10;
    try {
      const qd = JSON.stringify({ inv: invoiceNumber, order: String(order._id).slice(-12), total: order.orderTotal });
      const qb = await QRCode.toBuffer(qd, { width: 120 });
      doc.image(qb, MARGIN, y, { width: 65 });
    } catch (e) {}
    if (company.signatory) {
      try {
        const sb = await ObjectStorageService.getBuffer(process.env.LINODE_OBJECT_BUCKET, company.signatory);
        doc.image(sb, RIGHT - 100, y, { width: 65, height: 32 });
      } catch (e) {}
    }
    doc.font("Helvetica").fontSize(7).fillColor(GREY).text("Authorized Signatory", RIGHT - 120, y + 36, { width: 120, align: "center" });
    y += 60;

    // ── 8. TERMS ─────────────────────────────────────────────────────────────
    if (y + 50 > 780) { doc.addPage(); y = MARGIN; }
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor("#ddd").stroke();
    y += 10;
    doc.font("Helvetica").fontSize(7).fillColor(GREY);
    for (const t of TERMS) { doc.text(`• ${t}`, MARGIN, y, { width: CONTENT_WIDTH }); y += 10; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  static _calculateTotals(order) {
    let subtotal = 0, totalDiscount = 0;
    for (const item of order.product) {
      const isCombo = item.itemType === "combo";
      const mrp = isCombo ? (item.comboId?.comboPrice || item.price) : (item.variantId?.mrp || item.price);
      subtotal += item.price * item.quantity;
      totalDiscount += (mrp - item.price) * item.quantity;
    }
    const totalTax = parseFloat(((subtotal * GST_RATE) / 100).toFixed(2));
    return {
      subtotal, totalDiscount, totalTax, grandTotal: order.orderTotal,
    };
  }

  static async updateInvoice(invoiceId, payload) {
    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { $set: payload },
      { new: true }
    );
    if (!invoice) throw new AppError("Invoice not found", 404);
    return invoice;
  }
}
