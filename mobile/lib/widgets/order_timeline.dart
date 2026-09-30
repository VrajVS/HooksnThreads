import 'package:flutter/material.dart';

import '../format.dart';
import '../models.dart';
import '../theme.dart';
import 'common.dart';

/// When each stage was last entered, from the activity log.
Map<Stage, DateTime> _reachedAt(List<OrderEvent> events) => {
      for (final e in events)
        if (e.kind == 'stage' && Stage.of(e.toValue) != null) Stage.of(e.toValue)!: e.createdAt,
    };

class StageTracker extends StatelessWidget {
  const StageTracker({super.key, required this.stage, required this.events});

  final Stage stage;
  final List<OrderEvent> events;

  @override
  Widget build(BuildContext context) {
    final at = _reachedAt(events);
    if (stage == Stage.cancelled) {
      return SectionCard(
        child: Row(children: [
          Icon(Icons.cancel_outlined, color: Colors.grey.shade500),
          const SizedBox(width: 10),
          const Text('Cancelled', style: TextStyle(fontWeight: FontWeight.w600)),
          if (at[Stage.cancelled] != null)
            Text(' on ${formatDateTime(at[Stage.cancelled]!)}', style: TextStyle(color: Colors.grey.shade600)),
        ]),
      );
    }

    final current = Stage.steps.indexOf(stage);
    return SectionCard(
      padding: const EdgeInsets.fromLTRB(8, 14, 8, 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (var i = 0; i < Stage.steps.length; i++)
          Expanded(child: _step(i, current, at)),
      ]),
    );
  }

  Widget _step(int i, int current, Map<Stage, DateTime> at) {
    final step = Stage.steps[i];
    final done = i < current || stage == Stage.done;
    final active = i == current && stage != Stage.done;
    final skipped = done && at[step] == null && step != Stage.done;
    final caption = active
        ? 'Current'
        : skipped
            ? 'Skipped'
            : at[step] != null
                ? formatDate(isoDate(at[step]!)).replaceFirst(RegExp(r' \d{4}$'), '')
                : '';
    return Column(children: [
      SizedBox(
        height: 28,
        child: Stack(alignment: Alignment.center, children: [
          Row(children: [
            Expanded(child: Container(height: 2, color: i == 0 ? Colors.transparent : (i <= current ? navy : Colors.grey.shade300))),
            Expanded(
              child: Container(
                height: 2,
                color: i == Stage.steps.length - 1 ? Colors.transparent : (i < current ? navy : Colors.grey.shade300),
              ),
            ),
          ]),
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done ? navy : Colors.white,
              border: Border.all(color: done ? navy : (active ? step.color : Colors.grey.shade300), width: 2),
              boxShadow: active ? [BoxShadow(color: step.color.withValues(alpha: 0.25), spreadRadius: 3)] : null,
            ),
            alignment: Alignment.center,
            child: done
                ? const Icon(Icons.check, size: 15, color: Colors.white)
                : active
                    ? Container(width: 10, height: 10, decoration: BoxDecoration(color: step.color, shape: BoxShape.circle))
                    : Text('${i + 1}', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
          ),
        ]),
      ),
      const SizedBox(height: 5),
      Text(step.short,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w500,
            color: active ? Colors.black87 : (done ? Colors.grey.shade800 : Colors.grey.shade500),
          )),
      Text(caption, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade600)),
    ]);
  }
}

class OrderActivity extends StatefulWidget {
  const OrderActivity({super.key, required this.events});

  final List<OrderEvent> events;

  @override
  State<OrderActivity> createState() => _OrderActivityState();
}

class _OrderActivityState extends State<OrderActivity> {
  static const _collapsed = 8;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final newestFirst = widget.events.reversed.toList();
    final shown = _expanded ? newestFirst : newestFirst.take(_collapsed).toList();
    return SectionCard(
      title: 'Activity',
      trailing: Text('${widget.events.length} update${widget.events.length == 1 ? '' : 's'}',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
      child: widget.events.isEmpty
          ? Text('No activity recorded yet.', style: TextStyle(color: Colors.grey.shade600))
          : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var i = 0; i < shown.length; i++) _row(shown[i], last: i == shown.length - 1),
              if (newestFirst.length > _collapsed)
                TextButton(
                  onPressed: () => setState(() => _expanded = !_expanded),
                  child: Text(_expanded ? 'Show less' : 'Show all ${newestFirst.length} updates'),
                ),
            ]),
    );
  }

  Widget _row(OrderEvent e, {required bool last}) {
    final (icon, text) = _describe(e);
    final who = e.adminName ?? const {'customer': 'Customer', 'import': 'Spreadsheet import', 'system': 'System'}[e.actor] ?? e.actor ?? 'Admin';
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        SizedBox(
          width: 28,
          child: Column(children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: e.kind == 'stage' ? Colors.grey.shade100 : navy.withValues(alpha: 0.08),
              ),
              child: Icon(icon, size: 15, color: e.kind == 'stage' ? Colors.grey.shade600 : navy),
            ),
            if (!last) Expanded(child: Container(width: 1, color: Colors.grey.shade300)),
          ]),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(top: 4, bottom: last ? 0 : 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              DefaultTextStyle.merge(style: const TextStyle(fontSize: 14, height: 1.3), child: text),
              const SizedBox(height: 2),
              Text('${formatDateTime(e.createdAt)} · $who', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            ]),
          ),
        ),
      ]),
    );
  }
}

