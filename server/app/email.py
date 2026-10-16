import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SENDER_EMAIL = os.getenv("SENDER_EMAIL")


def send_otp_email(to_email: str, otp: str, customer_name: str) -> bool:
    """Send OTP email to customer."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verify your email - Hooks & Threads"
        msg["From"] = SENDER_EMAIL
        msg["To"] = to_email

        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Verify your email</h2>
              <p>Hi {customer_name},</p>
              <p>Your OTP to verify your email is:</p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="letter-spacing: 4px; margin: 0;">{otp}</h1>
              </div>
              <p>This OTP expires in 10 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
              <p>— Hooks & Threads</p>
            </div>
          </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Email send error: {e}")
        return False
