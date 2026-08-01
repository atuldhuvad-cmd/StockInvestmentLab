#!/usr/bin/env python3
"""
===============================================================================
User Guide PDF Generator — Wealth Intelligence Suite
===============================================================================
Generates a comprehensive, step-by-step User Guide PDF for Desktop & Mobile use
of the Wealth Intelligence Suite and Intraday Satellite Desk.
===============================================================================
"""

import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DOCS_DIR = os.path.join(PROJECT_ROOT, "00_Project")
PDF_OUTPUT_PATH = os.path.join(PROJECT_DOCS_DIR, "User_Guide_Wealth_Intelligence_Suite.pdf")
MD_OUTPUT_PATH = os.path.join(PROJECT_DOCS_DIR, "User_Guide_Wealth_Intelligence_Suite.md")

USER_GUIDE_MD_TEXT = """# 📘 Step-by-Step User Guide: Wealth Intelligence Suite

**System Version:** v2.1.0 / Nifty 500 Fundamentals Enrollment
**Scope:** Strictly Personal Single-User Investment, Portfolio Management, and Paper Trading
**Architecture:** Pure Offline Web App + Public Market Data Auto-Sync Engine

---

## 🎯 Core Operating Mandate

1. **Strictly Personal Use:** Built exclusively for single-user personal investment & paper trading. Zero enterprise complexity, zero subscription fees, zero cloud dependency.
2. **Mobile-First & Wi-Fi Operable:** Every screen and action is designed to be easily operable on smartphone touchscreens (iOS / Android) over your local Wi-Fi.
3. **Zero-CSV Manual Friction:** Tap **"⚡ Sync Nifty 500 Public Prices"** to automatically update historical technical prices without downloading or uploading CSV files.
4. **100% Broker-Free:** Uses free public market data (Yahoo Finance `.NS` symbols). Zero broker logins, credentials, or API keys required.

---

## 🚀 1. How to Launch the Application

### A. Desktop-Only Mode (Localhost Only)
1. Double-click `Start_Wealth_Suite_Desktop_Only.bat` in `D:\\StockInvestmentLab`.
2. Binds strictly to `127.0.0.1:8000` and automatically opens `http://localhost:8000` in your desktop browser.

### B. Home Wi-Fi Mode (Desktop + Mobile Phone)
1. Double-click `Start_Wealth_Suite_Home_WiFi.bat` in `D:\\StockInvestmentLab`.
2. Opens `http://localhost:8000` on your desktop PC and displays your private LAN URL (e.g. `http://192.168.1.15:8000`).
3. Connect your **iPhone or Android phone** to the same Home Wi-Fi network and open `http://192.168.x.x:8000` in Safari/Chrome.
4. **Tip:** Add the page to your phone's Home Screen for instant 1-tap app access!

### C. Stopping the Server
1. Double-click `Stop_Wealth_Suite_Server.bat` to cleanly terminate running server instances.

---

## 📊 2. Daily Step-by-Step Workflow Guide

### Step 1: Overview Module
* **Purpose:** Daily factual summary snapshot.
* **Actions:** Check backup currency status (*Current* vs. *Due*), view overall net worth, and use quick action shortcuts to open Paper Trading or Watchlist.

### Step 2: Delivery Screener & 1-Click Public Auto-Sync
* **Purpose:** Find high-quality delivery candidates ranked across 5 quantitative pillars (*Business Quality, Financial Strength, Valuation, Technical Trend, Risk*).
* **Actions:**
  1. Click **`⚡ Sync Nifty 500 Public Prices`** in the Price History Data Center.
  2. Leaving the ticker field blank pulls 250+ daily completed candles for all 500 official Nifty 500 constituents, plus Nifty 50 and Nifty Bank benchmarks.
  3. Search any constituent by ticker, such as `DIXON`, and filter the list by Full Rating, Technical-Only, Data Missing, or Sync Failed.
  4. The ten companies with enrolled fundamental records retain complete 5-pillar Delivery ratings. Other constituents show technical metrics with an explicit **Technical-only — fundamentals not enrolled** label and are never presented as fully rated.
  5. If network access fails for a ticker, click **`Retry Failed Tickers`** to retry only the unsuccessful symbols.

### Step 3: Portfolio Module (Real Investments)
* **Purpose:** Real holdings ledger and realized/unrealized gain tracking.
* **Actions:**
  1. Record dated **BUY** and **SELL** transactions with quantity, purchase price, and asset class.
  2. Review Sector Allocation and Asset Class concentration breakdown.
  3. Realized/unrealized P&L and weighted average costs update automatically.

### Step 4: Watchlist Module
* **Purpose:** Candidate research funnel.
* **Actions:**
  1. Add stocks to watch and assign a category: *Watch*, *Study*, *Buy Soon*, or *Reject*.
  2. Set Target Prices and take notes.
  3. Public market price evidence updates automatically alongside target prices.

### Step 5: Paper Trading Simulation Workspace
* **Purpose:** 1-to-3 month simulation testing for Delivery Screener selections before allocating real money.
* **Actions:**
  1. Set Starting Paper Capital, max allocation per stock (e.g., 20%), and max open holdings.
  2. Select **Paper Buy** on a Delivery Screener candidate.
  3. Record simulated entry price, manual observed date/time/source, and entry reason.
  4. Monitor drawdown, holding periods, and 30/60/90-day returns in **Performance Review**.

### Step 6: Fundamentals & Quality Context
* **Purpose:** Search the Nifty 500 registry, preserve verified financial history, and enroll genuine fundamental evidence without fabricated defaults.
* **Actions:**
  1. Search any constituent by ticker, including `DIXON`. A stock with no record displays **Not Enrolled** and blank values.
  2. Use **Enroll Financial Data** to enter sourced ratios. Partial records may be saved but remain **Fundamentals Incomplete**.
  3. Full Rating requires verified evidence plus ROE, Debt/Equity, P/E, Revenue CAGR, and at least one qualitative moat score.
  4. Mark evidence as verified only after checking the named source. Unverified, missing, future-dated, or stale evidence cannot promote a stock.
  5. Edit operations preserve the previous manual record in enrollment history; delete requires explicit confirmation.
  6. Use the status filter and completion sort to work through Missing, Partial, Unverified, Stale, Verified, and Full Rating candidates. Each ticker shows its missing requirements.
  7. Use **Export CSV Template** for a blank 19-column enrollment sheet. The `DIXON` example row contains only its ticker and fiscal period; no financial values are prefilled.
  8. Use **Import CSV** to preview Create, Update, Skip, and Reject decisions. Only commit after reviewing row-level validation messages.
  9. CSV imports accept quoted commas and multiline evidence text, preserve blanks as missing, restrict enrollment to Nifty 500 tickers, and keep prior period revisions in append-only history.

---

## 💾 3. Storage, Backups & Privacy

* **IndexedDB Local Storage:** Portfolio records, watchlist items, paper trades, price histories, fundamental enrollments, evidence metadata, and enrollment history are stored inside your local browser's IndexedDB.
* **Exporting Backups:** Click **`Export backup`** in the top toolbar to download a `.json` backup file.
* **Restoring Backups:** Click **`Import backup`**, select your `.json` backup file, and confirm. All state is restored with built-in `PER-D01` data protection.

---

## 🛰️ 4. Satellite Application: Intraday Satellite Desk

* **Location:** `D:\\IntradaySatelliteDesk` (App) and `D:\\Intraday_Trading_Lab` (Engine)
* **Launcher:** Double-click `Run_Intraday_Satellite_Desk.bat`.
* **Purpose:** Dedicated ORB 15 + VWAP + Relative Volume intraday discipline log and paper recommendation terminal with dark cyberpunk UI.
* **Guardrails:** Hard daily loss limits, max 2 trades/day cap, emergency stop button.

---

## 📝 Document Update Policy
This User Guide is maintained automatically alongside application updates. Whenever features, UI navigation, or auto-sync endpoints are modified, this guide is updated to reflect the latest verified baseline.
"""

