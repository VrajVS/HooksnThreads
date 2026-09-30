import 'package:flutter/material.dart';

int _int(dynamic v) => v == null ? 0 : (v as num).round();
num _num(dynamic v) => v == null ? 0 : v as num;
String? _str(dynamic v) => v as String?;

/// Mirrors ORDER_TOTALS_CTE on the server and the studio spreadsheet's colour key.
enum Stage {
  preparationPending('preparation_pending', 'Preparation pending', 'Preparation', Color(0xFFE53935)),
  inProgress('in_progress', 'Work in progress', 'In progress', Color(0xFFFB8C00)),
  deliveryPending('delivery_pending', 'Delivery pending', 'Delivery', Color(0xFFF2C200)),
  paymentPending('payment_pending', 'Payment pending', 'Payment', Color(0xFFD81BD8)),
  done('done', 'Done', 'Done', Color(0xFF10B981)),
  cancelled('cancelled', 'Cancelled', 'Cancelled', Color(0xFFA1A1AA));

  const Stage(this.key, this.label, this.short, this.color);

  final String key;
  final String label;
  final String short;
  final Color color;

  static Stage? of(String? key) {
    for (final s in values) {
      if (s.key == key) return s;
    }
    return null;
  }

  static const steps = [preparationPending, inProgress, deliveryPending, paymentPending, done];
}

const statusLabels = {
  'pending': 'Pending',
  'confirmed': 'Confirmed',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
};

const paymentModeLabels = {'online': 'Online', 'cash': 'Cash'};

const orderPaymentModes = {'online': 'Online', 'cash': 'Cash', 'online_cash': 'Online + Cash'};

class OrderSummary {
  OrderSummary.fromJson(Map<String, dynamic> j)
      : id = j['id'] as int,
        invoiceNumber = j['invoice_number'] as String,
        orderDate = j['order_date'] as String,
        source = j['source'] as String,
        status = j['status'] as String,
        stage = Stage.of(j['stage'] as String?) ?? Stage.preparationPending,
        customerName = j['customer_name'] as String,
        customerPhone = _str(j['customer_phone']),
        total = _int(j['total']),
        paid = _int(j['paid']),
        delivered = j['delivered'] == true,
        deliveryDate = _str(j['delivery_date']),
        lineCount = _int(j['line_count']),
        preparedCount = _int(j['prepared_count']),
        itemCount = _int(j['item_count']),
        itemsSummary = _str(j['items_summary']) ?? '',
        paymentModes = _str(j['payment_modes']);

  final int id;
  final String invoiceNumber;
  final String orderDate;
  final String source;
  final String status;
  final Stage stage;
  final String customerName;
  final String? customerPhone;
  final int total;
  final int paid;
  final bool delivered;
  final String? deliveryDate;
  final int lineCount;
  final int preparedCount;
  final int itemCount;
  final String itemsSummary;
  final String? paymentModes;
}

class OrderItem {
  OrderItem.fromJson(Map<String, dynamic> j)
      : id = j['id'] as int,
        handle = _str(j['handle']),
        title = j['title'] as String,
        unitPrice = _int(j['unit_price']),
        quantity = _int(j['quantity']),
        prepared = j['prepared'] == true,
        workNote = _str(j['work_note']),
        image = _str(j['image']);

  final int id;
  final String? handle;
  final String title;
  final int unitPrice;
  final int quantity;
  bool prepared;
  String? workNote;
  final String? image;

  int get amount => unitPrice * quantity;
}

class OrderCharge {
  OrderCharge(this.label, this.amount);

  OrderCharge.fromJson(Map<String, dynamic> j)
      : label = j['label'] as String,
        amount = _int(j['amount']);

  final String label;
  final int amount;
}

class Payment {
  Payment.fromJson(Map<String, dynamic> j)
      : id = j['id'] as int,
        amount = _int(j['amount']),
        mode = j['mode'] as String,
        paidOn = j['paid_on'] as String,
        note = _str(j['note']),
        adminName = _str(j['admin_name']);