const _bold = TextStyle(fontWeight: FontWeight.w600);

Widget _stageText(OrderEvent e) {
  final from = Stage.of(e.fromValue);
  final to = Stage.of(e.toValue);
  return Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 5, children: [
    if (e.fromValue != null) ...[StageDot(from), Text('${from?.label ?? e.fromValue} →')] else const Text('Stage:'),
    StageDot(to),
    Text(to?.label ?? e.toValue ?? '—', style: _bold),
  ]);
}

(IconData, Widget) _describe(OrderEvent e) {
  switch (e.kind) {
    case 'created':
      return e.actor == 'customer'
          ? (Icons.language, const Text('Order placed on the website'))
          : (Icons.assignment_turned_in_outlined, const Text('Order created'));
    case 'imported':
      return (Icons.table_chart_outlined, const Text('Imported from the order spreadsheet'));
    case 'status':
      return (
        e.toValue == 'cancelled' ? Icons.cancel_outlined : Icons.inventory_2_outlined,
        Text.rich(TextSpan(children: [
          const TextSpan(text: 'Status '),
          if (e.fromValue != null) TextSpan(text: '${statusLabels[e.fromValue] ?? e.fromValue} → '),
          TextSpan(text: statusLabels[e.toValue] ?? e.toValue, style: _bold),
        ])),
      );
    case 'stage':
      return (Icons.radio_button_checked, _stageText(e));
    case 'item_prepared':
      return (Icons.check, Text.rich(TextSpan(children: [const TextSpan(text: 'Marked prepared: '), TextSpan(text: e.detail, style: _bold)])));
    case 'item_unprepared':
      return (Icons.undo, Text.rich(TextSpan(children: [const TextSpan(text: 'Marked not prepared: '), TextSpan(text: e.detail, style: _bold)])));
    case 'work_note':
      return (
        Icons.sticky_note_2_outlined,
        e.toValue != null
            ? Text.rich(TextSpan(children: [
                const TextSpan(text: "What's left for "),
                TextSpan(text: e.detail, style: _bold),
                TextSpan(text: ': “${e.toValue}”'),
              ]))
            : Text.rich(TextSpan(children: [const TextSpan(text: 'Cleared the note on '), TextSpan(text: e.detail, style: _bold)])),
      );
    case 'delivery':
      return (
        Icons.local_shipping_outlined,
        e.toValue == 'delivered'
            ? Text.rich(TextSpan(children: [
                const TextSpan(text: 'Marked '),
                const TextSpan(text: 'delivered', style: _bold),
                if (e.detail != null) TextSpan(text: ' (${formatDate(e.detail)})'),
              ]))
            : const Text('Marked not delivered'),
      );
    case 'delivery_date':
      return (
        Icons.local_shipping_outlined,
        Text('Delivery date ${e.fromValue != null ? '${formatDate(e.fromValue)} → ' : 'set to '}'
            '${e.toValue != null ? formatDate(e.toValue) : 'cleared'}'),
      );
    case 'payment_added':
    case 'payment_removed':
      return (
        Icons.account_balance_wallet_outlined,
        Text.rich(TextSpan(children: [
          TextSpan(text: 'Payment ${e.kind == 'payment_added' ? 'recorded' : 'removed'}: '),
          TextSpan(text: rupees(num.tryParse(e.toValue ?? '') ?? 0), style: _bold),
          if (e.detail != null) TextSpan(text: ' · ${paymentModeLabels[e.detail] ?? e.detail}'),
        ])),
      );
    case 'edited':
      return (Icons.edit_outlined, const Text('Order details edited'));
    default:
      return (Icons.radio_button_checked, Text(e.detail ?? e.kind));
  }
}
