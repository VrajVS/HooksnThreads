import 'dart:async';

import 'package:flutter/material.dart';

import '../format.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'order_detail_screen.dart';
import 'order_form_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, required this.revision});

  final ValueNotifier<int> revision;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  static const _pageSize = 30;

  final _search = TextEditingController();
  final _scroll = ScrollController();
  Timer? _debounce;

  Stage? _stage;
  String? _month;
  final List<OrderSummary> _orders = [];
  int _total = 0;
  int _page = 0;
  Map<String, dynamic>? _summary;
  Map<String, int> _stageCounts = {};
  List<String> _months = [];
  bool _loading = false;
  Object? _error;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) _loadMore();
    });
    widget.revision.addListener(_reload);
    _reload();
  }

  @override
  void dispose() {
    widget.revision.removeListener(_reload);
    _debounce?.cancel();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _reload() => _fetch(reset: true);

  void _loadMore() {
    if (!_loading && _error == null && _orders.length < _total) _fetch(reset: false);
  }

  Future<void> _fetch({required bool reset}) async {
    final request = ++_request;
    setState(() {
      _loading = true;
      if (reset) _error = null;
    });
    try {
      final page = reset ? 1 : _page + 1;
      final data = await SessionScope.read(context).api.get('/admin/orders', {
        'page': '$page',
        'page_size': '$_pageSize',
        'search': _search.text.trim(),
        'stage': _stage?.key,
        'month': _month,
      }) as Map<String, dynamic>;
      if (!mounted || request != _request) return;
      setState(() {
        if (reset) _orders.clear();
        _orders.addAll([for (final o in data['items'] as List) OrderSummary.fromJson(o)]);
        _page = page;
        _total = data['total'] as int;
        _summary = data['summary'] as Map<String, dynamic>;
        _stageCounts = (data['stage_counts'] as Map).map((k, v) => MapEntry(k as String, (v as num).toInt()));
        _months = (data['months'] as List).cast<String>();
        _error = null;
      });
    } catch (e) {
      if (mounted && request == _request) setState(() => _error = e);
    } finally {
      if (mounted && request == _request) setState(() => _loading = false);
    }
  }

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _reload);
  }

  Future<void> _open(OrderSummary order) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: order.id)),
    );
    if (changed == true) widget.revision.value++;
  }

  Future<void> _create() async {
    final id = await Navigator.push<int>(context, MaterialPageRoute(builder: (_) => const OrderFormScreen()));
    if (id == null || !mounted) return;
    widget.revision.value++;
    await Navigator.push(context, MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: id)));
    widget.revision.value++;
  }

  @override
  Widget build(BuildContext context) {
    final canCreate = SessionScope.of(context).can('orders.create');
    final allCount = _stageCounts.values.fold(0, (a, b) => a + b);

    return Scaffold(
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(onPressed: _create, icon: const Icon(Icons.add), label: const Text('New order'))
          : null,
      body: RefreshIndicator(
        onRefresh: _reload,
        child: CustomScrollView(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                child: Row(children: [
                  Expanded(
                    child: SearchField(
                      controller: _search,
                      hint: 'Invoice, customer, phone or item',
                      onChanged: _onSearch,
                    ),
                  ),
                  const SizedBox(width: 8),
                  _MonthButton(
                    months: _months,
                    value: _month,
                    onChanged: (m) {
                      setState(() => _month = m);
                      _reload();
                    },
                  ),
                ]),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 50,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                  children: [
                    _chip(null, 'All', allCount),
                    for (final s in Stage.values) _chip(s, s.label, _stageCounts[s.key] ?? 0),
                  ],
                ),
              ),
            ),
            if (_summary != null)
              SliverToBoxAdapter(
                child: Padding(padding: const EdgeInsets.fromLTRB(16, 6, 16, 8), child: _SummaryBar(_summary!, month: _month)),
              ),
            if (_error != null && _orders.isEmpty)
              SliverFillRemaining(hasScrollBody: false, child: ErrorView(error: _error!, onRetry: _reload))
            else if (_orders.isEmpty && _loading)
              const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator()))
            else if (_orders.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Text(
                    _search.text.isNotEmpty || _stage != null || _month != null ? 'No orders match these filters.' : 'No orders yet.',
                    style: TextStyle(color: Colors.grey.shade700),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
                sliver: SliverList.separated(
                  itemCount: _orders.length + 1,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    if (i < _orders.length) return _OrderTile(_orders[i], onTap: () => _open(_orders[i]));
                    if (_error != null) {
                      return TextButton.icon(onPressed: _loadMore, icon: const Icon(Icons.refresh), label: Text('$_error'));
                    }
                    return _orders.length < _total
                        ? const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
                        : Padding(
                            padding: const EdgeInsets.all(12),
                            child: Text('$_total order${_total == 1 ? '' : 's'}',
                                textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5)),
                          );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _chip(Stage? stage, String label, int count) {
    final selected = _stage == stage;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        selected: selected,
        showCheckmark: false,
        avatar: stage == null ? null : StageDot(stage, size: 9),
        label: Text('$label  $count'),
        onSelected: (_) {
          setState(() => _stage = stage);
          _reload();
        },
      ),
    );
  }
}

