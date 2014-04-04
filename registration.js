/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function checkSendRegister(req, res, connection, eventLog, transport) {
    var mailAddress = req.body.mail;
    var name = req.body.name;
    var pass = req.body.pass;
    var ip = req.connection.remoteAddress;
    connection.query('SELECT id FROM user WHERE email = ' + connection.escape(mailAddress), function(err, result) {
        res.type('application/json');
        if (err) {
            res.json({type: 'request', result: 'DATABASE_ERROR'});
            eventLog('[ Database error on email checking request from ' + ip + ' mail: ' + mailAddress + ' ]');
            return;
        }
        if (result.length >= 1) {
            res.json({type: 'request', result: 'EMAIL_EXISTS_ERROR'});
            eventLog('[ Mail address already in the DB  request from ' + ip + ' mail: ' + mailAddress + ' ]');
            return;
        }
        if (result.length === 0) {
            var code = Math.floor((Math.random() * 10000) + 1);
            code = code < 1000 ? code + 1000 : code;
            connection.query('INSERT INTO user (email, name, password, code) VALUES (' + connection.escape(mailAddress) + ', ' + connection.escape(name) + ', ' + connection.escape(pass) + ',' + code + ')', function(err) {
                if (err) {
                    res.json({type: 'request', result: 'DATABASE_ERROR'});
                    eventLog('[ Database error on inserting new user from ' + ip + ' mail: ' + mailAddress + ' ]');
                    return;
                }
                var mailOptions = {
                    from: "CollabRoute <noreply.collabroute@gmail.com>",
                    to: name + " <" + mailAddress + ">",
                    subject: "CollabRoute registration confirm",
                    html: "<h2>WELCOME " + name + "!</h2>" +
                            "<h4>Just a few minutes and you will complete your registration</h4>" +
                            "<p>go back to the app and insert the following code: <strong>" + code + "</strong></p>"
                };
                transport.sendMail(mailOptions, function(err, response) {
                    if (err) {
                        eventLog(err);
                        res.json({type: 'request', result: 'EMAIL_SEND_ERROR'});
                        connection.query('DELETE FROM user WHERE email = ' + connection.escape(mailAddress), function(err, res) {
                            if (err) {
                                eventLog('Possible DB data inconsistency on delete new user with email address ' + mailAddress + ' please check it manually error: ' + err);
                                return;
                            }
                        });
                        return;
                    }
                    eventLog("Confirmation mail sent to new user: " + name + " (" + ip + "): " + response.message);
                    res.json({type: 'request', result: 'OK', code: code});
                });
            });
        }
    });
}

function confirmRegistration(req, res, connection, eventLog) {
    var mail = req.body.mail;
    var ip = req.connection.remoteAddress;
    res.type('application/json');
    connection.query('SELECT confirmed, name, id FROM user WHERE email = ' + connection.escape(mail)+' AND confirmed = 0', function(err, result) {
        if (err) {
            eventLog('Database Error on checking new user with mail ' + mail + ' (' + ip + ') error: ' + err);
            res.json({type: 'confirm', result: 'DATABASE_ERROR'});
            return;
        }
        if (result.length === 0) {
            eventLog('User not found while confirm registration with mail ' + mail + ' (' + ip + ')');
            res.json({type: 'confirm', result: 'EMAIL_NOT_FOUND'});
            return;
        }
        var name = result[0].name;
        var id = result[0].id;
        connection.query('UPDATE user SET confirmed = 1 WHERE email = ' + connection.escape(mail), function(err) {
            if (err) {
                eventLog('Database Error on confirm new user with mail ' + mail + ' (' + ip + ') error: ' + err);
                res.json({type: 'confirm', result: 'DATABASE_ERROR'});
                return;
            }
            eventLog("New User with email " + mail + " (" + ip + ") successfully confirm registration");
            res.json({type: 'confirm', result: 'OK', name: name, mail: mail, id: id});
        });
    });
}

module.exports.checkSendRegister = checkSendRegister;
module.exports.confirmRegistration = confirmRegistration;
