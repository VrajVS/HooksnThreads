import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

/// The live site. Override for a local server with
/// `flutter run --dart-define=API_BASE=http://10.0.2.2:4000`.
const apiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://hooksnthreads.92.4.84.246.sslip.io',
);

/// Product images are stored as site-relative paths.
String? imageUrl(String? path) {
  if (path == null || path.isEmpty) return null;
  return path.startsWith('http') ? path : '$apiBase$path';
}

class ApiException implements Exception {
  ApiException(this.message, {this.status, this.shortages});

  final String message;
  final int? status;

  /// Set on a 409 when confirming would take more accessory stock than there is.
  final List<Map<String, dynamic>>? shortages;

  bool get isOffline => status == null;

  @override
  String toString() => message;
}

class Api {
  Api(this.token, {required this.onUnauthorized});

  final String? token;
  final void Function() onUnauthorized;
  final _client = http.Client();

  static const _timeout = Duration(seconds: 20);

  Future<dynamic> get(String path, [Map<String, String?>? query]) =>
      _send('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body);
  Future<dynamic> put(String path, Object body) => _send('PUT', path, body: body);
  Future<dynamic> patch(String path, Object body) => _send('PATCH', path, body: body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, {Map<String, String?>? query, Object? body}) async {
    final params = {
      for (final e in (query ?? {}).entries)
        if (e.value != null && e.value!.isNotEmpty) e.key: e.value!,
    };
    final uri = Uri.parse('$apiBase/api$path').replace(queryParameters: params.isEmpty ? null : params);
    final request = http.Request(method, uri)
      ..headers['accept'] = 'application/json'
      ..headers['content-type'] = 'application/json';
    if (token != null) request.headers['authorization'] = 'Bearer $token';
    if (body != null) request.body = jsonEncode(body);

    final http.Response response;
    try {
      response = await http.Response.fromStream(await _client.send(request).timeout(_timeout));
    } on SocketException {
      throw ApiException('No internet connection. Check your network and try again.');
    } on TimeoutException {
      throw ApiException('The server took too long to answer. Try again.');
    } on http.ClientException {
      throw ApiException('Could not reach the server. Check your network and try again.');
    }

    final text = utf8.decode(response.bodyBytes);
    final data = text.isEmpty ? null : jsonDecode(text);
    if (response.statusCode >= 200 && response.statusCode < 300) return data;

    if (response.statusCode == 401 && token != null) onUnauthorized();
    throw ApiException(
      _detail(data) ?? 'Something went wrong (${response.statusCode})',
      status: response.statusCode,
      shortages: data is Map && data['shortages'] is List
          ? (data['shortages'] as List).cast<Map<String, dynamic>>()
          : null,
    );
  }

  static String? _detail(dynamic data) {
    if (data is! Map) return null;
    final detail = data['detail'];
    if (detail is String) return detail;
    // FastAPI validation errors: [{loc, msg}, ...]
    if (detail is List && detail.isNotEmpty && detail.first is Map) {
      return (detail.first['msg'] as String?)?.replaceFirst('Value error, ', '');
    }
    return null;
  }
}
