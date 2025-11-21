/**
 * HTML Email Templates
 * Beautiful, responsive email templates for all communications
 */

const baseStyle = `
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    margin: 0;
    padding: 0;
    background-color: #f4f4f4;
  }
  .container {
    max-width: 600px;
    margin: 20px auto;
    background: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }
  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px 20px;
    text-align: center;
  }
  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
  .content {
    padding: 30px 20px;
  }
  .content p {
    margin: 0 0 15px 0;
  }
  .button {
    display: inline-block;
    padding: 12px 30px;
    background: #667eea;
    color: white !important;
    text-decoration: none;
    border-radius: 5px;
    margin: 20px 0;
    font-weight: 600;
  }
  .info-box {
    background: #f8f9fa;
    border-left: 4px solid #667eea;
    padding: 15px;
    margin: 20px 0;
    border-radius: 4px;
  }
  .footer {
    background: #f8f9fa;
    padding: 20px;
    text-align: center;
    color: #666;
    font-size: 14px;
  }
  .footer a {
    color: #667eea;
    text-decoration: none;
  }
  .divider {
    height: 1px;
    background: #e0e0e0;
    margin: 20px 0;
  }
  .highlight {
    background: #fff3cd;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 600;
  }
`;

/**
 * Contact Form Auto-Reply
 */
export const contactFormAutoReply = (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyle}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ We Received Your Message!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${data.name}</strong>,</p>
      
      <p>Thank you for contacting the <strong>${data.department}</strong> team at MigraHosting. We've received your inquiry and will respond within 24 hours.</p>
      
      <div class="info-box">
        <strong>Your Message:</strong><br>
        <strong>Subject:</strong> ${data.subject || 'General Inquiry'}<br><br>
        ${data.message.replace(/\n/g, '<br>')}
      </div>
      
      <p><strong>Reference ID:</strong> <span class="highlight">${data.inquiryId}</span></p>
      
      <p>In the meantime, feel free to explore our resources:</p>
      
      <a href="${process.env.APP_URL}/kb" class="button">Knowledge Base</a>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; color: #666;">
        <strong>Need immediate assistance?</strong><br>
        Our support team is available 24/7 at <a href="mailto:support@migrahosting.com">support@migrahosting.com</a>
      </p>
    </div>
    <div class="footer">
      <p><strong>MigraHosting</strong> | Premium Web Hosting Solutions</p>
      <p>
        <a href="${process.env.APP_URL}">Website</a> | 
        <a href="${process.env.APP_URL}/support">Support</a> | 
        <a href="${process.env.APP_URL}/kb">Knowledge Base</a>
      </p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} MigraHosting. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Demo Request Confirmation
 */
export const demoRequestConfirmation = (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyle}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Your Demo Request is Confirmed!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${data.name}</strong>,</p>
      
      <p>Great news! Our sales team has received your demo request and is excited to show you what MigraHosting can do for <strong>${data.company || 'your organization'}</strong>.</p>
      
      <div class="info-box">
        <strong>What's Next?</strong><br><br>
        1. Our sales team will contact you within 2 business hours<br>
        2. We'll schedule a personalized demo at your convenience<br>
        3. You'll see our platform in action with your specific use case
      </div>
      
      <p><strong>Demo Request ID:</strong> <span class="highlight">${data.requestId}</span></p>
      
      ${data.message ? `
        <p><strong>Your Requirements:</strong></p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 4px;">
          ${data.message.replace(/\n/g, '<br>')}
        </div>
      ` : ''}
      
      <p>Want to explore before our call?</p>
      
      <a href="${process.env.APP_URL}/features" class="button">Explore Features</a>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; color: #666;">
        <strong>Questions?</strong> Reply to this email or call us at ${data.phone || '+1 (555) 123-4567'}
      </p>
    </div>
    <div class="footer">
      <p><strong>MigraHosting Sales Team</strong></p>
      <p><a href="mailto:sales@migrahosting.com">sales@migrahosting.com</a></p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} MigraHosting. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Newsletter Welcome Email
 */
