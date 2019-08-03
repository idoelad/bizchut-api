const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const cors = require('cors')({origin: true});
const admin = require('firebase-admin');
admin.initializeApp();


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
    console.log('submission received');
    sendForm(request.body.type, request.body.data);
    response.send(JSON.stringify({success: true}));
});

const keyMap = {
    'firstName': 'שם פרטי',
    'lastName': 'שם משפחה',
    'id': 'תעודת זהות',
    'instituteType': 'סוג המסגרת',
    'instituteName': 'שם המסגרת',
    'instituteAddress': 'כתובת המוסד',
    'whatHappened': 'מה קרה',
    'name': 'שם',
    'phone': 'טלפון',
    'email': 'כתובת אימייל',
    'relation': 'הקשר למוסד',
    'details': 'פרטים',

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
        case 'complaint':
            hebrewType = 'דיווח על אירוע ספציפי';
            break;
        case 'report':
            hebrewType = 'שאלון על תנאים במסגרת';
            break;
        case 'community-housing':
            hebrewType = 'יציאה לדיור בקהילה';
            break;
        default:
            hebrewType = 'סוג טופס לא ידוע';
            break;
    }
    return 'מערכת מוסדות - התקבלה פניה חדשה: '+hebrewType;
};

const getAttachment = function(name, data) {
    const format = data.split(/data.+?\//)[1].split(';')[0];
    return {
        filename: name+'.'+format,
        content: data.split("base64,")[1],
        encoding: 'base64'
    };
};

const handleValue = function(key, value, results) {
    if (!value) {
        value = '';
    }
    console.log(key, JSON.stringify(value), typeof value);
    if (typeof value === 'object') {
        value.forEach(function(valuePart) {
            let fileName, data;
            if (valuePart['imagePreviewUrl']) {
                fileName = 'image';
                data = valuePart['imagePreviewUrl'];
            } else {
                fileName = 'recording';
                data = valuePart['blob'];
            }
            results.attachments.push(getAttachment(fileName, data));
        });
    } else if (value.startsWith('data:')) {
        results.attachments.push(getAttachment(key, value));
    } else {
        results.stringParts[key] = value;
    }
};

const sendForm = function(type, jsonData) {
    let results = {
        stringParts: {},
        attachments: []
    };
    for (let [key, value] of Object.entries(jsonData)) {
        handleValue(key, value, results);
    }
    const subject = getSubject(type);
    const html = stringPartsToHtml(results.stringParts);
    sendEmail(subject, html, results.attachments);
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
        from: '"בזכות - מוסדות" <'+gmailEmail+'>',
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







