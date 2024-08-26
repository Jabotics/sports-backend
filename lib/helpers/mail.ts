import nodemailer from 'nodemailer';
import config from 'config';
import handlebars from 'nodemailer-express-handlebars';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.get('email_id'),
        pass: config.get('email_pass')
    }
});

const hbs = handlebars;

const hbsConfig = {
    viewEngine: {
        extName: ".hbs",
        layoutDir: "./templates",
        defaultLayout: String(),
    },
    viewPath: "./templates",
    extName: ".hbs"
}

const sendMail = (contact: string, subject: string, template: string, context: object) => {
    transporter.use("compile", hbs(hbsConfig));

    const mailOptions = {
        from: String(config.get("email_id")),
        to: contact,
        subject,
        template,
        context
    };
    transporter.sendMail(mailOptions, function (err, info) { })
}

export {
    sendMail
}