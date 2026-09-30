import 'package:flutter/material.dart';

import '../session.dart';
import '../widgets/common.dart';
import 'items_sold_screen.dart';
import 'orders_screen.dart';
import 'pending_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  // Bumped whenever an order changes, so the other tabs reload next time they show.
  final _revision = ValueNotifier(0);

  static const _titles = ['Orders', 'Pending work', 'Items sold'];

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final admin = session.admin!;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tab]),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Account',
            icon: CircleAvatar(
              radius: 15,
              backgroundColor: Colors.white24,
              child: Text(admin.name.isEmpty ? '?' : admin.name[0].toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontSize: 14)),
            ),
            itemBuilder: (context) => [
              PopupMenuItem(
                enabled: false,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(admin.name, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.black87)),
                  Text(admin.email, style: const TextStyle(fontSize: 12)),
                  if (admin.role != null) Text(admin.role!, style: const TextStyle(fontSize: 12)),
                ]),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'logout', child: ListTile(leading: Icon(Icons.logout), title: Text('Sign out'))),
            ],
            onSelected: (value) async {
              if (value == 'logout' &&
                  await confirmDialog(context, title: 'Sign out?', message: 'You will need your password to sign in again.', action: 'Sign out')) {
                await session.logout();
              }
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: !session.can('orders.view')
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text('Your role does not include viewing orders. Ask a Super Admin to give you the orders permission.',
                    textAlign: TextAlign.center),
              ),
            )
          : IndexedStack(index: _tab, children: [
              OrdersScreen(revision: _revision),
              PendingScreen(revision: _revision, visible: _tab == 1),
              ItemsSoldScreen(revision: _revision, visible: _tab == 2),
            ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.pending_actions_outlined), selectedIcon: Icon(Icons.pending_actions), label: 'Pending work'),
          NavigationDestination(icon: Icon(Icons.bar_chart_outlined), selectedIcon: Icon(Icons.bar_chart), label: 'Items sold'),
        ],
      ),
    );
  }
}
