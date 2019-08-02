const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const cors = require('cors')({origin: true});
// const admin = require('firebase-admin');
// admin.initializeApp(functions.config().firebase);


exports.formSubmittion = functions.https.onRequest((request, response) => {
    cors(request, response, () => {});
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

const keyMap = {
    'firstName': 'שם פרטי',
    'lastName': 'שם משפחה',
    'id': 'תעודת זהות',

};

const transKey = function(englishKey) {
    if (keyMap[englishKey]) {
        return keyMap[englishKey];
    }
    return englishKey;
};

const stringPartsToHtml = function(stringParts) {
    let html = "<table align='right' dir='rtl'>";
    for (const [key, value] of Object.entries(stringParts)) {
        html = html + "<tr><td>"+transKey(key)+":</td><td style='padding-right: 4px;'>"+value+"</td>";
    }
    html = html+"</table>";
    return html;
};

const getSubject = function(type) {
    let hebrewType;
    switch (type) {
        case 'PowerOfAttorney':
            hebrewType = 'יפוי כח';
            break;
        default:
            hebrewType = 'סוג טופס לא ידוע';
            break;
    }
    return 'מערכת מוסדות - התקבל טופס חדש: '+hebrewType;
};

const sendForm = function(type, jsonData) {
    let stringParts = {};
    let attachments = [];
    for (const [key, value] of Object.entries(jsonData)) {
        if (value.startsWith('data:image/')) {
            const format = value.split('data:image/')[1].split(';')[0];
            attachments.push({
                filename: key+'.'+format,
                content: value.split("base64,")[1],
                encoding: 'base64'
            });
        } else {
            stringParts[key] = value;
        }
    }
    const subject = getSubject(type);
    const html = stringPartsToHtml(stringParts);
    sendEmail(subject, html, attachments);
};

//https://github.com/firebase/functions-samples/blob/master/email-confirmation/functions/index.js
//https://firebase.google.com/docs/functions/config-env
const sendEmail = function (subject, html, attachments) {
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
        html: html,
        attachments: attachments,
    };

    try {
        mailTransport.sendMail(mailOptions);
        console.log('email sent');
    } catch(error) {
        console.error('There was an error while sending the email:', error);
    }
    return null;
};







