const axios = require("axios"),
	nodemailer = require("nodemailer");

const { config, smtpOptions } = require("./secrets");

const transporter = nodemailer.createTransport(smtpOptions);

// Generate email object to send to smtp service
const generateMailObject = () => {
	return {
		from: config.emailFrom,
		to: config.emailTo,
		subject: config.subject,
		text: "",
		html: ""
	};
};
