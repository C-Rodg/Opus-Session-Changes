const axios = require("axios"),
	nodemailer = require("nodemailer"),
	moment = require("moment");

const { config, smtpOptions } = require("./secrets");

const transporter = nodemailer.createTransport(smtpOptions);

// Initial Settings
const OPUS_SESSION_URL = "https://api.opus.agency/api/1.4/getEventSessions",
	TIME_BETWEEN_PULLS = 600000, // 10 minutes
	MODIFIED_DATE_FORMAT = "YYYY-MM-DDTHH:mm:ss.SSS", // Date received format
	FILTER_DATE_FORMAT = "MM/DD/YYYY HH:mm:ss"; // Date to post format -- save in this format

let firstPull = true,
	lastModifiedTime = "",
	oldSessionObject = {};

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

// Generate POST body for Opus API
const generatePostBody = () => {
	const obj = {
		clientGUID: config.opusGuid,
		event_id: config.opusEventId
	};
	if (lastModifiedTime) {
		obj.filter = `modified_date_time > ${lastModifiedTime}`;
	}
	return obj;
};

// Make request to Opus API
const getOpusSessions = () => {
	return axios({
		method: "post",
		url: OPUS_SESSION_URL,
		data: generatePostBody(),
		auth: {
			username: config.opusUser,
			password: config.opusPass
		},
		responseType: "json"
	});
};

// Create Session object
const createSessionObject = result => {
	const newSessions = {};
	result.forEach(sess => {
		if (sess.hasOwnProperty("session_id")) {
			const {
				group_name,
				session_name,
				session_start_date_time,
				session_end_date_time,
				room_name,
				session_status,
				modified_date_time
			} = sess;
			newSessions[sess.session_id] = Object.assign(
				{},
				{
					group_name,
					session_name,
					session_start_date_time,
					session_end_date_time,
					room_name,
					session_status,
					modified_date_time
				}
			);
		}
	});
	return newSessions;
};

// Start the compare
const startOpusCompare = async () => {
	try {
		const opusSessionResponse = await getOpusSessions();
		if (opusSessionResponse.data && opusSessionResponse.data.result) {
			if (opusSessionResponse.data.result.length > 0) {
				console.log(opusSessionResponse.data.result.length);
			} else {
				console.log("No session changes...");
				return false;
			}
		} else {
			throw new Error(opusSessionResponse);
		}
	} catch (err) {
		console.log(err);
	}
};

startOpusCompare();
