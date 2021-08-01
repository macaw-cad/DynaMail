async function postData(url = '', data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data), // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

function sendMail(template, language, email, base64subject, base64html) {
  console.log(
    `Send email to '${email}' with template '${template}', language '${language}'`,
  );
  postData('/sendmail', {
    template,
    language,
    email,
    base64subject,
    base64html,
  }).then((data) => {
    if (data.error) {
      Toastify({
        text: `Failed to send mail: ${data.error}`,
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
        className: 'error',
      }).showToast();
    } else {
      Toastify({
        text: 'Mail is sent',
        backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
        className: 'info',
      }).showToast();
    }
    console.log(data); // JSON data parsed by `data.json()` call
  });
}
