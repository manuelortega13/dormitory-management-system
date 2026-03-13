const https = require('https');
const querystring = require('querystring');

/**
 * Send SMS via Semaphore API
 * @param {string} number - Philippine mobile number (e.g., 09171234567)
 * @param {string} message - SMS message content
 * @returns {Promise<object>} API response
 */
async function sendSms(number, message) {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) {
    console.warn('SEMAPHORE_API_KEY not set — skipping SMS');
    return null;
  }

  if (!number) {
    console.warn('No phone number provided — skipping SMS');
    return null;
  }

  const postData = querystring.stringify({
    apikey: apiKey,
    number,
    message,
    sendername: process.env.SEMAPHORE_SENDER_NAME || 'SEMAPHORE',
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.semaphore.co',
        path: '/api/v4/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            console.log('Semaphore SMS response:', parsed);
            resolve(parsed);
          } catch {
            console.error('Semaphore SMS parse error:', data);
            resolve(data);
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('Semaphore SMS error:', err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Notify parent via SMS that their child's leave request needs approval
 * @param {string} parentPhone - Parent's phone number
 * @param {string} parentName - Parent's name
 * @param {string} childName - Child/resident's name
 * @param {object} leaveDetails - Leave request details (destination, departure_date, return_date)
 */
async function notifyParentLeaveApproval(parentPhone, parentName, childName, leaveDetails) {
  const departure = new Date(leaveDetails.departure_date).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const returnDate = new Date(leaveDetails.return_date).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const message =
    `PAC DMS: Hi ${parentName}, your child ${childName} has requested a leave ` +
    `from ${departure} to ${returnDate} (Destination: ${leaveDetails.destination}). ` +
    `Please log in to the Parent Portal to approve or decline this request.`;

  try {
    await sendSms(parentPhone, message);
  } catch (error) {
    console.error('Failed to send parent leave approval SMS:', error.message);
  }
}

module.exports = { sendSms, notifyParentLeaveApproval };
