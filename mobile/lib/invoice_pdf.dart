import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'api.dart';
import 'format.dart';
import 'models.dart';

// Same palette as the web invoice (src/pages/admin/order-invoice.tsx).
const _ink = PdfColor.fromInt(0xFF28305B);
const _sage = PdfColor.fromInt(0xFF8AA493);
const _inkTint = PdfColor.fromInt(0xFFEEF0F6);
const _line = PdfColor.fromInt(0xFFE4E4E7);
const _rowLine = PdfColor.fromInt(0xFFECECF0);
const _muted = PdfColor.fromInt(0xFF71717A);
const _faint = PdfColor.fromInt(0xFFA1A1AA);
const _text = PdfColor.fromInt(0xFF27272A);

const _instagram = '@hooksnthreads_official';

/// Builds the order's invoice and opens the Android share sheet (WhatsApp, Drive, email...).
Future<void> shareInvoice(Api api, OrderDetail order) async {
  final settings = BusinessSettings.fromJson(await api.get('/admin/orders/settings') as Map<String, dynamic>);
  final bytes = await buildInvoice(order, settings);
  final client = order.customerName.trim().split(RegExp(r'\s+')).first;
  await Printing.sharePdf(bytes: bytes, filename: 'invoice_${order.invoiceNumber}_${client.isEmpty ? 'client' : client}.pdf');
}

({String label, PdfColor color, PdfColor background}) _paymentStatus(OrderDetail o) {
  if (o.cancelled) return (label: 'CANCELLED', color: const PdfColor.fromInt(0xFF52525B), background: const PdfColor.fromInt(0xFFF4F4F5));
  if (o.total > 0 && o.balance <= 0) return (label: 'PAID', color: const PdfColor.fromInt(0xFF166534), background: const PdfColor.fromInt(0xFFDCFCE7));
  if (o.paid > 0) return (label: 'PARTIALLY PAID', color: const PdfColor.fromInt(0xFF9A3412), background: const PdfColor.fromInt(0xFFFFEDD5));
  return (label: 'PAYMENT DUE', color: const PdfColor.fromInt(0xFF9F1239), background: const PdfColor.fromInt(0xFFFFE4E6));
}