  final int id;
  final int amount;
  final String mode;
  final String paidOn;
  final String? note;
  final String? adminName;
}

class OrderEvent {
  OrderEvent.fromJson(Map<String, dynamic> j)
      : id = j['id'] as int,
        kind = j['kind'] as String,
        fromValue = _str(j['from_value']),
        toValue = _str(j['to_value']),
        detail = _str(j['detail']),
        actor = _str(j['actor']),
        adminName = _str(j['admin_name']),
        createdAt = DateTime.parse(j['created_at'] as String).toLocal();

  final int id;
  final String kind;
  final String? fromValue;
  final String? toValue;
  final String? detail;
  final String? actor;
  final String? adminName;
  final DateTime createdAt;
}

class Requirement {
  Requirement.fromJson(Map<String, dynamic> j)
      : name = j['name'] as String,
        unit = j['unit'] as String? ?? '',
        required = _num(j['required']),
        stock = _num(j['stock']),
        shortage = _num(j['shortage']);

  final String name;
  final String unit;
  final num required;
  final num stock;
  final num shortage;
}

class OrderDetail {
  OrderDetail.fromJson(Map<String, dynamic> j)
      : id = j['id'] as int,
        invoiceNumber = j['invoice_number'] as String,
        orderDate = j['order_date'] as String,
        source = j['source'] as String,
        status = j['status'] as String,
        stage = Stage.of(j['stage'] as String?) ?? Stage.preparationPending,
        customerName = j['customer_name'] as String,
        customerPhone = _str(j['customer_phone']),
        customerEmail = _str(j['customer_email']),
        shippingAddress = _str(j['shipping_address']),
        notes = _str(j['notes']),
        subtotal = _int(j['subtotal']),
        total = _int(j['total']),
        paid = _int(j['paid']),
        balance = _int(j['balance']),
        delivered = j['delivered'] == true,
        deliveryDate = _str(j['delivery_date']),
        paymentMode = _str(j['payment_mode']),
        stockDeducted = j['stock_deducted'] == true,
        createdBy = _str(j['created_by']),
        items = [for (final i in j['items'] as List) OrderItem.fromJson(i)],
        charges = [for (final c in j['charges'] as List) OrderCharge.fromJson(c)],
        payments = [for (final p in j['payments'] as List) Payment.fromJson(p)],
        events = [for (final e in (j['events'] as List? ?? [])) OrderEvent.fromJson(e)],
        requirements = [for (final r in (j['requirements'] as List? ?? [])) Requirement.fromJson(r)];

  final int id;
  final String invoiceNumber;
  final String orderDate;
  final String source;
  final String status;
  final Stage stage;
  final String customerName;
  final String? customerPhone;
  final String? customerEmail;
  final String? shippingAddress;
  final String? notes;
  final int subtotal;
  final int total;
  final int paid;
  final int balance;
  final bool delivered;
  final String? deliveryDate;
  final String? paymentMode;
  final bool stockDeducted;
  final String? createdBy;
  final List<OrderItem> items;
  final List<OrderCharge> charges;
  final List<Payment> payments;
  final List<OrderEvent> events;
  final List<Requirement> requirements;

  bool get cancelled => status == 'cancelled';

  /// What was actually paid, else what was agreed.
  String? get paymentModeLabel {
    final modes = payments.map((p) => p.mode).toSet();
    if (modes.length == 2) return 'Online + Cash';
    if (modes.length == 1) return paymentModeLabels[modes.first];
    return orderPaymentModes[paymentMode];
  }
}

class BusinessSettings {
  BusinessSettings.fromJson(Map<String, dynamic> j)
      : businessName = j['business_name'] as String? ?? 'Hooks & Threads',
        contactName = _str(j['contact_name']),
        phone = _str(j['phone']),
        email = _str(j['email']),
        address = _str(j['address']),
        invoiceFooter = _str(j['invoice_footer']) ?? '';

  final String businessName;
  final String? contactName;
  final String? phone;
  final String? email;
  final String? address;
  final String invoiceFooter;
}
