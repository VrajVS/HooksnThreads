import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../format.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

class _Line {
  _Line({this.handle, required String title, this.image, required int quantity, required int price})
      : title = TextEditingController(text: title),
        quantity = TextEditingController(text: '$quantity'),
        price = TextEditingController(text: '$price');

  final String? handle;
  final String? image;
  final TextEditingController title;
  final TextEditingController quantity;
  final TextEditingController price;

  int get qty => int.tryParse(quantity.text) ?? 0;
  int get unitPrice => int.tryParse(price.text) ?? 0;
}

class _Charge {
  _Charge(String label, int amount)
      : label = TextEditingController(text: label),
        amount = TextEditingController(text: amount == 0 ? '' : '$amount');

  final TextEditingController label;
  final TextEditingController amount;

  int get value => int.tryParse(amount.text.replaceAll(' ', '')) ?? 0;
}

const _chargePresets = [('Wrapping', 1), ('Courier', 1), ('Shipping', 1), ('Discount', -1)];

/// Create (no [orderId]) or edit an order. Pops with the order id once saved.
class OrderFormScreen extends StatefulWidget {
  const OrderFormScreen({super.key, this.orderId});

  final int? orderId;

  @override
  State<OrderFormScreen> createState() => _OrderFormScreenState();
}

class _OrderFormScreenState extends State<OrderFormScreen> {
  bool get _isEdit => widget.orderId != null;

  final _invoice = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _notes = TextEditingController();
  final _paymentAmount = TextEditingController();
  DateTime _orderDate = DateTime.now();
  bool _invoiceTouched = false;
  bool _confirmNow = true;
  String? _plannedMode;
  String _paymentMode = 'online';
  final List<_Line> _lines = [];
  final List<_Charge> _charges = [];

  bool _loading = false;
  Object? _loadError;
  bool _saving = false;
  String? _error;
  bool _nameMissing = false;

