const axios = require("axios"),
	nodemailer = require("nodemailer"),
	moment = require("moment");

const { config, smtpOptions } = require("./secrets");

const transporter = nodemailer.createTransport(smtpOptions);

// Initial Settings
const OPUS_SESSION_URL = "https://api.opus.agency/api/1.4/getEventSessions",
	TIME_BETWEEN_PULLS = 600000, // 10 minutes
	MODIFIED_DATE_FORMAT = "YYYY-MM-DDTHH:mm:ss.SSS", // Date received format
	FILTER_DATE_FORMAT = "MM/DD/YYYY HH:mm:ss", // Date to post format -- save in this format
	FIELDS_TO_COMPARE = [
		"group_name",
		"session_name",
		"session_start_date_time",
		"session_end_date_time",
		"room_name",
		"session_status"
	];

let firstPull = true,
	lastModifiedTime = null,
	oldSessionObject = {};

// Generate email object to send to smtp service
const generateMailObject = emailObj => {
	return {
		from: config.emailFrom,
		to: config.emailTo,
		subject: config.subject,
		text: emailObj.text,
		html: emailObj.html
	};
};

// Generate POST body for Opus API
const generatePostBody = () => {
	const obj = {
		clientGUID: config.opusGuid,
		event_id: config.opusEventId
	};
	if (lastModifiedTime) {
		obj.filter = `modified_date_time > ${lastModifiedTime.format(
			FILTER_DATE_FORMAT
		)}`;
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
				modified_date_time,
				session_id
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
					modified_date_time,
					session_id
				}
			);
		}
	});
	return newSessions;
};

// Compare new and old session objects
const compareNewOldSessions = (newSessions, oldSessions) => {
	const addedSessions = [],
		removedSessions = [],
		editedSessions = [];

	const sameSessionIds = new Set();

	// Check for new sessions
	Object.keys(newSessions).forEach(newSessionKey => {
		if (!oldSessions.hasOwnProperty(newSessionKey)) {
			addedSessions.push(newSessions[newSessionKey]);
		} else {
			sameSessionIds.add(newSessionKey);
		}
	});

	// Check for removed sessions
	Object.keys(oldSessions).forEach(oldSessionKey => {
		if (!newSessions.hasOwnProperty(oldSessionKey)) {
			removedSessions.push(oldSessions[oldSessionKey]);
		}
	});

	// Check for edits
	sameSessionIds.forEach(sessionId => {
		FIELDS_TO_COMPARE.forEach(field => {
			if (newSessions[sessionId][field] !== oldSessions[sessionId][field]) {
				editedSessions.push(
					generateEditedSessionObject(
						sessionId,
						field,
						oldSessions[sessionId][field],
						newSessions[sessionId][field]
					)
				);
			}
		});
	});
	return {
		addedSessions,
		removedSessions,
		editedSessions
	};
};

// Generate object to push to edited sessions
const generateEditedSessionObject = (
	sessionId,
	fieldname,
	prevValue,
	nowValue
) => {
	return {
		sessionId,
		fieldname,
		prevValue,
		nowValue
	};
};

