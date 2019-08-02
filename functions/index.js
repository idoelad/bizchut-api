const functions = require('firebase-functions');
const nodemailer = require('nodemailer');


exports.formSubmittion = functions.https.onRequest((request, response) => {
    if (request.method === 'OPTIONS') {
        response.send();
        return;
    }
    if (request.method !== 'POST') {
        response.status(400).send('Only POST calls are allowed')
    }
    if (!request.body.type) {
        response.status(400).send("Missing field: 'type'");
    }
    if (!request.body.data) {
        response.status(400).send("Missing field: 'data'");
    }
    sendForm(request.body.type, request.body.data);
    response.send(JSON.stringify({success: true}));
});

const sendForm = function(type, jsonData) {
    const subject = 'מערכת מוסדות - טופס חדש התקבל';
    const html = JSON.stringify(jsonData);
    sendEmail(subject, html);
};

//https://github.com/firebase/functions-samples/blob/master/email-confirmation/functions/index.js
//https://firebase.google.com/docs/functions/config-env
const sendEmail = function (subject, html) {
    const gmailEmail = functions.config().gmail.email;
    const gmailPassword = functions.config().gmail.password;
    const mailTransport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: gmailEmail,
            pass: gmailPassword,
        },
    });

    const mailOptions = {
        from: '"Bizchut - Mosadot" <'+gmailEmail+'>',
        to: gmailEmail,
        subject: subject,
        html: html
    };

    try {
        mailTransport.sendMail(mailOptions);
        console.log('email sent');
    } catch(error) {
        console.error('There was an error while sending the email:', error);
    }
    return null;
};







