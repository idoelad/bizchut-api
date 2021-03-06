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
    console.log('submission received: type: '+request.body.type+' | body: '+JSON.stringify(request.body.data));
    sendForm(request.body.type, request.body.data);
    response.send(JSON.stringify({success: true}));
});

const keyMap = {
    // 'firstName': 'שם פרטי',
    // 'lastName': 'שם משפחה',
    // 'id': 'תעודת זהות',
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

const getHtml = function(type, results) {
    if (type === 'PowerOfAttorney') {
        return '<div align=\'right\' dir=\'rtl\'>'+
            'אני, '+
            results.stringParts['firstName'] + ' '+results.stringParts['lastName']+
            '<br>'+
            'תעודת זהות: '+results.stringParts['id']+
            '<br>'+
            'מייפה את כוחן של נעמה לרנר, יקירה אברך,צביה שפירו- וייסברג ותמי גרוס, עובדות עמותת "בזכות" המרכז לזכויות אדם של אנשים עם מוגבלויות, [1], ' +
            'לסייע לי בנוגע למיצוי הזכוית שלי במסגרת המגורים/אשפוז שלי, להיפגש איתי לצורך הסיוע,' +
            'לפנות אליכם בכתב או בעל פה בעבורי ובשמי בענייני, וכן לבקש ולקבל בשמי כל מידע הנוגע אלי, בעל פה או בכתב, ככל שיידרש על ידיהם בעניין זה. בחתימתי להלן,' +
            ' יש לראות גם אישור בקשר לפטור שאנוכי נותן/ת לכם מכל חובות סודיות שחלה עליכם ו/או שתחול עליכם לפי כל חוק ו/או דין.'+
            '<br>'+
            'חתימה:'+
            '<br>'+
            '<img src="cid:signature"/></div>';
    }
    let html = "<table align='right' dir='rtl'>";
    for (const [key, value] of Object.entries(results.stringParts)) {
        html = html + "<tr><td>"+transKey(key)+":</td><td style='padding-right: 4px;'>"+value+"</td>";
    }
    results.sections.forEach(function(section) {
        html = html + "<tr style='height: 4px;'><td><b>"+section.category+"</b></td></tr>";
        for (const [question, answer] of Object.entries(section.questions)) {
            html = html + "<tr><td>"+question+":</td><td style='padding-right: 4px;'>"+answer+"</td>";
        }
    });
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
        encoding: 'base64',
        cid: name
    };
};

const handleValue = function(key, value, results) {
    if (!value) {
        value = '';
    }
    if (key === 'categoryDetails') {
        return;
    }
    if (key === 'questions') {
        for (let [category, categoryQuestions] of Object.entries(value)) {
            results.sections.push({
                category: category,
                questions: categoryQuestions
            });
        }
        return;
    }
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
        return;
    }
    if (value.startsWith('data:')) { //Signature only
        results.attachments.push(getAttachment(key, value));
        return;
    }
    results.stringParts[key] = value;

};

const isEmptyValuesArray = function(array) {
    for (const object in array) {
        if (!isEmptyValuesObject(object)) {
            return false;
        }
    }
    return true;
};

const isEmptyValuesObject = function(object) {
    for (let [key, value] of Object.entries(object)) {
        if (value) {
            return false;
        }
    }
    return true;
};

const sendForm = function(type, jsonData) {
    let results = {
        stringParts: {},
        attachments: [],
        sections: []
    };
    for (let [key, value] of Object.entries(jsonData)) {
        handleValue(key, value, results);
    }
    if (isEmptyValuesObject(results.stringParts) && isEmptyValuesArray(results.attachments) && isEmptyValuesArray(results.sections)) {
        console.log('Empty form');
        return;
    }
    const subject = getSubject(type);
    const html = getHtml(type, results);
    console.log(html);
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