  Api get _api => SessionScope.read(context).api;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      _loadOrder();
    } else {
      _nextInvoice();
    }
  }

  Future<void> _loadOrder() async {
    setState(() => _loading = true);
    try {
      final o = OrderDetail.fromJson(await _api.get('/admin/orders/${widget.orderId}') as Map<String, dynamic>);
      _invoice.text = o.invoiceNumber;
      _invoiceTouched = true;
      _orderDate = parseDate(o.orderDate) ?? DateTime.now();
      _name.text = o.customerName;
      _phone.text = o.customerPhone ?? '';
      _email.text = o.customerEmail ?? '';
      _address.text = o.shippingAddress ?? '';
      _notes.text = o.notes ?? '';
      _plannedMode = o.paymentMode;
      _lines.addAll([
        for (final i in o.items)
          _Line(handle: i.handle, title: i.title, image: i.image, quantity: i.quantity, price: i.unitPrice),
      ]);
      _charges.addAll([for (final c in o.charges) _Charge(c.label, c.amount)]);
      _loadError = null;
    } catch (e) {
      _loadError = e;
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _nextInvoice() async {
    if (_isEdit || _invoiceTouched) return;
    try {
      final data = await _api.get('/admin/orders/next-invoice-number', {'on': isoDate(_orderDate)});
      if (mounted && !_invoiceTouched) setState(() => _invoice.text = (data as Map)['invoice_number'] as String);
    } catch (_) {
      // The server numbers the order itself when this is left blank.
    }
  }

  int get _subtotal => _lines.fold(0, (sum, l) => sum + l.qty * l.unitPrice);
  int get _total => _subtotal + _charges.fold(0, (sum, c) => sum + c.value);

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _orderDate,
      firstDate: DateTime(2023),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null) return;
    setState(() => _orderDate = picked);
    _nextInvoice();
  }

  Future<void> _addProduct() async {
    final product = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ProductPicker(api: _api),
    );
    if (product == null) return;
    setState(() {
      final existing = _lines.where((l) => l.handle == product['handle']).firstOrNull;
      if (existing != null) {
        existing.quantity.text = '${existing.qty + 1}';
      } else {
        _lines.add(_Line(
          handle: product['handle'] as String,
          title: product['title'] as String,
          image: product['image'] as String?,
          quantity: 1,
          price: (product['price'] as num).round(),
        ));
      }
    });
  }

  void _addCustom() => setState(() => _lines.add(_Line(title: '', quantity: 1, price: 0)));

  Future<void> _save() async {
    setState(() {
      _error = null;
      _nameMissing = _name.text.trim().isEmpty;
    });
    if (_nameMissing) return setState(() => _error = 'Enter the customer name');
    if (_lines.isEmpty) return setState(() => _error = 'Add at least one item');
    if (_lines.any((l) => l.title.text.trim().isEmpty)) return setState(() => _error = 'Every custom item needs a name');
    if (_lines.any((l) => l.qty < 1)) return setState(() => _error = 'Quantities must be at least 1');
    if (_charges.any((c) => c.label.text.trim().isEmpty)) return setState(() => _error = 'Every charge needs a label');
    final payment = int.tryParse(_paymentAmount.text.trim()) ?? 0;

    String? clean(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();
    Map<String, Object?> body(bool allowShortage) => {
          'invoice_number': clean(_invoice),
          'order_date': isoDate(_orderDate),
          'customer_name': _name.text.trim(),
          'customer_phone': clean(_phone),
          'customer_email': clean(_email),
          'shipping_address': clean(_address),
          'notes': clean(_notes),
          'items': [
            for (final l in _lines)
              {'handle': l.handle, 'title': l.title.text.trim(), 'quantity': l.qty, 'unit_price': l.unitPrice},
          ],
          'charges': [
            for (final c in _charges)
              if (c.value != 0) {'label': c.label.text.trim(), 'amount': c.value},
          ],
          'payment_mode': _plannedMode,
          'allow_shortage': allowShortage,
          if (!_isEdit) 'status': _confirmNow ? 'confirmed' : 'pending',
          if (!_isEdit && payment > 0) 'payment': {'amount': payment, 'mode': _paymentMode, 'paid_on': isoDate(_orderDate)},
        };

    setState(() => _saving = true);
    try {
      Future<dynamic> send(bool allow) =>
          _isEdit ? _api.put('/admin/orders/${widget.orderId}', body(allow)) : _api.post('/admin/orders', body(allow));
      dynamic result;
      try {
        result = await send(false);
      } on ApiException catch (e) {
        if (e.shortages == null || !mounted) rethrow;
        if (!await confirmShortage(context, e.shortages!)) return;
        result = await send(true);
      }
      if (mounted) Navigator.pop(context, (result as Map)['id'] as int);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPickProducts = SessionScope.of(context).can('products.view');
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Edit order' : 'New order')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? ErrorView(error: _loadError!, onRetry: _loadOrder)
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 120),
                  children: [
                    SectionCard(
                      title: 'Invoice',
                      child: Row(children: [
                        Expanded(
                          child: TextField(
                            controller: _invoice,
                            keyboardType: TextInputType.number,
                            onChanged: (_) => _invoiceTouched = true,
                            decoration: const InputDecoration(labelText: 'Invoice number', helperText: 'Filled in automatically'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: InkWell(
                            onTap: _pickDate,
                            child: InputDecorator(
                              decoration: const InputDecoration(labelText: 'Order date', helperText: ' '),
                              child: Text(formatDate(isoDate(_orderDate))),
                            ),
                          ),
                        ),
                      ]),
                    ),
                    const SizedBox(height: 12),
                    SectionCard(
                      title: 'Customer',
                      child: Column(children: [
                        TextField(
                          controller: _name,
                          textCapitalization: TextCapitalization.words,
                          decoration: InputDecoration(labelText: 'Name *', errorText: _nameMissing ? 'Required' : null),
                        ),
                        const SizedBox(height: 10),
                        TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
                        const SizedBox(height: 10),
                        TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
                        const SizedBox(height: 10),
                        TextField(controller: _address, maxLines: 3, minLines: 1, decoration: const InputDecoration(labelText: 'Delivery address')),
                        const SizedBox(height: 10),
                        TextField(controller: _notes, maxLines: 3, minLines: 1, decoration: const InputDecoration(labelText: 'Notes')),
                      ]),
                    ),
                    const SizedBox(height: 12),
                    _itemsCard(canPickProducts),
                    const SizedBox(height: 12),
                    _chargesCard(),
                    const SizedBox(height: 12),
                    _paymentCard(),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: TextStyle(color: Colors.red.shade700, fontWeight: FontWeight.w500)),
                    ],
                  ],
                ),
      bottomNavigationBar: _loading || _loadError != null
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Colors.grey.shade200))),
                child: Row(children: [
                  Expanded(
                    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Total', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                      Text(rupees(_total), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w600, color: navy)),
                    ]),
                  ),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14)),
                    child: _saving
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(_isEdit ? 'Save changes' : 'Create order'),
                  ),
                ]),
              ),
            ),
    );
  }

  Widget _itemsCard(bool canPickProducts) {
    return SectionCard(
      title: 'Items',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_lines.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text('No items yet.', style: TextStyle(color: Colors.grey.shade600)),
          ),
        for (final line in _lines)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                if (imageUrl(line.image) != null) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(imageUrl(line.image)!, width: 40, height: 40, fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const SizedBox(width: 40, height: 40)),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: line.handle != null
                      ? Text(line.title.text, style: const TextStyle(fontWeight: FontWeight.w500))
                      : TextField(
                          controller: line.title,
                          textCapitalization: TextCapitalization.sentences,
                          decoration: const InputDecoration(labelText: 'Custom item name'),
                        ),
                ),
                IconButton(
                  tooltip: 'Remove item',
                  onPressed: () => setState(() => _lines.remove(line)),
                  icon: Icon(Icons.delete_outline, color: Colors.grey.shade600),
                ),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                SizedBox(
                  width: 90,
                  child: TextField(
                    controller: line.quantity,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(labelText: 'Qty'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: line.price,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(labelText: 'Price each', prefixText: '₹ '),
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox(
                  width: 80,
                  child: Text(rupees(line.qty * line.unitPrice), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w500)),
                ),
              ]),
            ]),
          ),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (canPickProducts)
            FilledButton.tonalIcon(onPressed: _addProduct, icon: const Icon(Icons.search), label: const Text('Add product')),
          OutlinedButton.icon(onPressed: _addCustom, icon: const Icon(Icons.add), label: const Text('Custom item')),
        ]),
      ]),
    );
  }

  Widget _chargesCard() {
    return SectionCard(
      title: 'Extra charges',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final charge in _charges)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              Expanded(flex: 3, child: TextField(controller: charge.label, decoration: const InputDecoration(labelText: 'Label'))),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: TextField(
                  controller: charge.amount,
                  keyboardType: const TextInputType.numberWithOptions(signed: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^-?\d*'))],
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(labelText: 'Amount', prefixText: '₹ ', helperText: 'Minus for a discount'),
                ),
              ),
              IconButton(
                tooltip: 'Remove charge',
                onPressed: () => setState(() => _charges.remove(charge)),
                icon: Icon(Icons.delete_outline, color: Colors.grey.shade600),
              ),
            ]),
          ),
        Wrap(spacing: 8, runSpacing: 4, children: [
          for (final (label, sign) in _chargePresets)
            ActionChip(
              avatar: Icon(sign < 0 ? Icons.remove : Icons.add, size: 16),
              label: Text(label),
              onPressed: () => setState(() => _charges.add(_Charge(label, 0)..amount.text = sign < 0 ? '-' : '')),
            ),
        ]),
        const Divider(height: 24),
        Row(children: [
          Expanded(child: Text('Subtotal', style: TextStyle(color: Colors.grey.shade700))),
          Text(rupees(_subtotal)),
        ]),
      ]),
    );
  }

  Widget _paymentCard() {
    return SectionCard(
      title: 'Payment',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        DropdownButtonFormField<String?>(
          initialValue: _plannedMode,
          decoration: const InputDecoration(labelText: 'Agreed mode of payment'),
          items: [
            const DropdownMenuItem(value: null, child: Text('Not decided')),
            for (final e in orderPaymentModes.entries) DropdownMenuItem(value: e.key, child: Text(e.value)),
          ],
          onChanged: (v) => setState(() => _plannedMode = v),
        ),
        if (!_isEdit) ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _paymentAmount,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(labelText: 'Paid now (advance)', prefixText: '₹ '),
              ),
            ),
            const SizedBox(width: 10),
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [ButtonSegment(value: 'online', label: Text('Online')), ButtonSegment(value: 'cash', label: Text('Cash'))],
              selected: {_paymentMode},
              onSelectionChanged: (s) => setState(() => _paymentMode = s.first),
            ),
          ]),
          const SizedBox(height: 6),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _confirmNow,
            onChanged: (v) => setState(() => _confirmNow = v),
            title: const Text('Confirm now'),
            subtitle: const Text('Takes accessory stock straight away'),
          ),
        ] else
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('Record payments from the order page.', style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600)),
          ),
      ]),
    );
  }
}

