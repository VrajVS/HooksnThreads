import 'package:intl/intl.dart';

final _rupees = NumberFormat.decimalPattern('en_IN');
final _rupeesPaise = NumberFormat('#,##,##0.00', 'en_IN');
final _date = DateFormat('d MMM yyyy');
final _dateTime = DateFormat('d MMM yyyy, h:mm a');
final _month = DateFormat('MMMM yyyy');

String rupees(num amount) => '₹${_rupees.format(amount)}';

String rupeesPaise(num amount) => '₹${_rupeesPaise.format(amount)}';

DateTime? parseDate(String? iso) => iso == null || iso.isEmpty ? null : DateTime.parse(iso.substring(0, 10));

String formatDate(String? iso) {
  final d = parseDate(iso);
  return d == null ? '—' : _date.format(d);
}

String formatDateTime(DateTime d) => _dateTime.format(d);

/// "2026-09" -> "September 2026"
String formatMonth(String yyyyMm) => _month.format(DateTime.parse('$yyyyMm-01'));

String isoDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

String formatQty(num n) => n == n.roundToDouble() ? n.round().toString() : n.toStringAsFixed(2);

const _ones = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', //
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const _tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

String _belowHundred(int n) => n < 20 ? _ones[n] : _tens[n ~/ 10] + (n % 10 != 0 ? ' ${_ones[n % 10]}' : '');

String _belowThousand(int n) {
  final hundreds = n ~/ 100;
  final rest = n % 100;
  return [if (hundreds > 0) '${_ones[hundreds]} hundred', if (rest > 0) _belowHundred(rest)].join(' ');
}

/// Indian numbering (lakh, crore): 490 -> "Four hundred ninety only". Same as the web invoice.
String rupeesInWords(num amount) {
  final n = amount.abs().round();
  if (n == 0) return 'Zero only';
  final crore = n ~/ 10000000;
  final lakh = (n % 10000000) ~/ 100000;
  final thousand = (n % 100000) ~/ 1000;
  final rest = n % 1000;
  final words = [
    if (crore > 0)
      '${crore > 999 ? rupeesInWords(crore).replaceFirst(RegExp(r' only$'), '').toLowerCase() : _belowThousand(crore)} crore',
    if (lakh > 0) '${_belowHundred(lakh)} lakh',
    if (thousand > 0) '${_belowHundred(thousand)} thousand',
    if (rest > 0) _belowThousand(rest),
  ].join(' ');
  return '${words[0].toUpperCase()}${words.substring(1)} only';
}
