const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, text, html }) {
    let transporter = nodemailer.createTransport({
        host: 'smtp.gmail.email', 
        port: 587, 
        secure: false, 
        auth: {
            user: process.env.EMAIL_USERNAME, 
            pass: process.env.EMAIL_PASSWORD  
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    let mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: to,
        subject: subject,
        text: text,
        html: html
    };

    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.error('Error sending email: ', error);
    }
}

module.exports = sendEmail;
