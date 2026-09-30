import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'session.dart';
import 'theme.dart';
import 'widgets/common.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('en_IN');
  final session = Session();
  runApp(SessionScope(session: session, child: const OrdersApp()));
  session.restore();
}

class OrdersApp extends StatelessWidget {
  const OrdersApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hooks & Threads',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: const _Gate(),
    );
  }
}

class _Gate extends StatelessWidget {
  const _Gate();

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    if (session.restoring) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (session.admin == null && session.restoreError != null) {
      return Scaffold(
        body: ErrorView(error: session.restoreError!, onRetry: session.retryRestore),
      );
    }
    // A new key per admin drops every screen of the previous session on sign-out.
    return session.admin == null ? const LoginScreen() : HomeScreen(key: ValueKey(session.admin!.id));
  }
}
