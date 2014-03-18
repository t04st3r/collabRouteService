/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

function sendRegistrationMail(name, mailAddress, ip, code, transport, eventLog) {
    var mailOptions = {
        from: "CollabRoute <noreply.collabroute@gmail.com>",
        to: name + " <" + mailAddress + ">",
        subject: "CollabRoute registration confirm",
        html: "<h2>WELCOME " + name + "!</h2>" +
                "<h4>Just a few minutes and you will complete your registration</h4>" +
                "<p>go back to the app and insert the following code: <strong>" + code + "</strong></p>"
    };
    return transport.sendMail(mailOptions, function(error, response) {
        if (error) {
            eventLog(error);
        } else {
            eventLog("Confirmation mail sent from new user: " + name + " (" + ip + "): " + response.message);
        }
    });
}

module.exports.sendRegistrationMail = sendRegistrationMail;

