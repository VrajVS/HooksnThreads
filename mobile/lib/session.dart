import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';

class Admin {
  Admin.fromJson(Map<String, dynamic> j)
      : id = j['id'] as int,
        name = j['full_name'] as String,
        email = j['email'] as String,
        role = j['role_name'] as String?,
        isSuperAdmin = j['is_system_role'] == true,
        permissions = {...(j['permissions'] as List? ?? []).cast<String>()};

  final int id;
  final String name;
  final String email;
  final String? role;
  final bool isSuperAdmin;
  final Set<String> permissions;

  bool can(String key) => isSuperAdmin || permissions.contains(key);
}

/// The signed-in admin. Same accounts and permissions as the web admin panel.
class Session extends ChangeNotifier {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'admin_token';

  String? _token;
  Admin? admin;
  bool restoring = true;

  late Api api = _makeApi();

  Api _makeApi() => Api(_token, onUnauthorized: _expire);

  bool can(String key) => admin?.can(key) ?? false;

  Future<void> restore() async {
    _token = await _storage.read(key: _tokenKey);
    api = _makeApi();
    if (_token != null) {
      try {
        admin = Admin.fromJson(await api.get('/admin/auth/me') as Map<String, dynamic>);
      } on ApiException catch (e) {
        // Offline at launch: keep the token so the user isn't signed out, the
        // home screen shows the connection error with a retry.
        if (!e.isOffline) await _clear();
        restoreError = e.isOffline ? e.message : null;
      }
    }
    restoring = false;
    notifyListeners();
  }

  String? restoreError;

  Future<void> retryRestore() async {
    restoring = true;
    restoreError = null;
    notifyListeners();
    await restore();
  }

  Future<void> login(String email, String password) async {
    final data = await Api(null, onUnauthorized: () {})
        .post('/admin/auth/token', {'email': email.trim(), 'password': password}) as Map<String, dynamic>;
    _token = data['token'] as String;
    await _storage.write(key: _tokenKey, value: _token);
    admin = Admin.fromJson(data['admin'] as Map<String, dynamic>);
    api = _makeApi();
    notifyListeners();
  }

  Future<void> logout() async {
    await _clear();
    notifyListeners();
  }

  void _expire() {
    if (admin == null) return;
    _clear().then((_) => notifyListeners());
  }

  Future<void> _clear() async {
    _token = null;
    admin = null;
    api = _makeApi();
    await _storage.delete(key: _tokenKey);
  }
}

class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({super.key, required Session session, required super.child}) : super(notifier: session);

  static Session of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;

  static Session read(BuildContext context) =>
      context.getInheritedWidgetOfExactType<SessionScope>()!.notifier!;
}