Future<Uint8List> buildInvoice(OrderDetail order, BusinessSettings settings) async {
  // Fetched from Google Fonts and cached by the printing package; the app is online-only anyway.
  final regular = await PdfGoogleFonts.notoSansRegular();
  final medium = await PdfGoogleFonts.notoSansMedium();
  final bold = await PdfGoogleFonts.notoSansSemiBold();
  final italic = await PdfGoogleFonts.notoSansItalic();
  final brand = await PdfGoogleFonts.cinzelSemiBold();
  final brandRegular = await PdfGoogleFonts.cinzelRegular();
  final logo = pw.MemoryImage((await rootBundle.load('assets/logo-invoice.png')).buffer.asUint8List());

  final status = _paymentStatus(order);
  final mode = order.paymentModeLabel;
  final contactLine = [settings.phone, settings.email, _instagram].whereType<String>().join('  ·  ');

  pw.Widget label(String text) => pw.Text(text.toUpperCase(),
      style: pw.TextStyle(font: bold, fontSize: 7.5, letterSpacing: 1.6, color: _sage));

  pw.TextStyle body({pw.Font? font, double size = 9.5, PdfColor color = _text}) =>
      pw.TextStyle(font: font ?? regular, fontSize: size, color: color, lineSpacing: 1.5);

  pw.Widget meta(String k, String v, {bool strong = false}) => pw.Padding(
        padding: const pw.EdgeInsets.only(top: 2),
        child: pw.Row(mainAxisSize: pw.MainAxisSize.min, children: [
          pw.SizedBox(width: 80, child: pw.Text(k, style: body(color: _muted, size: 9))),
          pw.SizedBox(
            width: 80,
            child: pw.Text(v,
                textAlign: pw.TextAlign.right, style: body(font: strong ? bold : medium, size: 9, color: strong ? _ink : _text)),
          ),
        ]),
      );

  pw.Widget totalRow(String k, String v) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
        child: pw.Row(children: [
          pw.Expanded(child: pw.Text(k, style: body(color: _muted))),
          pw.Text(v, style: body()),
        ]),
      );

  pw.Widget cell(String text, {pw.TextAlign align = pw.TextAlign.left, pw.Font? font, PdfColor color = _text}) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        child: pw.Text(text, textAlign: align, style: body(font: font, color: color)),
      );

  pw.Widget headCell(String text, {pw.TextAlign align = pw.TextAlign.left}) => pw.Padding(
        padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        child: pw.Text(text.toUpperCase(),
            textAlign: align, style: pw.TextStyle(font: bold, fontSize: 7.8, letterSpacing: 1.1, color: _ink)),
      );

  final doc = pw.Document(title: 'Invoice ${order.invoiceNumber}', author: settings.businessName);
  doc.addPage(pw.Page(
    pageFormat: PdfPageFormat.a4,
    margin: pw.EdgeInsets.zero,
    build: (context) => pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
      pw.Container(height: 6, color: _ink),
      pw.Expanded(
        child: pw.Padding(
          padding: const pw.EdgeInsets.fromLTRB(45, 34, 45, 34),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
            // Header
            pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Image(logo, height: 74),
              pw.Spacer(),
              pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
                pw.Text('INVOICE', style: pw.TextStyle(font: brand, fontSize: 24, letterSpacing: 6, color: _ink)),
                pw.SizedBox(height: 8),
                meta('Invoice no.', order.invoiceNumber, strong: true),
                meta('Invoice date', formatDate(order.orderDate)),
                if (order.deliveryDate != null) meta(order.delivered ? 'Delivered on' : 'Delivery by', formatDate(order.deliveryDate)),
                if (mode != null) meta('Payment mode', mode),
                pw.SizedBox(height: 8),
                pw.Container(
                  padding: const pw.EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                  decoration: pw.BoxDecoration(color: status.background, borderRadius: pw.BorderRadius.circular(10)),
                  child: pw.Text(status.label, style: pw.TextStyle(font: bold, fontSize: 7.5, letterSpacing: 1.2, color: status.color)),
                ),
              ]),
            ]),

            // Parties
            pw.SizedBox(height: 26),
            pw.Container(height: 0.6, color: _line),
            pw.SizedBox(height: 16),
            pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Expanded(
                child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                  label('From'),
                  pw.SizedBox(height: 5),
                  pw.Text(settings.businessName, style: body(font: bold, size: 11, color: _ink)),
                  if (settings.contactName != null) pw.Text(settings.contactName!, style: body()),
                  if (settings.phone != null) pw.Text(settings.phone!, style: body()),
                  if (settings.email != null) pw.Text(settings.email!, style: body()),
                  if (settings.address != null) pw.Text(settings.address!, style: body(color: _muted)),
                ]),
              ),
              pw.SizedBox(width: 28),
              pw.Expanded(
                child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
                  label('Billed to'),
                  pw.SizedBox(height: 5),
                  pw.Text(order.customerName, textAlign: pw.TextAlign.right, style: body(font: bold, size: 11, color: _ink)),
                  if (order.customerPhone != null) pw.Text(order.customerPhone!, style: body()),
                  if (order.customerEmail != null) pw.Text(order.customerEmail!, style: body()),
                  if (order.shippingAddress != null)
                    pw.Text(order.shippingAddress!, textAlign: pw.TextAlign.right, style: body(color: _muted)),
                ]),
              ),
            ]),

            // Items
            pw.SizedBox(height: 26),
            pw.Table(
              columnWidths: const {
                0: pw.FixedColumnWidth(30),
                1: pw.FlexColumnWidth(),
                2: pw.FixedColumnWidth(44),
                3: pw.FixedColumnWidth(78),
                4: pw.FixedColumnWidth(88),
              },
              children: [
                pw.TableRow(
                  decoration: pw.BoxDecoration(color: _inkTint, borderRadius: pw.BorderRadius.circular(3)),
                  children: [
                    headCell('#'),
                    headCell('Description'),
                    headCell('Qty', align: pw.TextAlign.right),
                    headCell('Rate', align: pw.TextAlign.right),
                    headCell('Amount', align: pw.TextAlign.right),
                  ],
                ),
                for (var i = 0; i < order.items.length; i++)
                  pw.TableRow(
                    decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _rowLine, width: 0.6))),
                    children: [
                      cell((i + 1).toString().padLeft(2, '0'), color: _faint),
                      cell(order.items[i].title, font: medium, color: const PdfColor.fromInt(0xFF18181B)),
                      cell('${order.items[i].quantity}', align: pw.TextAlign.right),
                      cell(rupeesPaise(order.items[i].unitPrice), align: pw.TextAlign.right),
                      cell(rupeesPaise(order.items[i].amount), align: pw.TextAlign.right, font: medium),
                    ],
                  ),
              ],
            ),

            // Words + totals
            pw.SizedBox(height: 16),
            pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Expanded(
                child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                  label('Amount in words'),
                  pw.SizedBox(height: 4),
                  pw.Text('Rupees ${rupeesInWords(order.total).toLowerCase()}',
                      style: body(font: italic, color: const PdfColor.fromInt(0xFF18181B))),
                  if (order.payments.isNotEmpty) ...[
                    pw.SizedBox(height: 16),
                    label('Payments received'),
                    pw.SizedBox(height: 4),
                    for (final p in order.payments)
                      pw.Row(children: [
                        pw.SizedBox(width: 72, child: pw.Text(formatDate(p.paidOn), style: body(size: 8.8, color: _muted))),
                        pw.SizedBox(width: 50, child: pw.Text(paymentModeLabels[p.mode] ?? p.mode, style: body(size: 8.8))),
                        pw.Text(rupeesPaise(p.amount), style: body(size: 8.8)),
                      ]),
                  ],
                ]),
              ),
              pw.SizedBox(width: 28),
              pw.SizedBox(
                width: 210,
                child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.stretch, children: [
                  totalRow('Subtotal', rupeesPaise(order.subtotal)),
                  for (final c in order.charges)
                    totalRow(c.label, c.amount < 0 ? '− ${rupeesPaise(-c.amount)}' : rupeesPaise(c.amount)),
                  pw.SizedBox(height: 5),
                  pw.Container(
                    padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                    decoration: pw.BoxDecoration(color: _ink, borderRadius: pw.BorderRadius.circular(3)),
                    child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
                      pw.Expanded(
                        child: pw.Text('TOTAL', style: pw.TextStyle(font: bold, fontSize: 8.5, letterSpacing: 1.4, color: PdfColors.white)),
                      ),
                      pw.Text(rupeesPaise(order.total), style: pw.TextStyle(font: bold, fontSize: 12.5, color: PdfColors.white)),
                    ]),
                  ),
                  if (order.paid > 0) ...[
                    pw.SizedBox(height: 3),
                    totalRow('Amount received', '− ${rupeesPaise(order.paid)}'),
                    pw.Container(
                      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                      decoration: const pw.BoxDecoration(border: pw.Border(top: pw.BorderSide(color: _line, width: 0.6))),
                      child: pw.Row(children: [
                        pw.Expanded(child: pw.Text(order.balance < 0 ? 'Overpaid' : 'Balance due', style: body(font: bold, color: _ink))),
                        pw.Text(rupeesPaise(order.balance.abs()), style: body(font: bold, color: _ink)),
                      ]),
                    ),
                  ],
                ]),
              ),
            ]),

            // Footer
            pw.Spacer(),
            pw.Center(
              child: pw.Text('Thank you for choosing handmade',
                  style: pw.TextStyle(font: brandRegular, fontSize: 12, letterSpacing: 1.8, color: _ink)),
            ),
            pw.SizedBox(height: 8),
            pw.Center(child: pw.Container(width: 46, height: 0.8, color: _sage)),
            if (settings.invoiceFooter.isNotEmpty) ...[
              pw.SizedBox(height: 8),
              pw.Center(child: pw.Text(settings.invoiceFooter, textAlign: pw.TextAlign.center, style: body(font: italic, size: 8.5, color: _muted))),
            ],
            pw.SizedBox(height: 3),
            pw.Center(child: pw.Text(contactLine, style: body(size: 8.5, color: _muted))),
          ]),
        ),
      ),
      pw.Container(height: 3, color: _sage),
    ]),
  ));
  return doc.save();
}
