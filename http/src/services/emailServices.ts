import dotenv from "dotenv";
dotenv.config();
import Bull from "bull";
import nodemailer from "nodemailer";

export let emailQueue: Bull.Queue;

export const initializeEmailQueue = (): Bull.Queue => {
  emailQueue = new Bull('email notifications', {
    redis: {
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });
  
  return emailQueue;
};

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!
  }
});

export const startEmailProcessors = (emailQueue: Bull.Queue<any>) => {

  emailQueue.process('trade-opened', async (job) => {
    const { userEmail, trade } = job.data;
    
    const mailOptions = {
      from: process.env.EMAIL_USER!,
      to: userEmail,
      subject: `Trade Opened - ${trade.asset}`,
      html: `
        <h2>Trade Successfully Opened</h2>
        <p><strong>Order ID:</strong> ${trade.orderId}</p>
        <p><strong>Asset:</strong> ${trade.asset}</p>
        <p><strong>Type:</strong> ${trade.type.toUpperCase()}</p>
        <p><strong>Margin:</strong> ${trade.margin.toFixed(2)}</p>
        <p><strong>Leverage:</strong> ${trade.leverage}x</p>
        <p><strong>Open Price:</strong> ${trade.openPrice}</p>
        <p><strong>Stop Loss:</strong> ${trade.stopLoss || 'Not set'}</p>
        <p><strong>Take Profit:</strong> ${trade.takeProfit || 'Not set'}</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
  });

  emailQueue.process('trade-closed', async (job) => {
    const { userEmail, trade } = job.data;
    
    const pnlColor = trade.pnl >= 0 ? 'green' : 'red';
    const pnlSign = trade.pnl >= 0 ? '+' : '';
    
    const mailOptions = {
      from: process.env.EMAIL_USER!,
      to: userEmail,
      subject: `Trade ${trade.reason} - ${trade.asset}`,
      html: `
        <h2>Trade ${trade.reason}</h2>
        <p><strong>Order ID:</strong> ${trade.orderId}</p>
        <p><strong>Asset:</strong> ${trade.asset}</p>
        <p><strong>Type:</strong> ${trade.type.toUpperCase()}</p>
        <p><strong>Margin:</strong> ${trade.margin.toFixed(2)}</p>
        <p><strong>Leverage:</strong> ${trade.leverage}x</p>
        <p><strong>Open Price:</strong> ${trade.openPrice}</p>
        <p><strong>Close Price:</strong> ${trade.closePrice}</p>
        <p><strong>P&L:</strong> <span style="color: ${pnlColor}">${pnlSign}${trade.pnl.toFixed(2)}</span></p>
        <p><strong>Reason:</strong> ${trade.reason}</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
  });
};