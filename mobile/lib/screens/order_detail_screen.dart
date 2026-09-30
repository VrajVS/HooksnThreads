import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../format.dart';
import '../invoice_pdf.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/order_timeline.dart';
import 'order_form_screen.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final int orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  OrderDetail? _order;
  Object? _error;
  String? _busy;
  bool _sharing = false;

  /// Tells the list to reload when we go back.
  bool _changed = false;

  Api get _api => SessionScope.read(context).api;
  String get _path => '/admin/orders/${widget.orderId}';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final order = OrderDetail.fromJson(await _api.get(_path) as Map<String, dynamic>);
      if (mounted) setState(() => (_order = order, _error = null));
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  /// Runs a change, then reloads. Errors become a message; the order is reloaded either way.
  Future<void> _run(String busy, Future<void> Function() action, {String? success}) async {
    setState(() => _busy = busy);
    try {
      await action();
      _changed = true;
      if (success != null && mounted) showMessage(context, success);
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    } finally {
      await _load();
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _setStatus(String status) async {
    if (status == 'cancelled' &&
        !await confirmDialog(
          context,
          title: 'Cancel this order?',
          message: _order!.stockDeducted
              ? 'Accessory stock taken by this order will be put back.'
              : 'The order will be marked cancelled.',
          action: 'Cancel order',
          destructive: true,
        )) {
      return;
    }
    Future<void> send(bool allowShortage) => _api.post('$_path/status', {'status': status, 'allow_shortage': allowShortage});
    await _run(status, () async {
      try {
        await send(false);
      } on ApiException catch (e) {
        if (e.shortages == null || !mounted) rethrow;
        if (!await confirmShortage(context, e.shortages!)) return;
        await send(true);
      }
    }, success: 'Order ${statusLabels[status]!.toLowerCase()}');
  }

  Future<void> _patchItem(OrderItem item, Map<String, Object?> patch) async {
    setState(() {
      if (patch['prepared'] is bool) item.prepared = patch['prepared'] as bool;
    });
    await _run('item-${item.id}', () => _api.patch('$_path/items/${item.id}', patch));
  }

  Future<void> _editNote(OrderItem item) async {
    final controller = TextEditingController(text: item.workNote ?? '');
    final note = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("What's left to do"),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          decoration: InputDecoration(hintText: 'e.g. petals done, stem left', helperText: item.title),
        ),
        actions: [
          if ((item.workNote ?? '').isNotEmpty)
            TextButton(onPressed: () => Navigator.pop(context, ''), child: const Text('Clear')),
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Save')),
        ],
      ),
    );
    if (note == null || note.trim() == (item.workNote ?? '')) return;
    await _patchItem(item, {'work_note': note.trim()});
  }

  Future<void> _addPayment() async {
    final order = _order!;
    final added = await showModalBottomSheet<Map<String, Object?>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PaymentSheet(suggested: order.balance > 0 ? order.balance : null),
    );
    if (added == null) return;
    await _run('payment', () => _api.post('$_path/payments', added), success: 'Payment recorded');
  }

  Future<void> _removePayment(Payment p) async {
    if (!await confirmDialog(
      context,
      title: 'Remove this payment?',
      message: '${rupees(p.amount)} ${paymentModeLabels[p.mode]} on ${formatDate(p.paidOn)}',
      action: 'Remove',
      destructive: true,
    )) {
      return;
    }
    await _run('payment', () => _api.delete('$_path/payments/${p.id}'), success: 'Payment removed');
  }

  Future<void> _setDelivery(bool delivered, String? date) =>
      _run('delivery', () => _api.patch('$_path/delivery', {'delivered': delivered, 'delivery_date': date}));

  Future<void> _pickDeliveryDate() async {
    final order = _order!;
    final picked = await showDatePicker(
      context: context,
      initialDate: parseDate(order.deliveryDate) ?? DateTime.now(),
      firstDate: DateTime(2023),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (picked != null) await _setDelivery(order.delivered, isoDate(picked));
  }

  Future<void> _edit() async {
    final saved = await Navigator.push<int>(
      context,
      MaterialPageRoute(builder: (_) => OrderFormScreen(orderId: widget.orderId)),
    );
    if (saved != null) {
      _changed = true;
      await _load();
      if (mounted) showMessage(context, 'Order saved');
    }
  }

  Future<void> _delete() async {
    if (!await confirmDialog(
      context,
      title: 'Delete this order?',
      message: 'Invoice #${_order!.invoiceNumber} will be removed for good. This cannot be undone.',
      action: 'Delete',
      destructive: true,
    )) {
      return;
    }
    try {
      await _api.delete(_path);
      if (!mounted) return;
      showMessage(context, 'Order deleted');
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    }
  }

  Future<void> _shareInvoice() async {
    setState(() => _sharing = true);
    try {
      await shareInvoice(_api, _order!);
    } on ApiException catch (e) {
      if (mounted) showMessage(context, e.message, error: true);
    } catch (e) {
      if (mounted) showMessage(context, 'Could not create the invoice: $e', error: true);
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final order = _order;
    final canUpdate = session.can('orders.update');
    final canDelete = session.can('orders.delete');

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _changed);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(order == null ? 'Order' : '#${order.invoiceNumber}'),
          actions: [
            if (order != null) ...[
              IconButton(
                tooltip: 'Share invoice PDF',
                onPressed: _sharing ? null : _shareInvoice,
                icon: _sharing
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.picture_as_pdf_outlined),
              ),
              if (canUpdate && !order.cancelled) IconButton(tooltip: 'Edit order', onPressed: _edit, icon: const Icon(Icons.edit_outlined)),
              if (canDelete && !order.stockDeducted)
                PopupMenuButton<String>(
                  onSelected: (_) => _delete(),
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'delete', child: ListTile(leading: Icon(Icons.delete_outline), title: Text('Delete order'))),
                  ],
                ),
            ],
          ],
        ),
        body: order == null
            ? (_error != null ? ErrorView(error: _error!, onRetry: _load) : const Center(child: CircularProgressIndicator()))
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
                  children: [
                    _header(order, canUpdate),
                    const SizedBox(height: 12),
                    StageTracker(stage: order.stage, events: order.events),
                    const SizedBox(height: 12),
                    _customer(order),
                    const SizedBox(height: 12),
                    _items(order, canUpdate && !order.cancelled),
                    const SizedBox(height: 12),
                    _payments(order, canUpdate && !order.cancelled),
                    const SizedBox(height: 12),
                    if (!order.cancelled) ...[_delivery(order, canUpdate), const SizedBox(height: 12)],
                    if (!order.stockDeducted && order.requirements.isNotEmpty && !order.cancelled) ...[
                      _requirements(order),
                      const SizedBox(height: 12),
                    ],
                    OrderActivity(events: order.events),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _header(OrderDetail order, bool canUpdate) {
    Widget action(String status, String label, IconData icon, {bool outlined = false}) {
      final busy = _busy == status;
      final child = busy
          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
          : Icon(icon, size: 18);
      return outlined
          ? OutlinedButton.icon(onPressed: _busy == null ? () => _setStatus(status) : null, icon: child, label: Text(label))
          : FilledButton.icon(onPressed: _busy == null ? () => _setStatus(status) : null, icon: child, label: Text(label));
    }

    return SectionCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text(order.customerName, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w600, color: navy)),
          ),
          Text(rupees(order.total), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w600)),
        ]),
        const SizedBox(height: 4),
        Text(
          [
            formatDate(order.orderDate),
            statusLabels[order.status] ?? order.status,
            order.source == 'storefront' ? 'Website order' : 'Entered by ${order.createdBy ?? 'admin'}',
          ].join(' · '),
          style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
        ),
        const SizedBox(height: 8),
        StageBadge(order.stage),
        if (canUpdate && !order.cancelled) ...[
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: [
            if (order.status == 'pending') action('confirmed', 'Confirm order', Icons.check_circle_outline),
            if (order.status == 'confirmed') action('completed', 'Mark completed', Icons.inventory_2_outlined),
            action('cancelled', 'Cancel order', Icons.cancel_outlined, outlined: true),
          ]),
        ],
      ]),
    );
  }

  Widget _customer(OrderDetail order) {
    Widget row(IconData icon, String text, {bool copy = false}) => InkWell(
          onLongPress: copy
              ? () {
                  Clipboard.setData(ClipboardData(text: text));
                  showMessage(context, 'Copied');
                }
              : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, size: 18, color: Colors.grey.shade600),
              const SizedBox(width: 10),
              Expanded(child: Text(text, style: const TextStyle(fontSize: 14.5))),
            ]),
          ),
        );
    final hasAny = [order.customerPhone, order.customerEmail, order.shippingAddress, order.notes].any((v) => v != null && v.isNotEmpty);
    return SectionCard(
      title: 'Customer',
      child: !hasAny
          ? Text('No contact details.', style: TextStyle(color: Colors.grey.shade600))
          : Column(children: [
              if (order.customerPhone != null) row(Icons.phone_outlined, order.customerPhone!, copy: true),
              if (order.customerEmail != null) row(Icons.mail_outline, order.customerEmail!, copy: true),
              if (order.shippingAddress != null) row(Icons.location_on_outlined, order.shippingAddress!, copy: true),
              if (order.notes != null) row(Icons.notes, order.notes!),
            ]),
    );
  }

  Widget _items(OrderDetail order, bool editable) {
    final prepared = order.items.where((i) => i.prepared).length;
    return SectionCard(
      title: 'Items',
      trailing: Text('$prepared of ${order.items.length} prepared', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
      padding: const EdgeInsets.fromLTRB(8, 16, 16, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final item in order.items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Checkbox(
                value: item.prepared,
                onChanged: editable && _busy == null ? (v) => _patchItem(item, {'prepared': v ?? false}) : null,
              ),
              if (imageUrl(item.image) != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(imageUrl(item.image)!, width: 44, height: 44, fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => const SizedBox(width: 44, height: 44)),
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const SizedBox(height: 4),
                  Text(item.title,
                      style: TextStyle(
                        fontWeight: FontWeight.w500,
                        decoration: item.prepared ? TextDecoration.lineThrough : null,
                        color: item.prepared ? Colors.grey.shade600 : null,
                      )),
                  Text('${item.quantity} × ${rupees(item.unitPrice)}${item.handle == null ? ' · custom' : ''}',
                      style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600)),
                  if (!item.prepared && (editable || (item.workNote ?? '').isNotEmpty))
                    InkWell(
                      onTap: editable ? () => _editNote(item) : null,
                      child: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(children: [
                          Icon(Icons.sticky_note_2_outlined, size: 15, color: (item.workNote ?? '').isEmpty ? Colors.grey.shade500 : gold),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              (item.workNote ?? '').isEmpty ? "Add what's left to do" : item.workNote!,
                              style: TextStyle(
                                fontSize: 13,
                                color: (item.workNote ?? '').isEmpty ? Colors.grey.shade500 : Colors.brown.shade700,
                                fontStyle: (item.workNote ?? '').isEmpty ? FontStyle.italic : null,
                              ),
                            ),
                          ),
                        ]),
                      ),
                    ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(rupees(item.amount), style: const TextStyle(fontWeight: FontWeight.w500)),
              ),
            ]),
          ),
        const Divider(height: 12),
        Padding(
          padding: const EdgeInsets.only(left: 8),
          child: Column(children: [
            _moneyRow('Subtotal', order.subtotal),
            for (final c in order.charges) _moneyRow(c.label, c.amount),
            _moneyRow('Total', order.total, bold: true),
          ]),
        ),
      ]),
    );
  }

  Widget _moneyRow(String label, int amount, {bool bold = false, Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(label, style: TextStyle(color: bold ? null : Colors.grey.shade700, fontWeight: bold ? FontWeight.w600 : null))),
          Text(amount < 0 ? '− ${rupees(-amount)}' : rupees(amount),
              style: TextStyle(fontWeight: bold ? FontWeight.w600 : FontWeight.w500, color: color)),
        ]),
      );

  Widget _payments(OrderDetail order, bool editable) {
    return SectionCard(
      title: 'Payments',
      trailing: editable
          ? TextButton.icon(
              onPressed: _busy == null ? _addPayment : null,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Record'),
            )
          : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (order.payments.isEmpty)
          Text(
            order.paymentModeLabel == null ? 'No payments yet.' : 'No payments yet · agreed mode: ${order.paymentModeLabel}',
            style: TextStyle(color: Colors.grey.shade600),
          ),
        for (final p in order.payments)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(children: [
              Icon(p.mode == 'cash' ? Icons.payments_outlined : Icons.phone_android, size: 18, color: Colors.grey.shade600),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${paymentModeLabels[p.mode]} · ${formatDate(p.paidOn)}'),
                  if (p.note != null) Text(p.note!, style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600)),
                ]),
              ),
              Text(rupees(p.amount), style: const TextStyle(fontWeight: FontWeight.w500)),
              if (editable)
                IconButton(
                  tooltip: 'Remove payment',
                  visualDensity: VisualDensity.compact,
                  onPressed: _busy == null ? () => _removePayment(p) : null,
                  icon: Icon(Icons.close, size: 18, color: Colors.grey.shade600),
                ),
            ]),
          ),
        const Divider(height: 16),
        _moneyRow('Received', order.paid),
        _moneyRow(order.balance < 0 ? 'Overpaid' : 'Balance due', order.balance.abs(),
            bold: true, color: order.balance > 0 ? Colors.red.shade700 : Colors.green.shade700),
      ]),
    );
  }

  Widget _delivery(OrderDetail order, bool canUpdate) {
    return SectionCard(
      title: 'Delivery',
      child: Column(children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Delivered'),
          value: order.delivered,
          onChanged: canUpdate && _busy == null
              ? (v) => _setDelivery(v, v ? (order.deliveryDate ?? isoDate(DateTime.now())) : order.deliveryDate)
              : null,
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.event_outlined),
          title: Text(order.delivered ? 'Delivered on' : 'Delivery by'),
          subtitle: Text(order.deliveryDate == null ? 'No date set' : formatDate(order.deliveryDate)),
          trailing: canUpdate && order.deliveryDate != null
              ? IconButton(
                  tooltip: 'Clear date',
                  onPressed: _busy == null ? () => _setDelivery(order.delivered, null) : null,
                  icon: const Icon(Icons.close),
                )
              : null,
          onTap: canUpdate && _busy == null ? _pickDeliveryDate : null,
        ),
      ]),
    );
  }

  Widget _requirements(OrderDetail order) {
    return SectionCard(
      title: 'Accessories needed to confirm',
      child: Column(children: [
        for (final r in order.requirements)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(children: [
              Expanded(child: Text(r.name)),
              Text('${formatQty(r.required)} ${r.unit}', style: TextStyle(color: Colors.grey.shade700)),
              const SizedBox(width: 12),
              SizedBox(
                width: 90,
                child: Text(
                  r.shortage > 0 ? 'short ${formatQty(r.shortage)}' : '${formatQty(r.stock)} in stock',
                  textAlign: TextAlign.right,
                  style: TextStyle(fontSize: 12.5, color: r.shortage > 0 ? Colors.red.shade700 : Colors.grey.shade600),
                ),
              ),
            ]),
          ),
      ]),
    );
  }
}