export const newsletterWelcome = (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyle}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📬 Welcome to MigraHosting Newsletter!</h1>
    </div>
    <div class="content">
      <p>Hi ${data.name ? `<strong>${data.name}</strong>` : 'there'},</p>
      
      <p>Thanks for subscribing to the MigraHosting newsletter! You're now part of our community and will receive:</p>
      
      <div class="info-box">
        ✓ <strong>Product Updates</strong> - Be the first to know about new features<br>
        ✓ <strong>Industry Insights</strong> - Tips and best practices for web hosting<br>
        ✓ <strong>Exclusive Offers</strong> - Special discounts and promotions<br>
        ✓ <strong>Technical Guides</strong> - In-depth tutorials and how-tos
      </div>
      
      <p>We respect your inbox! You'll hear from us 2-3 times per month with valuable content.</p>
      
      <a href="${process.env.APP_URL}/blog" class="button">Read Our Blog</a>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; color: #666;">
        <strong>Prefer different content?</strong><br>
        <a href="${process.env.APP_URL}/preferences?email=${encodeURIComponent(data.email)}">Update your preferences</a> or 
        <a href="${process.env.APP_URL}/unsubscribe?email=${encodeURIComponent(data.email)}">unsubscribe</a> anytime.
      </p>
    </div>
    <div class="footer">
      <p><strong>MigraHosting</strong> | Stay Updated, Stay Ahead</p>
      <p><a href="${process.env.APP_URL}">Visit Website</a></p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} MigraHosting. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Early Access Code Email
 */
export const earlyAccessCode = (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyle}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Your Early Access Code is Here!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${data.name}</strong>,</p>
      
      <p>Congratulations! You're officially part of the MigraHosting Early Access Program. We're excited to have you test our platform before the official launch.</p>
      
      <div class="info-box" style="text-align: center; padding: 25px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your Early Access Code</p>
        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 3px;">
          ${data.accessCode}
        </p>
      </div>
      
      <p><strong>How to Get Started:</strong></p>
      <ol style="margin: 15px 0;">
        <li>Visit our early access portal</li>
        <li>Enter your code: <span class="highlight">${data.accessCode}</span></li>
        <li>Complete your profile setup</li>
        <li>Start exploring all features!</li>
      </ol>
      
      <a href="${process.env.APP_URL}/early-access/activate?code=${data.accessCode}" class="button">Activate Now</a>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; background: #fff3cd; padding: 15px; border-radius: 4px;">
        <strong>⚠️ Important:</strong> This code is unique to you and expires in 30 days. Don't share it with others!
      </p>
      
      <p style="font-size: 14px; color: #666; margin-top: 20px;">
        <strong>Need Help?</strong><br>
        Join our early access community or contact us at <a href="mailto:early-access@migrahosting.com">early-access@migrahosting.com</a>
      </p>
    </div>
    <div class="footer">
      <p><strong>MigraHosting Early Access Program</strong></p>
      <p>Thank you for being an early supporter!</p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} MigraHosting. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Referral Notification Email
 */
export const referralNotification = (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyle}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Great News! Someone Used Your Referral!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${data.referrerName}</strong>,</p>
      
      <p>Exciting news! Someone just signed up using your referral code <span class="highlight">${data.referralCode}</span>!</p>
      
      <div class="info-box">
        <strong>Referral Details:</strong><br><br>
        👤 New User: ${data.referredUserEmail}<br>
        📅 Signed Up: ${new Date().toLocaleDateString()}<br>
        💰 Potential Commission: ${data.commission || '10%'} of their first payment
      </div>
      
      <p><strong>What Happens Next?</strong></p>
      <ul style="margin: 15px 0;">
        <li>When they make their first payment, you'll earn commission</li>
        <li>Your commission will be credited to your account</li>
        <li>You can track all referrals in your dashboard</li>
      </ul>
      
      <a href="${process.env.APP_URL}/referrals" class="button">View Referral Dashboard</a>
      
      <div class="divider"></div>
      
      <p><strong>Keep Sharing!</strong></p>
      <p>Share your code with more friends and keep earning. The more you refer, the more you earn!</p>
      
      <p style="text-align: center; font-size: 20px; font-weight: bold; color: #667eea; margin: 20px 0;">
        Your Code: ${data.referralCode}
      </p>
    </div>
    <div class="footer">
      <p><strong>MigraHosting Referral Program</strong></p>
      <p>Earn rewards by sharing the love!</p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} MigraHosting. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * CSAT Survey Email
 */
