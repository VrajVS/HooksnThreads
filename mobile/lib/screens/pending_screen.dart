import 'package:flutter/material.dart';

import '../api.dart';
import '../format.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'order_detail_screen.dart';

/// Every item still to be made across open orders (the spreadsheet's "Pending orders" sheet).
class PendingScreen extends StatefulWidget {
  const PendingScreen({super.key, required this.revision, required this.visible});

  final ValueNotifier<int> revision;
  final bool visible;

  @override
  State<PendingScreen> createState() => _PendingScreenState();
}

class _PendingScreenState extends State<PendingScreen> {
  final _search = TextEditingController();
  List<Map<String, dynamic>>? _items;
  Object? _error;
  bool _stale = true;
  final Set<int> _busy = {};

  @override
  void initState() {
    super.initState();
    widget.revision.addListener(_markStale);
    if (widget.visible) _load();
  }

  @override
  void didUpdateWidget(PendingScreen old) {
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
      final data = await SessionScope.read(context).api.get('/admin/orders/pending-items') as List;
      if (mounted) setState(() => (_items = data.cast<Map<String, dynamic>>(), _error = null));
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _markPrepared(Map<String, dynamic> item) async {
    final id = item['id'] as int;
    setState(() => _busy.add(id));
    try {
      await SessionScope.read(context).api.patch('/admin/orders/${item['order_id']}/items/$id', {'prepared': true});
      if (!mounted) return;
      setState(() => _items!.remove(item));
      showMessage(context, '${item['title']} marked prepared');
      widget.revision.value++;
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  List<Map<String, dynamic>> get _filtered {
    final term = _search.text.trim().toLowerCase().replaceFirst('#', '');
    if (term.isEmpty) return _items!;
    return _items!.where((i) {
      return [i['title'], i['customer_name'], i['invoice_number'], i['work_note']]
          .any((v) => v != null && (v as String).toLowerCase().contains(term));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final canUpdate = SessionScope.of(context).can('orders.update');
    if (_items == null) {
      return _error != null ? ErrorView(error: _error!, onRetry: _load) : const Center(child: CircularProgressIndicator());
    }
    final items = _filtered;
    final pieces = items.fold<int>(0, (sum, i) => sum + (i['quantity'] as num).toInt());

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
        children: [
          SearchField(controller: _search, hint: 'Item, customer, invoice or note', onChanged: (_) => setState(() {})),
          const SizedBox(height: 10),
          Text(
            '$pieces piece${pieces == 1 ? '' : 's'} to make across ${items.map((i) => i['order_id']).toSet().length} orders',
            style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
          ),
          const SizedBox(height: 10),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 60),
              child: Center(
                child: Text(_search.text.isEmpty ? 'Nothing pending. Every item is made.' : 'No pending items match.',
                    style: TextStyle(color: Colors.grey.shade700)),
              ),
            ),
          for (final item in items) ...[_tile(item, canUpdate), const SizedBox(height: 8)],
        ],
      ),
    );
  }

  Widget _tile(Map<String, dynamic> item, bool canUpdate) {
    final url = imageUrl(item['image'] as String?);
    final note = item['work_note'] as String?;
    final delivery = item['delivery_date'] as String?;
    final overdue = delivery != null && parseDate(delivery)!.isBefore(DateUtils.dateOnly(DateTime.now()));
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () async {
          final changed = await Navigator.push<bool>(
            context,
            MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: item['order_id'] as int)),
          );
          if (changed == true) widget.revision.value++;
        },
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
          child: Row(children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: url == null
                  ? Container(width: 48, height: 48, color: cream, child: Icon(Icons.gesture, color: Colors.grey.shade500))
                  : Image.network(url, width: 48, height: 48, fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const SizedBox(width: 48, height: 48)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${item['title']}${(item['quantity'] as num) > 1 ? ' ×${item['quantity']}' : ''}',
                    style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15)),
                Text('${item['customer_name']} · #${item['invoice_number']}',
                    style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700)),
                if (delivery != null)
                  Text('Deliver by ${formatDate(delivery)}',
                      style: TextStyle(fontSize: 12.5, color: overdue ? Colors.red.shade700 : Colors.grey.shade600,
                          fontWeight: overdue ? FontWeight.w500 : null)),
                if (note != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('“$note”', style: TextStyle(fontSize: 12.5, color: Colors.brown.shade700)),
                  ),
              ]),
            ),
            if (canUpdate)
              _busy.contains(item['id'])
                  ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
                  : IconButton(
                      tooltip: 'Mark prepared',
                      onPressed: () => _markPrepared(item),
                      icon: const Icon(Icons.check_circle_outline, color: sage, size: 28),
                    ),
          ]),
        ),
      ),
    );
  }
}
