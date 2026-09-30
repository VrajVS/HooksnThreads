import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// Website brand colours (tailwind.config.js).
const navy = Color(0xFF2F3456);
const gold = Color(0xFFB8975A);
const sage = Color(0xFF7A9582);
const cream = Color(0xFFF4EFE7);

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: navy,
    primary: navy,
    secondary: sage,
    tertiary: gold,
    surface: Colors.white,
  );
  final text = GoogleFonts.jostTextTheme();
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: cream,
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: navy,
      foregroundColor: Colors.white,
      centerTitle: false,
      titleTextStyle: GoogleFonts.cinzel(fontSize: 18, fontWeight: FontWeight.w600, letterSpacing: 1.5, color: Colors.white),
    ),
    cardTheme: const CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(14))),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      isDense: true,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      selectedColor: navy.withValues(alpha: 0.12),
      side: BorderSide(color: Colors.grey.shade300),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: gold.withValues(alpha: 0.25),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(backgroundColor: gold, foregroundColor: Colors.white),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(backgroundColor: navy, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(foregroundColor: navy, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
