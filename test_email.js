require('dotenv').config();
const { sendEmail } = require('./backend/services/mailer');

async function testGmail() {
    console.log("Testing mailer setup...");
    console.log("Found EMAIL_USER:", process.env.EMAIL_USER);
    // Give it a second to initialize the transporter
    setTimeout(async () => {
        try {
            console.log("Attempting dispatch to mogaralajahnavi9@gmail.com...");
            await sendEmail('mogaralajahnavi9@gmail.com', '', 'Test SMTP Connection', 'If you receive this, the SMTP is working!');
            console.log("Test finished.");
        } catch (err) {
            console.error("Caught error testing mailer:", err);
        }
    }, 1500);
}

testGmail();