def generate_pdf_with_reportlab():
    """Attempt PDF generation using reportlab."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        doc = SimpleDocTemplate(
            PDF_OUTPUT_PATH,
            pagesize=letter,
            rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36
        )

        styles = getSampleStyleSheet()

        # Custom Styles
        title_style = ParagraphStyle(
            'DocTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#0d6b4c'),
            alignment=TA_LEFT,
            spaceAfter=8
        )

        sub_title_style = ParagraphStyle(
            'SubTitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor('#475569'),
            spaceAfter=14
        )

        heading2_style = ParagraphStyle(
            'Heading2Custom',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=14,
            leading=18,
            textColor=colors.HexColor('#1e293b'),
            spaceBefore=14,
            spaceAfter=6
        )

        body_style = ParagraphStyle(
            'BodyCustom',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor('#334155'),
            spaceAfter=6
        )

        story = []
        story.append(Paragraph("📘 Step-by-Step User Guide: Wealth Intelligence Suite", title_style))
        story.append(Paragraph("<b>Version:</b> v1.8.0 / Public Sync v1.9.0 &nbsp;|&nbsp; <b>Scope:</b> Personal Single-User & Mobile-First", sub_title_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0d6b4c'), spaceAfter=12))

        lines = USER_GUIDE_MD_TEXT.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith('# '):
                continue
            elif line.startswith('## '):
                story.append(Paragraph(line[3:], heading2_style))
            elif line.startswith('### '):
                story.append(Paragraph(f"<b>{line[4:]}</b>", ParagraphStyle('H3', parent=body_style, fontName='Helvetica-Bold', fontSize=10.5, leading=14, textColor=colors.HexColor('#0d6b4c'))))
            elif line.startswith('* ') or line.startswith('- '):
                story.append(Paragraph(f"• {line[2:]}", ParagraphStyle('Bullet', parent=body_style, leftIndent=12)))
            elif line.startswith('1. ') or line.startswith('2. ') or line.startswith('3. ') or line.startswith('4. '):
                story.append(Paragraph(line, ParagraphStyle('Num', parent=body_style, leftIndent=12)))
            elif line == '---':
                story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceBefore=8, spaceAfter=8))
            else:
                formatted = line.replace('**', '<b>').replace('**', '</b>').replace('`', '<font name="Courier">').replace('`', '</font>')
                story.append(Paragraph(formatted, body_style))

        doc.build(story)
        print(f"Generated PDF User Guide via ReportLab: {PDF_OUTPUT_PATH}")
        return True
    except Exception as e:
        print(f"ReportLab PDF generation note: {e}")
        return False

def generate_markdown_and_html_guide():
    """Write master Markdown guide and printable HTML guide."""
    os.makedirs(PROJECT_DOCS_DIR, exist_ok=True)
    with open(MD_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(USER_GUIDE_MD_TEXT)
    print(f"Generated Master Markdown User Guide: {MD_OUTPUT_PATH}")

    # Generate HTML printable page
    html_path = os.path.join(PROJECT_DOCS_DIR, "User_Guide_Wealth_Intelligence_Suite.html")
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>User Guide — Wealth Intelligence Suite</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px auto; max-width: 860px; color: #1e293b; line-height: 1.6; padding: 0 20px; }}
  h1 {{ color: #0d6b4c; border-bottom: 2px solid #0d6b4c; padding-bottom: 8px; }}
  h2 {{ color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 28px; }}
  h3 {{ color: #0d6b4c; margin-top: 18px; }}
  code {{ background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }}
  pre {{ background: #f1f5f9; padding: 12px; border-radius: 6px; overflow-x: auto; }}
  ul, ol {{ padding-left: 24px; }}
  .badge {{ background: #e2e8f0; color: #334155; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }}
  .print-button {{ position: sticky; top: 12px; float: right; padding: 10px 14px; border: 0; border-radius: 6px; background: #0d6b4c; color: white; cursor: pointer; font-weight: 700; }}
  @media print {{ body {{ margin: 0; max-width: 100%; }} .print-button {{ display: none; }} }}
</style>
</head>
<body>
  <button class="print-button" type="button" onclick="window.print()">Save / Print as PDF</button>
  {USER_GUIDE_MD_TEXT.replace('# ', '<h1>').replace('## ', '<h2>').replace('### ', '<h3>').replace('\n\n', '<p>').replace('\n', '<br>')}
</body>
</html>
"""
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Generated Printable HTML User Guide: {html_path}")

if __name__ == "__main__":
    generate_markdown_and_html_guide()
    pdf_ok = generate_pdf_with_reportlab()
    if not pdf_ok:
        print("Note: Install reportlab (`pip install reportlab`) if you wish to compile direct PDF files via Python. The HTML file can also be printed directly to PDF from any browser.")