class _PaymentSheet extends StatefulWidget {
  const _PaymentSheet({this.suggested});

  final int? suggested;

  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  late final _amount = TextEditingController(text: widget.suggested?.toString() ?? '');
  final _note = TextEditingController();
  String _mode = 'online';
  DateTime _paidOn = DateTime.now();
  String? _error;

  void _save() {
    final amount = int.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter an amount above zero');
      return;
    }
    Navigator.pop(context, {
      'amount': amount,
      'mode': _mode,
      'paid_on': isoDate(_paidOn),
      'note': _note.text.trim().isEmpty ? null : _note.text.trim(),
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Record payment', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        TextField(
          controller: _amount,
          autofocus: true,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(labelText: 'Amount', prefixText: '₹ ', errorText: _error),
        ),
        const SizedBox(height: 12),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'online', label: Text('Online'), icon: Icon(Icons.phone_android)),
            ButtonSegment(value: 'cash', label: Text('Cash'), icon: Icon(Icons.payments_outlined)),
          ],
          selected: {_mode},
          onSelectionChanged: (s) => setState(() => _mode = s.first),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: _paidOn,
              firstDate: DateTime(2023),
              lastDate: DateTime.now(),
            );
            if (picked != null) setState(() => _paidOn = picked);
          },
          icon: const Icon(Icons.event_outlined),
          label: Text('Paid on ${formatDate(isoDate(_paidOn))}'),
        ),
        const SizedBox(height: 12),
        TextField(controller: _note, decoration: const InputDecoration(labelText: 'Note (optional)')),
        const SizedBox(height: 18),
        FilledButton(onPressed: _save, child: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Save payment'))),
      ]),
    );
  }
}
