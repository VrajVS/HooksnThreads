import 'package:flutter/material.dart';

import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Pieces sold per month and in total (the spreadsheet's "Items sold" sheet).
class ItemsSoldScreen extends StatefulWidget {
  const ItemsSoldScreen({super.key, required this.revision, required this.visible});

  final ValueNotifier<int> revision;
  final bool visible;

  @override
  State<ItemsSoldScreen> createState() => _ItemsSoldScreenState();
}

class _ItemsSoldScreenState extends State<ItemsSoldScreen> {
  final _search = TextEditingController();
  int? _year;
  Map<String, dynamic>? _data;
  Object? _error;
  bool _stale = true;
  bool _byMonth = false;

  @override
  void initState() {
    super.initState();
    widget.revision.addListener(_markStale);
    if (widget.visible) _load();
  }

  @override
  void didUpdateWidget(ItemsSoldScreen old) {
    super.didUpdateWidget(old);
    if (widget.visible && !old.visible && _stale) _load();
  }

  @override
  void dispose() {
    widget.revision.removeListener(_markStale);
    super.dispose();
  }

  void _markStale() {
    _stale = true;
    if (widget.visible) _load();
  }

  Future<void> _load() async {
    _stale = false;
    try {
      final data = await SessionScope.read(context).api.get('/admin/orders/items-sold', {'year': _year?.toString()});
      if (mounted) setState(() => (_data = data as Map<String, dynamic>, _error = null, _year = (data['year'] as num).toInt()));
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  bool _matches(Map row) {
    final term = _search.text.trim().toLowerCase();
    return term.isEmpty || (row['item'] as String).toLowerCase().contains(term);
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    if (data == null) {
      return _error != null ? ErrorView(error: _error!, onRetry: _load) : const Center(child: CircularProgressIndicator());
    }
    final years = (data['years'] as List).map((y) => (y as num).toInt()).toList();
    final totals = (data['totals'] as List).cast<Map<String, dynamic>>().where(_matches).toList();
    final byMonth = (data['by_month'] as List).cast<Map<String, dynamic>>().where(_matches).toList();
    final pieces = totals.fold<num>(0, (s, r) => s + (r['pieces'] as num));
    final revenue = totals.fold<num>(0, (s, r) => s + (r['revenue'] as num));

    final months = <String, List<Map<String, dynamic>>>{};
    for (final row in byMonth) {
      months.putIfAbsent(row['month'] as String, () => []).add(row);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
        children: [
          Row(children: [
            Expanded(child: SearchField(controller: _search, hint: 'Search items', onChanged: (_) => setState(() {}))),
            const SizedBox(width: 8),
            PopupMenuButton<int>(
              tooltip: 'Year',
              onSelected: (y) {
                setState(() => _year = y);
                _load();
              },
              itemBuilder: (_) => [for (final y in years) PopupMenuItem(value: y, child: Text('$y'))],
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Row(children: [
                  Text('$_year', style: const TextStyle(fontWeight: FontWeight.w600, color: navy)),
                  const Icon(Icons.arrow_drop_down, color: navy),
                ]),
              ),
            ),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _stat('Pieces sold', formatQty(pieces))),
            const SizedBox(width: 10),
            Expanded(child: _stat('Revenue from items', rupees(revenue))),
          ]),
          const SizedBox(height: 12),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Whole year')),
              ButtonSegment(value: true, label: Text('By month')),
            ],
            selected: {_byMonth},
            onSelectionChanged: (s) => setState(() => _byMonth = s.first),
          ),
          const SizedBox(height: 12),
          if (totals.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Center(child: Text('No items sold match.', style: TextStyle(color: Colors.grey.shade700))),
            )
          else if (!_byMonth)
            SectionCard(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6), child: Column(children: [
              for (var i = 0; i < totals.length; i++) _row(totals[i], rank: i + 1),
            ]))
          else
            for (final entry in months.entries) ...[
              SectionCard(
                title: formatMonth(entry.key),
                trailing: Text(
                  '${formatQty(entry.value.fold<num>(0, (s, r) => s + (r['pieces'] as num)))} pcs',
                  style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
                ),
                child: Column(children: [for (final row in entry.value) _row(row)]),
              ),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }

  Widget _stat(String label, String value) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 2),
            Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: navy)),
          ]),
        ),
      );

  Widget _row(Map<String, dynamic> row, {int? rank}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(children: [
          if (rank != null)
            SizedBox(width: 28, child: Text('$rank', style: TextStyle(color: Colors.grey.shade500, fontSize: 12.5))),
          Expanded(child: Text(row['item'] as String)),
          Text('${formatQty(row['pieces'] as num)} pcs', style: const TextStyle(fontWeight: FontWeight.w500)),
          const SizedBox(width: 12),
          SizedBox(
            width: 80,
            child: Text(rupees(row['revenue'] as num), textAlign: TextAlign.right, style: TextStyle(color: Colors.grey.shade700)),
          ),
        ]),
      );
}