class _ProductPicker extends StatefulWidget {
  const _ProductPicker({required this.api});

  final Api api;

  @override
  State<_ProductPicker> createState() => _ProductPickerState();
}

class _ProductPickerState extends State<_ProductPicker> {
  final _search = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _results = [];
  bool _loading = false;
  Object? _error;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _fetch() async {
    final request = ++_request;
    setState(() => _loading = true);
    try {
      final data = await widget.api.get('/admin/products', {'page': '1', 'page_size': '30', 'search': _search.text.trim()});
      if (!mounted || request != _request) return;
      setState(() {
        _results = ((data as Map)['items'] as List).cast<Map<String, dynamic>>();
        _error = null;
      });
    } catch (e) {
      if (mounted && request == _request) setState(() => _error = e);
    } finally {
      if (mounted && request == _request) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.85,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: SearchField(
              controller: _search,
              hint: 'Search products',
              onChanged: (_) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 300), _fetch);
              },
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: _error != null
                ? ErrorView(error: _error!, onRetry: _fetch)
                : _results.isEmpty && !_loading
                    ? Center(child: Text('No products found.', style: TextStyle(color: Colors.grey.shade600)))
                    : ListView.builder(
                        itemCount: _results.length,
                        itemBuilder: (context, i) {
                          final p = _results[i];
                          final url = imageUrl(p['image'] as String?);
                          return ListTile(
                            leading: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: url == null
                                  ? const SizedBox(width: 44, height: 44)
                                  : Image.network(url, width: 44, height: 44, fit: BoxFit.cover,
                                      errorBuilder: (_, _, _) => const SizedBox(width: 44, height: 44)),
                            ),
                            title: Text(p['title'] as String),
                            subtitle: Text(rupees(p['price'] as num)),
                            trailing: const Icon(Icons.add_circle_outline),
                            onTap: () => Navigator.pop(context, p),
                          );
                        },
                      ),
          ),
        ]),
      ),
    );
  }
}