class _MonthButton extends StatelessWidget {
  const _MonthButton({required this.months, required this.value, required this.onChanged});

  final List<String> months;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'Filter by month',
      onSelected: (m) => onChanged(m.isEmpty ? null : m),
      itemBuilder: (_) => [
        const PopupMenuItem(value: '', child: Text('All months')),
        for (final m in months) PopupMenuItem(value: m, child: Text(formatMonth(m))),
      ],
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: value == null ? Colors.white : navy,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: value == null ? Colors.grey.shade300 : navy),
        ),
        child: Row(children: [
          Icon(Icons.calendar_month_outlined, size: 20, color: value == null ? navy : Colors.white),
          if (value != null) ...[
            const SizedBox(width: 6),
            Text(formatMonth(value!).replaceFirst(RegExp(r'(\w{3})\w* '), r'$1 '),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500)),
          ],
        ]),
      ),
    );
  }
}

class _SummaryBar extends StatelessWidget {
  const _SummaryBar(this.summary, {this.month});

  final Map<String, dynamic> summary;
  final String? month;

  @override
  Widget build(BuildContext context) {
    Widget cell(String label, num value, {Color? color}) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600, letterSpacing: .3)),
            const SizedBox(height: 2),
            Text(rupees(value), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: color ?? navy)),
          ]),
        );
    final outstanding = summary['outstanding'] as num;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Orders', style: TextStyle(fontSize: 11, color: Colors.grey.shade600, letterSpacing: .3)),
              const SizedBox(height: 2),
              Text('${summary['orders']}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: navy)),
            ]),
          ),
          cell('Total', summary['total'] as num),
          cell('Received', summary['received'] as num),
          cell('Outstanding', outstanding, color: outstanding > 0 ? Colors.red.shade700 : null),
        ]),
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile(this.order, {required this.onTap});

  final OrderSummary order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final balance = order.total - order.paid;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('#${order.invoiceNumber}', style: const TextStyle(fontWeight: FontWeight.w600, color: navy)),
              const SizedBox(width: 8),
              Text(formatDate(order.orderDate), style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600)),
              if (order.source == 'storefront') ...[
                const SizedBox(width: 6),
                Tooltip(message: 'Placed on the website', child: Icon(Icons.language, size: 15, color: Colors.grey.shade600)),
              ],
              const Spacer(),
              Text(rupees(order.total), style: const TextStyle(fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 4),
            Text(order.customerName, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w500)),
            if (order.itemsSummary.isNotEmpty)
              Text(order.itemsSummary, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.grey.shade700, fontSize: 13)),
            const SizedBox(height: 8),
            Row(children: [
              StageBadge(order.stage),
              const Spacer(),
              if (order.status != 'cancelled' && order.lineCount > 0)
                Text('${order.preparedCount}/${order.lineCount} made', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              if (order.status != 'cancelled' && balance > 0) ...[
                const SizedBox(width: 10),
                Text('${rupees(balance)} due', style: TextStyle(fontSize: 12, color: Colors.red.shade700, fontWeight: FontWeight.w500)),
              ],
            ]),
          ]),
        ),
      ),
    );
  }
}