export const csatSurvey = (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${baseStyle}
    .rating-buttons {
      text-align: center;
      margin: 25px 0;
    }
    .rating-button {
      display: inline-block;
      width: 50px;
      height: 50px;
      line-height: 50px;
      text-align: center;
      margin: 0 5px;
      background: #f0f0f0;
      color: #333;
      text-decoration: none;
      border-radius: 50%;
      font-weight: bold;
      font-size: 18px;
      transition: all 0.3s;
    }
    .rating-button:hover {
      background: #667eea;
      color: white;
      transform: scale(1.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 How Did We Do?</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${data.customerName}</strong>,</p>
      
      <p>We recently ${data.context || 'provided service to you'}, and we'd love to hear about your experience!</p>
      
      <p style="text-align: center; font-size: 16px; margin: 25px 0;">
        <strong>How satisfied were you with our service?</strong>
      </p>
      
      <div class="rating-buttons">
        <a href="${data.surveyUrl}?rating=1" class="rating-button">1</a>
        <a href="${data.surveyUrl}?rating=2" class="rating-button">2</a>
        <a href="${data.surveyUrl}?rating=3" class="rating-button">3</a>
        <a href="${data.surveyUrl}?rating=4" class="rating-button">4</a>
        <a href="${data.surveyUrl}?rating=5" class="rating-button">5</a>
      </div>
      
      <p style="text-align: center; font-size: 14px; color: #666;">
        1 = Very Unsatisfied | 5 = Very Satisfied
      </p>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; color: #666; text-align: center;">
        Your feedback helps us improve our service for everyone.<br>
        This survey takes less than 1 minute to complete.
      </p>
    </div>
    <div class="footer">
      <p><strong>MigraHosting</strong> | We Value Your Feedback</p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} MigraHosting. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * NPS Survey Email
 */
export const npsSurvey = (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${baseStyle}
    .nps-scale {
      text-align: center;
      margin: 25px 0;
    }
    .nps-button {
      display: inline-block;
      width: 45px;
      height: 45px;
      line-height: 45px;
      text-align: center;
      margin: 2px;
      background: #f0f0f0;
      color: #333;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      font-size: 16px;
    }
    .nps-button:hover {
      background: #667eea;
      color: white;
    }
    .nps-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Quick Question...</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${data.customerName}</strong>,</p>
      
      <p>We're always working to improve MigraHosting, and your opinion matters to us!</p>
      
      <p style="text-align: center; font-size: 18px; margin: 25px 0; font-weight: 600;">
        How likely are you to recommend MigraHosting to a friend or colleague?
      </p>
      
      <div class="nps-scale">
        ${Array.from({length: 11}, (_, i) => `
          <a href="${data.surveyUrl}?score=${i}" class="nps-button">${i}</a>
        `).join('')}
      </div>
      
      <div class="nps-labels">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; color: #666; text-align: center;">
        This survey takes 30 seconds. Your response helps us serve you better!
      </p>
    </div>
    <div class="footer">
      <p><strong>MigraHosting</strong> | Your Success is Our Success</p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} MigraHosting. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

/**
 * Onboarding Welcome Email
 */
export const onboardingWelcome = (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyle}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to MigraHosting!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${data.customerName}</strong>,</p>
      
      <p>Welcome aboard! We're thrilled to have you as part of the MigraHosting family. You've made a great choice for your web hosting needs!</p>
      
      <div class="info-box">
        <strong>✓ Your Account is Active!</strong><br><br>
        📧 Email: ${data.email}<br>
        🆔 Account ID: ${data.customerId || 'Will be assigned shortly'}<br>
        📅 Joined: ${new Date().toLocaleDateString()}
      </div>
      
      <p><strong>Get Started in 3 Easy Steps:</strong></p>
      
      <ol style="margin: 15px 0; line-height: 1.8;">
        <li><strong>Complete Your Profile</strong> - Add your details and preferences</li>
        <li><strong>Explore the Dashboard</strong> - Familiarize yourself with our control panel</li>
        <li><strong>Deploy Your First Site</strong> - Launch your website in minutes!</li>
      </ol>
      
      <a href="${process.env.APP_URL}/dashboard" class="button">Go to Dashboard</a>
      
      <div class="divider"></div>
      
      <p><strong>Need Help Getting Started?</strong></p>
      
      <ul style="margin: 15px 0;">
        <li>📚 <a href="${process.env.APP_URL}/kb">Browse our Knowledge Base</a></li>
        <li>🎥 <a href="${process.env.APP_URL}/tutorials">Watch Video Tutorials</a></li>
        <li>💬 <a href="${process.env.APP_URL}/support">Contact 24/7 Support</a></li>
      </ul>
      
      <div style="background: #e8f4f8; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <strong>🎁 Pro Tip:</strong> Check out our <a href="${process.env.APP_URL}/quick-start">Quick Start Guide</a> to launch your first website in under 5 minutes!
      </div>
    </div>
    <div class="footer">
      <p><strong>MigraHosting Team</strong></p>
      <p>We're here to help you succeed!</p>
      <p><a href="mailto:support@migrahosting.com">support@migrahosting.com</a></p>
      <p style="margin-top: 15px; font-size: 12px;">
        © ${new Date().getFullYear()} MigraHosting. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

export default {
  contactFormAutoReply,
  demoRequestConfirmation,
  newsletterWelcome,
  earlyAccessCode,
  referralNotification,
  csatSurvey,
  npsSurvey,
  onboardingWelcome,
};