// Generate the text and html fields to send by email
const generateEmailBody = edits => {
	let addedMsgs = [],
		removedMsgs = [],
		editsMsgs = [],
		msgText = "",
		msgHTML = "";

	if (edits.addedSessions.length > 0) {
		edits.addedSessions.forEach(addedSession => {
			addedMsg.push(
				`Session ID: ${addedSession.session_id}|Session Name: ${addedSession.session_name}|Start Date: ${addedSession.session_start_date_time}|End Date: ${addedSession.session_end_date_time}|Group Name: ${addedSession.group_name}|Room: ${addedSession.room_name}|Status: ${addedSession.session_status}`
			);
		});
	}

	if (edits.removedSessions.length > 0) {
		edits.removedSessions.forEach(removedSession => {
			removedMsgs.push(
				`Session ID: ${removedSession.session_id}|Session Name: ${removedSession.session_name}|Start Date: ${removedSession.session_start_date_time}|End Date: ${removedSession.session_end_date_time}|Group Name: ${removedSession.group_name}|Room: ${removedSession.room_name}|Status: ${removedSession.session_status}`
			);
		});
	}

	if (edits.editedSessions.length > 0) {
		edits.editedSessions.forEach(edit => {
			editsMsgs.push(
				`Session ID: ${edit.sessionId}| ${edit.fieldname} has changed from ${edit.prevValue} to ${edit.nowValue}.`
			);
		});
	}

	const d = moment();
	msgText = `Changes from ${d.format("h:mm a, MMM Do, YYYY")}\n\n`;
	msgHTML = `<h1>${msgText}</h1>`;
	if (addedMsgs.length > 0) {
		// Add titles
		msgText += `${addedMsgs.length} ADDED SESSIONS:\n`;
		msgHTML += `<div><h2>${addedMsgs.length} ADDED SESSIONS:</h2>`;
		// Add additional session list
		msgText += addedMsgs.join("\n") + "\n\n";
		msgHTML += "<p>" + addedMsgs.join("</p><p>") + "</p></div>";
	}
	if (removedMsgs.length > 0) {
		msgText += `${removedMsgs.length} REMOVED SESSIONS:\n`;
		msgHTML += `<div><h2>${removedMsgs.length} REMOVED SESSIONS:</h2>`;
		msgText += removedMsgs.join("\n") + "\n\n";
		msgHTML += "<p>" + removedMsgs.join("</p><p>") + "</p></div>";
	}
	if (editsMsgs.length > 0) {
		msgText += `${editsMsgs.length} EDITS:\n`;
		msgText += editsMsgs.join("\n") + "\n\n";
		msgHTML += `<div><h2>${editsMsgs.length} EDITS:</h2>`;
		msgHTML += "<p>" + editsMsgs.join("</p><p>") + "</p></div>";
	}
	return {
		text: msgText,
		html: msgHTML
	};
};

// Calculate most recent last modified time
const getMostRecentTime = sessions => {
	let mostRecent = null;
	sessions.forEach(session => {
		if (!mostRecent) {
			mostRecent = moment(session.modified_date_time, MODIFIED_DATE_FORMAT);
		}
		if (
			mostRecent.isBefore(
				moment(session.modified_date_time, MODIFIED_DATE_FORMAT)
			)
		) {
			mostRecent = moment(session.modified_date_time, MODIFIED_DATE_FORMAT);
		}
	});
	return mostRecent;
};

// Start the compare
const startOpusCompare = async () => {
	try {
		const opusSessionResponse = await getOpusSessions();
		if (opusSessionResponse.data && opusSessionResponse.data.result) {
			if (opusSessionResponse.data.result.length > 0) {
				// Format response
				const newSessions = createSessionObject(
					opusSessionResponse.data.result
				);
				// Assign initial session list
				if (firstPull) {
					oldSessionObject = newSessions;
					firstPull = false;
				}
				// Compare old and new sessions
				const sessionDiffs = compareNewOldSessions(
					newSessions,
					oldSessionObject
				);
				// See if anything has changed..
				if (
					sessionDiffs.editedSessions.length === 0 &&
					sessionDiffs.addedSessions.length === 0 &&
					sessionDiffs.removedSessions.length === 0
				) {
					console.log("No session changes detected...");
					return false;
				}
				// Calculate the most recent modified time
				const mostRecentTime = getMostRecentTime(newSessions);
				console.log(mostRecentTime.format(MODIFIED_DATE_FORMAT));

				// Create format to send by email
				const emailObj = generateEmailBody(sessionDiffs);
				// Send email - assign newSessions to oldSessions and assign lastModifiedTime
				transporter.sendMail(generateMailObject(emailObj), (err, response) => {
					if (err) {
						throw new Error(err);
					} else {
						console.log("Successfully sent email about changes..");
						lastModifiedTime = mostRecentTime;
						oldSessionObject = newSessions;
					}
				});
			} else {
				console.log("No sessions returned...");
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
