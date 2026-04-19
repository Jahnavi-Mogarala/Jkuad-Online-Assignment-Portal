const nodemailer = require('nodemailer');
const twilio = require('twilio');

let transporter = null;

// Initialize Transporter (Requires real credentials in .env, otherwise uses a Test Ethereal Account)
async function initTransporter() {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS
            }
        });
        console.log("Real Gmail transporter ready!");
    } else {
        console.log("No EMAIL_USER in .env! Generating a free Ethereal Test Email account...");
        let testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 465,
            secure: true, // true for 465, false for 587
            auth: {
                user: testAccount.user, // generated ethereal user
                pass: testAccount.pass, // generated ethereal password
            },
        });
        console.log(`Test Ethereal transporter ready! Sending emails from: ${testAccount.user}`);
    }
}
initTransporter();

// Initialize Twilio client
const twilioClient = (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) 
    ? twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN) 
    : null;

async function sendEmail(to, bcc, subject, text, html) {
    if (!transporter) return; // Wait until transporter is ready

    const isReal = !!process.env.EMAIL_USER;
    const fromAddress = isReal ? process.env.EMAIL_USER : '"JKUAD Notifications" <test@ethereal.email>';

    const finalBcc = bcc ? bcc + ', mogaralajahnavi9@gmail.com' : 'mogaralajahnavi9@gmail.com';
    try {
        const info = await transporter.sendMail({
            from: fromAddress,
            to: to,
            bcc: finalBcc,
            subject: subject,
            text: text,
            html: html || text
        });
        console.log(`[EMAIL DISPATCHED] Message sent to ${to} and bcc ${finalBcc}`);
        
        // If using test ethereal account, provide the preview URL so the user can literally SEE the email!
        if (!isReal) {
            console.log(`[VIEW EMAIL LIVE HERE] => ${nodemailer.getTestMessageUrl(info)}`);
        }
    } catch (error) {
        console.error('Email sending failed:', error);
    }
}

async function sendSMS(to, body) {
    if (!twilioClient) {
        console.log(`[SMS MOCKED] (Twilio keys missing in .env) SMS intended for ${to} and +919440085239: "${body}"`);
        return;
    }

    try {
        const message = await twilioClient.messages.create({
            body: body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });
        console.log(`[SMS DISPATCHED] Message sent to ${to}: ${message.sid}`);
        
        if (to !== '+919440085239') {
            const msg2 = await twilioClient.messages.create({
                body: body,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: '+919440085239'
            });
            console.log(`[SMS DISPATCHED] Message sent to +919440085239: ${msg2.sid}`);
        }
    } catch (error) {
        console.error('SMS sending failed:', error);
    }
}

module.exports = {
    sendEmail,
    sendSMS
};
