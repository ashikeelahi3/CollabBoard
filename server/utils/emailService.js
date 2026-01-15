import nodemailer from 'nodemailer';

// Free Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your-email@gmail.com
    pass: process.env.EMAIL_PASS  // App Password (not regular password)
  }
});

export const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.APP_URL}/verify-email?token=${token}`;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Email - CollabBoard',
    html: `
      <h2>Welcome to CollabBoard!</h2>
      <p>Click the link below to verify your email:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>This link expires in 24 hours.</p>
    `
  });
};
