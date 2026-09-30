import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';

class StageBadge extends StatelessWidget {
  const StageBadge(this.stage, {super.key});

  final Stage stage;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: stage.color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        StageDot(stage),
        const SizedBox(width: 5),
        Text(stage.label, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

class StageDot extends StatelessWidget {
  const StageDot(this.stage, {super.key, this.size = 8});

  final Stage? stage;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: stage?.color ?? Colors.grey.shade300, shape: BoxShape.circle),
      );
}

/// A failed load. The app needs the server, so offline is shown like any other error, with a retry.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final offline = error is ApiException && (error as ApiException).isOffline;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(offline ? Icons.wifi_off_rounded : Icons.error_outline_rounded, size: 44, color: navy.withValues(alpha: 0.6)),
          const SizedBox(height: 12),
          Text(offline ? 'You are offline' : 'Could not load', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text('$error', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade700)),
          const SizedBox(height: 16),
          FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Try again')),
        ]),
      ),
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, this.title, this.trailing, required this.child, this.padding = const EdgeInsets.all(16)});

  final String? title;
  final Widget? trailing;
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: padding,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(children: [
                Expanded(child: Text(title!, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600))),
                ?trailing,
              ]),
            ),
          child,
        ]),
      ),
    );
  }
}

class SearchField extends StatelessWidget {
  const SearchField({super.key, required this.controller, required this.hint, required this.onChanged});

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
      valueListenable: controller,
      builder: (context, value, _) => TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: hint,
          prefixIcon: const Icon(Icons.search),
          suffixIcon: value.text.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(Icons.close),
                  tooltip: 'Clear search',
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                ),
        ),
      ),
    );
  }
}

void showMessage(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? Colors.red.shade700 : null,
    ));
}

Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String action,
  bool destructive = false,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep')),
        FilledButton(
          style: destructive ? FilledButton.styleFrom(backgroundColor: Colors.red.shade700) : null,
          onPressed: () => Navigator.pop(context, true),
          child: Text(action),
        ),
      ],
    ),
  );
  return ok ?? false;
}

/// 409 from the server: confirming needs more accessory stock than is on hand.
Future<bool> confirmShortage(BuildContext context, List<Map<String, dynamic>> shortages) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Not enough accessory stock'),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Confirming takes more stock than is on hand:'),
        const SizedBox(height: 10),
        for (final s in shortages)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text('• ${s['name']}: need ${_q(s['required'])} ${s['unit']}, have ${_q(s['stock'])}',
                style: const TextStyle(fontSize: 13.5)),
          ),
        const SizedBox(height: 8),
        const Text('Confirm anyway? Stock will go negative.', style: TextStyle(fontSize: 13.5)),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Go back')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Confirm anyway')),
      ],
    ),
  );
  return ok ?? false;
}

String _q(dynamic n) {
  final v = n as num;
  return v == v.roundToDouble() ? v.round().toString() : v.toStringAsFixed(2);
}
